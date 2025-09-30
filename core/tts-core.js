/**
 * @module TTSCore
 * @description Main orchestrator combining EventBus, Pipeline, PAL, and PerformanceMonitor
 */

import { TTSEvent } from './tts-event.js'
import { EventBus } from './event-bus.js'
import { Pipeline } from './pipeline.js'
import { PerformanceMonitor } from './performance-monitor.js'
import { PluginLoader } from './plugin-loader.js'
import { PAL } from '../platform/pal.js'

class TTSCore {
  constructor(config = {}) {
    this.config = {
      maxConcurrentRequests: 5,
      requestTimeout: 30000,
      enablePerformanceMonitoring: true,
      enableDebugLogging: false,
      ...config
    }

    this.eventBus = new EventBus()
    this.performanceMonitor = new PerformanceMonitor()
    this.pipeline = new Pipeline(this.performanceMonitor)
    this.pal = new PAL()
    this.pluginLoader = new PluginLoader()

    this.activeRequests = new Map()
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) {
      return
    }

    this.performanceMonitor.startTimer('core.initialization')

    try {
      await this.pal.initialize()

      await this.pluginLoader.loadManifest()

      await this.pluginLoader.loadAllPlugins(this.eventBus, this.pal)

      this._setupEventHandlers()
      this._setupPluginPipeline()

      this.initialized = true

      const initTime = this.performanceMonitor.endTimer('core.initialization')
      console.log(`TTSCore initialized in ${initTime}ms`)

      this.eventBus.publish('core:initialized', {
        timestamp: Date.now(),
        duration: initTime
      })

      return {
        success: true,
        duration: initTime,
        plugins: this.pluginLoader.getAllPlugins().map(p => p.id)
      }
    } catch (error) {
      console.error('TTSCore initialization failed:', error)
      this.eventBus.publish('core:error', {
        phase: 'initialization',
        error: error.message
      })
      throw error
    }
  }

  async process(request) {
    if (!this.initialized) {
      throw new Error('TTSCore not initialized')
    }

    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      throw new Error('Maximum concurrent requests exceeded')
    }

    const event = new TTSEvent(request)

    this.activeRequests.set(event.id, event)
    this.performanceMonitor.startTimer(`request.${event.id}`)

    try {
      event.setPhase('queued')
      await this.eventBus.publish('tts:request:queued', event)

      event.setPhase('processing')
      await this.eventBus.publish('tts:request:processing', event)

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout)
      })

      const processPromise = this._processEvent(event)

      const result = await Promise.race([processPromise, timeoutPromise])

      event.setPhase('completed')
      const duration = this.performanceMonitor.endTimer(`request.${event.id}`)

      this.performanceMonitor.recordMetric('request.complete', {
        duration,
        requestId: event.id
      })

      await this.eventBus.publish('tts:request:completed', result)

      return result
    } catch (error) {
      event.setError(error)
      const duration = this.performanceMonitor.endTimer(`request.${event.id}`)

      this.performanceMonitor.recordMetric('request.failed', {
        duration,
        requestId: event.id,
        error: error.message
      })

      await this.eventBus.publish('tts:request:failed', event)
      throw error
    } finally {
      this.activeRequests.delete(event.id)
    }
  }

  async _processEvent(event) {
    const context = {
      core: this,
      pal: this.pal,
      eventBus: this.eventBus,
      performanceMonitor: this.performanceMonitor
    }

    return await this.pipeline.execute(event, context)
  }

  registerPlugin(plugin) {
    if (!plugin || typeof plugin.init !== 'function') {
      throw new Error('Invalid plugin: must have init() method')
    }

    const pluginId = plugin.id || `plugin-${Date.now()}`

    this.performanceMonitor.startTimer(`plugin.registration.${pluginId}`)

    try {
      plugin.init(this.eventBus, this.pal)

      if (plugin.process) {
        this.pipeline.registerStage(pluginId, plugin.process.bind(plugin), {
          priority: plugin.priority || 0,
          dependencies: plugin.dependencies || [],
          optional: plugin.optional || false
        })
      }

      const duration = this.performanceMonitor.endTimer(`plugin.registration.${pluginId}`)

      this.eventBus.publish('plugin:registered', {
        pluginId,
        duration
      })

      console.log(`Plugin ${pluginId} registered successfully`)

      return pluginId
    } catch (error) {
      console.error(`Failed to register plugin ${pluginId}:`, error)
      throw error
    }
  }

  async healthCheck() {
    const health = {
      timestamp: Date.now(),
      core: {
        initialized: this.initialized,
        activeRequests: this.activeRequests.size,
        maxRequests: this.config.maxConcurrentRequests
      },
      components: {},
      plugins: {}
    }

    try {
      health.components.pal = await this.pal.testConnectivity()
    } catch (error) {
      health.components.pal = { error: error.message }
    }

    health.components.eventBus = {
      subscribers: this.eventBus.getSubscriberCount(),
      eventTypes: this.eventBus.getEventTypes().length
    }

    health.components.pipeline = {
      stages: this.pipeline.getStages().length,
      validation: this.pipeline.validateDependencies()
    }

    health.components.performance = this.performanceMonitor.createReport().summary

    try {
      health.plugins = await this.pluginLoader.healthCheck()
    } catch (error) {
      health.plugins = { error: error.message }
    }

    const isHealthy = health.core.initialized &&
                      health.components.pipeline.validation.valid &&
                      !health.components.pal.error

    health.status = isHealthy ? 'healthy' : 'degraded'

    return health
  }

  async cleanup() {
    if (!this.initialized) {
      return
    }

    console.log('Shutting down TTSCore...')

    try {
      for (const event of this.activeRequests.values()) {
        event.setError(new Error('Core shutdown'))
      }
      this.activeRequests.clear()

      const plugins = this.pluginLoader.getAllPlugins()
      for (const plugin of plugins.reverse()) {
        await this.pluginLoader.unloadPlugin(plugin.id)
      }

      this.pipeline.clear()

      await this.pal.cleanup()

      this.eventBus.clear()

      this.performanceMonitor.clear()

      this.initialized = false

      console.log('TTSCore shutdown complete')
    } catch (error) {
      console.error('Error during TTSCore cleanup:', error)
      throw error
    }
  }

  _setupEventHandlers() {
    this.eventBus.subscribe('tts:request:*', (event, type) => {
      if (this.config.enableDebugLogging) {
        console.log(`[TTSCore] ${type}:`, event.id)
      }
    })

    this.eventBus.onError((errorEvent) => {
      console.error('[TTSCore] Event handler error:', errorEvent)
      this.performanceMonitor.recordMetric('core.errors', {
        type: 'event-handler',
        count: errorEvent.errors.length
      })
    })

    this.eventBus.subscribe('performance:threshold:exceeded', (data) => {
      console.warn('[TTSCore] Performance threshold exceeded:', data)
    })
  }

  _setupPluginPipeline() {
    const plugins = this.pluginLoader.getAllPlugins()

    for (const plugin of plugins) {
      if (plugin.instance.process) {
        this.pipeline.registerStage(plugin.id, async (event, context) => {
          const startTime = Date.now()

          try {
            const result = await plugin.instance.process(event, context)
            const duration = Date.now() - startTime

            if (duration > 50) {
              console.warn(`Plugin ${plugin.id} took ${duration}ms to process`)
            }

            return result || event
          } catch (error) {
            console.error(`Plugin ${plugin.id} processing error:`, error)
            if (plugin.instance.optional) {
              return event
            }
            throw error
          }
        }, {
          priority: plugin.instance.priority || 0,
          dependencies: plugin.dependencies || [],
          optional: plugin.instance.optional || false,
          timeout: plugin.instance.timeout || 5000
        })
      }
    }
  }

  getMetrics(category = null, options = {}) {
    return this.performanceMonitor.getMetrics(category, options)
  }

  getBottlenecks() {
    return this.performanceMonitor.getBottlenecks()
  }

  getActiveRequests() {
    return Array.from(this.activeRequests.values()).map(event => ({
      id: event.id,
      phase: event.state.phase,
      progress: event.state.progress,
      elapsed: event.getElapsedTime()
    }))
  }

  getPlugins() {
    return this.pluginLoader.getAllPlugins()
  }

  getPipelineStages() {
    return this.pipeline.getStages()
  }
}

export { TTSCore }
module.exports = { TTSCore }