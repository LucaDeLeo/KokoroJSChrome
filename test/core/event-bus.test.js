/**
 * @module EventBus Test Suite
 */

import { EventBus } from '../../core/event-bus.js'

describe('EventBus', () => {
  let eventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  afterEach(() => {
    eventBus.clear()
  })

  describe('subscribe/publish basic functionality', () => {
    it('should subscribe and receive events', async () => {
      const handler = jest.fn()
      eventBus.subscribe('test:event', handler)

      await eventBus.publish('test:event', { data: 'test' })

      expect(handler).toHaveBeenCalledWith({ data: 'test' }, 'test:event')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple subscribers', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      eventBus.subscribe('test:event', handler1)
      eventBus.subscribe('test:event', handler2)

      await eventBus.publish('test:event', { data: 'test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', async () => {
      const handler = jest.fn()
      const unsubscribe = eventBus.subscribe('test:event', handler)

      await eventBus.publish('test:event', { data: 'test1' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      await eventBus.publish('test:event', { data: 'test2' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should throw error for non-function handler', () => {
      expect(() => eventBus.subscribe('test:event', 'not-a-function')).toThrow('Handler must be a function')
    })
  })

  describe('wildcard subscription support', () => {
    it('should support global wildcard (*)', async () => {
      const handler = jest.fn()
      eventBus.subscribe('*', handler)

      await eventBus.publish('test:event', { data: 'test' })
      await eventBus.publish('other:event', { data: 'other' })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith({ data: 'test' }, 'test:event')
      expect(handler).toHaveBeenCalledWith({ data: 'other' }, 'other:event')
    })

    it('should support namespace wildcards', async () => {
      const handler = jest.fn()
      eventBus.subscribe('test:*', handler)

      await eventBus.publish('test:event1', { data: 'test1' })
      await eventBus.publish('test:event2', { data: 'test2' })
      await eventBus.publish('other:event', { data: 'other' })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith({ data: 'test1' }, 'test:event1')
      expect(handler).toHaveBeenCalledWith({ data: 'test2' }, 'test:event2')
    })

    it('should support nested namespace wildcards', async () => {
      const handler = jest.fn()
      eventBus.subscribe('app:tts:*', handler)

      await eventBus.publish('app:tts:start', { data: 'start' })
      await eventBus.publish('app:tts:stop', { data: 'stop' })
      await eventBus.publish('app:other:event', { data: 'other' })

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should catch and report handler errors', async () => {
      const errorHandler = jest.fn()
      const goodHandler = jest.fn()
      const badHandler = jest.fn(() => {
        throw new Error('Handler error')
      })

      eventBus.onError(errorHandler)
      eventBus.subscribe('test:event', goodHandler)
      eventBus.subscribe('test:event', badHandler)

      const result = await eventBus.publish('test:event', { data: 'test' })

      expect(goodHandler).toHaveBeenCalledTimes(1)
      expect(result.handled).toBe(2)
      expect(result.errors).toBe(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(errorHandler.mock.calls[0][0].errors[0].error.message).toBe('Handler error')
    })

    it('should continue execution after handler error', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn(() => {
        throw new Error('Handler 2 error')
      })
      const handler3 = jest.fn()

      eventBus.subscribe('test:event', handler1)
      eventBus.subscribe('test:event', handler2)
      eventBus.subscribe('test:event', handler3)

      await eventBus.publish('test:event', { data: 'test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    it('should handle async handler errors', async () => {
      const errorHandler = jest.fn()
      const asyncHandler = jest.fn(async () => {
        throw new Error('Async error')
      })

      eventBus.onError(errorHandler)
      eventBus.subscribe('test:event', asyncHandler)

      const result = await eventBus.publish('test:event', { data: 'test' })

      expect(result.errors).toBe(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle error handler failures gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      const badErrorHandler = jest.fn(() => {
        throw new Error('Error handler error')
      })

      eventBus.onError(badErrorHandler)
      eventBus.subscribe('test:event', () => {
        throw new Error('Original error')
      })

      await eventBus.publish('test:event', { data: 'test' })

      expect(consoleError).toHaveBeenCalledWith('Error handler failed:', expect.any(Error))
      consoleError.mockRestore()
    })
  })

  describe('synchronous publishing', () => {
    it('should publish events synchronously', () => {
      const handler = jest.fn()
      eventBus.subscribe('test:event', handler)

      const result = eventBus.publishSync('test:event', { data: 'test' })

      expect(handler).toHaveBeenCalledWith({ data: 'test' }, 'test:event')
      expect(result.handled).toBe(1)
      expect(result.errors).toBe(0)
    })

    it('should handle sync errors', () => {
      const errorHandler = jest.fn()
      const badHandler = jest.fn(() => {
        throw new Error('Sync error')
      })

      eventBus.onError(errorHandler)
      eventBus.subscribe('test:event', badHandler)

      const result = eventBus.publishSync('test:event', { data: 'test' })

      expect(result.errors).toBe(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('event history', () => {
    it('should maintain event history', async () => {
      await eventBus.publish('test:event1', { data: 'test1' })
      await eventBus.publish('test:event2', { data: 'test2' })

      const history = eventBus.getHistory()

      expect(history).toHaveLength(2)
      expect(history[0].type).toBe('test:event1')
      expect(history[1].type).toBe('test:event2')
    })

    it('should filter history by event type', async () => {
      await eventBus.publish('test:event', { data: 'test1' })
      await eventBus.publish('other:event', { data: 'other' })
      await eventBus.publish('test:event', { data: 'test2' })

      const history = eventBus.getHistory('test:event')

      expect(history).toHaveLength(2)
      expect(history.every(e => e.type === 'test:event')).toBe(true)
    })

    it('should limit history size', async () => {
      eventBus.maxHistorySize = 3

      for (let i = 0; i < 5; i++) {
        await eventBus.publish('test:event', { data: i })
      }

      const history = eventBus.getHistory()

      expect(history).toHaveLength(3)
      expect(history[0].data.data).toBe(2)
      expect(history[2].data.data).toBe(4)
    })
  })

  describe('utility methods', () => {
    it('should get subscriber count', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      eventBus.subscribe('test:event', handler1)
      eventBus.subscribe('test:event', handler2)
      eventBus.subscribe('other:event', handler1)

      expect(eventBus.getSubscriberCount('test:event')).toBe(2)
      expect(eventBus.getSubscriberCount('other:event')).toBe(1)
      expect(eventBus.getSubscriberCount()).toBe(3)
    })

    it('should get event types', () => {
      eventBus.subscribe('test:event', jest.fn())
      eventBus.subscribe('other:event', jest.fn())
      eventBus.subscribe('*', jest.fn())

      const types = eventBus.getEventTypes()

      expect(types).toContain('test:event')
      expect(types).toContain('other:event')
      expect(types).toContain('*')
      expect(types).toHaveLength(3)
    })

    it('should clear all subscriptions', () => {
      eventBus.subscribe('test:event', jest.fn())
      eventBus.subscribe('other:event', jest.fn())

      eventBus.clear()

      expect(eventBus.getSubscriberCount()).toBe(0)
      expect(eventBus.getEventTypes()).toHaveLength(0)
      expect(eventBus.getHistory()).toHaveLength(0)
    })
  })

  describe('unsubscribe method', () => {
    it('should unsubscribe specific handler', async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      eventBus.subscribe('test:event', handler1)
      eventBus.subscribe('test:event', handler2)

      eventBus.unsubscribe('test:event', handler1)

      await eventBus.publish('test:event', { data: 'test' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle unsubscribe for non-existent handler', () => {
      const handler = jest.fn()
      expect(() => eventBus.unsubscribe('test:event', handler)).not.toThrow()
    })
  })
})