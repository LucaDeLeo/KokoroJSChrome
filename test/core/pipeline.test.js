/**
 * @module Pipeline Test Suite
 */

import { Pipeline } from '../../core/pipeline.js'

describe('Pipeline', () => {
  let pipeline

  beforeEach(() => {
    pipeline = new Pipeline()
  })

  afterEach(() => {
    pipeline.clear()
  })

  describe('stage registration and ordering', () => {
    it('should register a stage', () => {
      const handler = jest.fn()
      pipeline.registerStage('test-stage', handler)

      const stages = pipeline.getStages()
      expect(stages).toHaveLength(1)
      expect(stages[0].name).toBe('test-stage')
    })

    it('should throw error for non-function handler', () => {
      expect(() => pipeline.registerStage('test-stage', 'not-a-function'))
        .toThrow('Stage handler must be a function: test-stage')
    })

    it('should throw error for duplicate stage registration', () => {
      pipeline.registerStage('test-stage', jest.fn())
      expect(() => pipeline.registerStage('test-stage', jest.fn()))
        .toThrow('Stage already registered: test-stage')
    })

    it('should order stages by priority', () => {
      pipeline.registerStage('low', jest.fn(), { priority: 1 })
      pipeline.registerStage('high', jest.fn(), { priority: 10 })
      pipeline.registerStage('medium', jest.fn(), { priority: 5 })

      const stages = pipeline.getStages()
      expect(stages[0].name).toBe('high')
      expect(stages[1].name).toBe('medium')
      expect(stages[2].name).toBe('low')
    })

    it('should handle stage dependencies', () => {
      pipeline.registerStage('stage1', jest.fn())
      pipeline.registerStage('stage2', jest.fn(), { dependencies: ['stage1'] })
      pipeline.registerStage('stage3', jest.fn(), { dependencies: ['stage2'] })

      const stages = pipeline.getStages()
      expect(stages[0].name).toBe('stage1')
      expect(stages[1].name).toBe('stage2')
      expect(stages[2].name).toBe('stage3')
    })

    it('should detect circular dependencies', () => {
      pipeline.registerStage('stage1', jest.fn(), { dependencies: ['stage2'] })
      pipeline.registerStage('stage2', jest.fn(), { dependencies: ['stage1'] })

      const validation = pipeline.validateDependencies()
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('Circular dependency detected')
    })

    it('should validate and report non-existent dependencies', () => {
      pipeline.registerStage('stage1', jest.fn(), { dependencies: ['nonexistent'] })

      const validation = pipeline.validateDependencies()
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('Stage stage1 depends on non-existent stage: nonexistent')
    })
  })

  describe('async stage execution', () => {
    it('should execute stages in order', async () => {
      const executionOrder = []
      const handler1 = jest.fn(() => {
        executionOrder.push('stage1')
        return { processed: 'stage1' }
      })
      const handler2 = jest.fn(() => {
        executionOrder.push('stage2')
        return { processed: 'stage2' }
      })

      pipeline.registerStage('stage1', handler1)
      pipeline.registerStage('stage2', handler2)

      const event = { data: 'test' }
      const result = await pipeline.execute(event)

      expect(executionOrder).toEqual(['stage1', 'stage2'])
      expect(result.processed).toBe('stage2')
      expect(handler1).toHaveBeenCalledWith(event, expect.any(Object))
      expect(handler2).toHaveBeenCalledWith({ processed: 'stage1' }, expect.any(Object))
    })

    it('should handle async handlers', async () => {
      const handler = jest.fn(async (event) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { ...event, processed: true }
      })

      pipeline.registerStage('async-stage', handler)

      const result = await pipeline.execute({ data: 'test' })

      expect(result.processed).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should respect dependencies during execution', async () => {
      const executionOrder = []

      pipeline.registerStage('stage1', () => {
        executionOrder.push('stage1')
      })
      pipeline.registerStage('stage2', () => {
        executionOrder.push('stage2')
      }, { dependencies: ['stage1'] })
      pipeline.registerStage('stage3', () => {
        executionOrder.push('stage3')
      }, { dependencies: ['stage1', 'stage2'] })

      await pipeline.execute({})

      expect(executionOrder).toEqual(['stage1', 'stage2', 'stage3'])
    })

    it('should handle stage timeouts', async () => {
      const handler = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
      })

      pipeline.registerStage('slow-stage', handler, { timeout: 100 })

      await expect(pipeline.execute({}))
        .rejects.toThrow('Stage timeout: slow-stage')
    })

    it('should retry failed stages', async () => {
      let attempts = 0
      const handler = jest.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('Temporary failure')
        }
        return { success: true }
      })

      pipeline.registerStage('retry-stage', handler, { retries: 2 })

      const result = await pipeline.execute({})

      expect(result.success).toBe(true)
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should skip optional stages on failure', async () => {
      const handler1 = jest.fn(() => {
        throw new Error('Stage failed')
      })
      const handler2 = jest.fn(() => ({ processed: true }))

      pipeline.registerStage('optional-stage', handler1, { optional: true })
      pipeline.registerStage('required-stage', handler2)

      const result = await pipeline.execute({})

      expect(result.processed).toBe(true)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should fail on required stage failure', async () => {
      const handler = jest.fn(() => {
        throw new Error('Critical failure')
      })

      pipeline.registerStage('required-stage', handler)

      await expect(pipeline.execute({}))
        .rejects.toThrow('Critical failure')
    })

    it('should pass context between stages', async () => {
      const handler1 = jest.fn((event, context) => {
        expect(context).toHaveProperty('stagesCompleted')
        expect(context.stagesCompleted).toEqual([])
        return event
      })

      const handler2 = jest.fn((event, context) => {
        expect(context.stagesCompleted).toContain('stage1')
        return event
      })

      pipeline.registerStage('stage1', handler1)
      pipeline.registerStage('stage2', handler2)

      await pipeline.execute({})

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('stage management', () => {
    it('should unregister a stage', () => {
      pipeline.registerStage('test-stage', jest.fn())

      const result = pipeline.unregisterStage('test-stage')

      expect(result).toBe(true)
      expect(pipeline.getStages()).toHaveLength(0)
    })

    it('should prevent unregistering depended stages', () => {
      pipeline.registerStage('stage1', jest.fn())
      pipeline.registerStage('stage2', jest.fn(), { dependencies: ['stage1'] })

      expect(() => pipeline.unregisterStage('stage1'))
        .toThrow('Cannot unregister stage stage1: stage stage2 depends on it')
    })

    it('should return false when unregistering non-existent stage', () => {
      const result = pipeline.unregisterStage('nonexistent')
      expect(result).toBe(false)
    })

    it('should clear all stages', () => {
      pipeline.registerStage('stage1', jest.fn())
      pipeline.registerStage('stage2', jest.fn())

      pipeline.clear()

      expect(pipeline.getStages()).toHaveLength(0)
    })

    it('should get stage info', () => {
      const handler = jest.fn()
      pipeline.registerStage('test-stage', handler, {
        priority: 5,
        timeout: 3000,
        optional: true
      })

      const info = pipeline.getStageInfo('test-stage')

      expect(info.name).toBe('test-stage')
      expect(info.priority).toBe(5)
      expect(info.timeout).toBe(3000)
      expect(info.optional).toBe(true)
    })
  })

  describe('dependency validation', () => {
    it('should validate correct dependencies', () => {
      pipeline.registerStage('stage1', jest.fn())
      pipeline.registerStage('stage2', jest.fn(), { dependencies: ['stage1'] })

      const validation = pipeline.validateDependencies()

      expect(validation.valid).toBe(true)
    })

    it('should detect invalid dependencies', () => {
      pipeline.registerStage('stage1', jest.fn(), { dependencies: ['nonexistent'] })

      const validation = pipeline.validateDependencies()

      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('non-existent stage')
    })
  })

  describe('performance monitoring integration', () => {
    it('should record metrics when performance monitor is provided', async () => {
      const performanceMonitor = {
        recordMetric: jest.fn()
      }

      pipeline = new Pipeline(performanceMonitor)
      pipeline.registerStage('test-stage', jest.fn())

      await pipeline.execute({})

      expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
        'pipeline.stage',
        expect.objectContaining({
          stage: 'test-stage',
          duration: expect.any(Number),
          attempts: 1
        })
      )
    })

    it('should add stage timing to event if supported', async () => {
      const event = {
        addStageTime: jest.fn()
      }

      pipeline.registerStage('test-stage', (e) => e)

      await pipeline.execute(event)

      expect(event.addStageTime).toHaveBeenCalledWith('test-stage', expect.any(Number))
    })
  })
})