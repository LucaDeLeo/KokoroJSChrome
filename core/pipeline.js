/**
 * @module Pipeline
 * @description Pipeline manager for processing events through stages
 */

class Pipeline {
  constructor(performanceMonitor = null) {
    this.stages = new Map()
    this.stageOrder = []
    this.dependencies = new Map()
    this.performanceMonitor = performanceMonitor
  }

  registerStage(name, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new Error(`Stage handler must be a function: ${name}`)
    }

    if (this.stages.has(name)) {
      throw new Error(`Stage already registered: ${name}`)
    }

    const stage = {
      name,
      handler,
      dependencies: options.dependencies || [],
      priority: options.priority || 0,
      timeout: options.timeout || 5000,
      retries: options.retries || 0,
      optional: options.optional || false
    }

    this.stages.set(name, stage)
    this.dependencies.set(name, stage.dependencies)

    // Try to update stage order, but allow registration with missing dependencies
    try {
      this._updateStageOrder()
    } catch (error) {
      // Store the error for later validation but don't throw during registration
      this._validationError = error
    }

    return () => this.unregisterStage(name)
  }

  unregisterStage(name) {
    if (!this.stages.has(name)) {
      return false
    }

    for (const [stageName, deps] of this.dependencies.entries()) {
      if (deps.includes(name) && stageName !== name) {
        throw new Error(`Cannot unregister stage ${name}: stage ${stageName} depends on it`)
      }
    }

    this.stages.delete(name)
    this.dependencies.delete(name)
    this._updateStageOrder()

    return true
  }

  async execute(event, context = {}) {
    // Validate dependencies before execution
    const validation = this.validateDependencies()
    if (!validation.valid) {
      throw new Error(`Pipeline validation failed: ${validation.error}`)
    }

    if (this.stageOrder.length === 0) {
      return event
    }

    const executionContext = {
      ...context,
      stagesCompleted: [],
      stagesFailed: [],
      startTime: Date.now()
    }

    let currentEvent = event

    for (const stageName of this.stageOrder) {
      const stage = this.stages.get(stageName)

      if (!this._canExecuteStage(stage, executionContext)) {
        if (!stage.optional) {
          throw new Error(`Required dependencies not met for stage: ${stageName}`)
        }
        continue
      }

      try {
        currentEvent = await this._executeStage(stage, currentEvent, executionContext)
        executionContext.stagesCompleted.push(stageName)
      } catch (error) {
        executionContext.stagesFailed.push(stageName)

        if (!stage.optional) {
          error.stage = stageName
          error.context = executionContext
          throw error
        }

        console.warn(`Optional stage ${stageName} failed:`, error)
      }
    }

    return currentEvent
  }

  async _executeStage(stage, event, context) {
    const startTime = Date.now()
    let attempts = 0
    let lastError

    while (attempts <= stage.retries) {
      attempts++

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Stage timeout: ${stage.name}`)), stage.timeout)
        })

        const result = await Promise.race([
          stage.handler(event, context),
          timeoutPromise
        ])

        const duration = Date.now() - startTime

        if (this.performanceMonitor) {
          this.performanceMonitor.recordMetric('pipeline.stage', {
            stage: stage.name,
            duration,
            attempts
          })
        }

        if (event.addStageTime) {
          event.addStageTime(stage.name, duration)
        }

        return result || event
      } catch (error) {
        lastError = error

        if (attempts <= stage.retries) {
          console.warn(`Stage ${stage.name} failed (attempt ${attempts}/${stage.retries + 1}):`, error)
          await this._delay(Math.min(1000 * attempts, 5000))
        }
      }
    }

    throw lastError
  }

  _canExecuteStage(stage, context) {
    if (stage.dependencies.length === 0) {
      return true
    }

    return stage.dependencies.every(dep => context.stagesCompleted.includes(dep))
  }

  _updateStageOrder() {
    const sorted = []
    const visited = new Set()
    const visiting = new Set()

    const visit = (name) => {
      if (visited.has(name)) {
        return
      }

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving stage: ${name}`)
      }

      visiting.add(name)

      const stage = this.stages.get(name)
      if (stage) {
        for (const dep of stage.dependencies) {
          // Only check for non-existent dependencies if we're not allowing deferred validation
          if (this.stages.has(dep)) {
            visit(dep)
          }
        }
        sorted.push(name)
      }

      visiting.delete(name)
      visited.add(name)
    }

    for (const name of this.stages.keys()) {
      visit(name)
    }

    const priorityGroups = new Map()
    for (const name of sorted) {
      const priority = this.stages.get(name).priority
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, [])
      }
      priorityGroups.get(priority).push(name)
    }

    const priorities = Array.from(priorityGroups.keys()).sort((a, b) => b - a)

    this.stageOrder = []
    for (const priority of priorities) {
      this.stageOrder.push(...priorityGroups.get(priority))
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStages() {
    return this.stageOrder.map(name => ({
      name,
      ...this.stages.get(name)
    }))
  }

  getStageInfo(name) {
    return this.stages.get(name)
  }

  clear() {
    this.stages.clear()
    this.stageOrder = []
    this.dependencies.clear()
  }

  validateDependencies() {
    // First check for non-existent dependencies
    for (const [stageName, deps] of this.dependencies.entries()) {
      for (const dep of deps) {
        if (!this.stages.has(dep)) {
          return {
            valid: false,
            error: `Stage ${stageName} depends on non-existent stage: ${dep}`
          }
        }
      }
    }

    // Then check for circular dependencies by attempting to order stages
    try {
      const sorted = []
      const visited = new Set()
      const visiting = new Set()

      const visit = (name) => {
        if (visited.has(name)) {
          return
        }

        if (visiting.has(name)) {
          throw new Error(`Circular dependency detected involving stage: ${name}`)
        }

        visiting.add(name)

        const stage = this.stages.get(name)
        if (stage) {
          for (const dep of stage.dependencies) {
            if (this.stages.has(dep)) {
              visit(dep)
            }
          }
          sorted.push(name)
        }

        visiting.delete(name)
        visited.add(name)
      }

      for (const name of this.stages.keys()) {
        visit(name)
      }

      // If we got here, validation passed - update the stage order
      this._updateStageOrder()
      this._validationError = null
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }

    return { valid: true }
  }
}

export { Pipeline }