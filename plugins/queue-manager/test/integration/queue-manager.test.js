/**
 * QueueManager Plugin Integration Tests
 * Tests "stop previous" behavior, session management, and pipeline integration
 */

import QueueManagerPlugin from '../../src/queue.js'

// Mock event bus
class MockEventBus {
  constructor() {
    this.events = new Map()
    this.emittedEvents = []
  }

  subscribe(eventName, handler) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, [])
    }
    this.events.get(eventName).push(handler)
  }

  emit(eventName, data) {
    this.emittedEvents.push({ eventName, data, timestamp: Date.now() })
    const handlers = this.events.get(eventName) || []
    handlers.forEach(handler => handler(data))
  }

  getEmittedEvents(eventName) {
    return this.emittedEvents.filter(e => e.eventName === eventName)
  }

  clearEmittedEvents() {
    this.emittedEvents = []
  }
}

// Mock PAL
class MockPAL {
  constructor() {
    this.storage = {
      data: new Map(),
      get: jest.fn(async (key) => this.storage.data.get(key)),
      set: jest.fn(async (key, value) => this.storage.data.set(key, value))
    }
  }
}

describe('QueueManager Plugin Integration Tests', () => {
  let plugin
  let eventBus
  let pal

  beforeEach(() => {
    eventBus = new MockEventBus()
    pal = new MockPAL()
    plugin = new QueueManagerPlugin({
      maxQueueSize: 10,
      stopPrevious: true,
      sessionTimeout: 300000,
      persistState: true
    })
  })

  afterEach(async () => {
    if (plugin) {
      await plugin.cleanup()
    }
  })

  describe('Plugin Initialization', () => {
    test('should initialize successfully with event bus and PAL', async () => {
      const result = await plugin.init(eventBus, pal)
      expect(result).toBe(true)
      expect(plugin.eventBus).toBe(eventBus)
      expect(plugin.pal).toBe(pal)
    })

    test('should throw error if event bus is missing', async () => {
      await expect(plugin.init(null, pal)).rejects.toThrow('EventBus is required')
    })

    test('should throw error if PAL is missing', async () => {
      await expect(plugin.init(eventBus, null)).rejects.toThrow('PAL is required')
    })

    test('should subscribe to required events', async () => {
      await plugin.init(eventBus, pal)

      expect(eventBus.events.has('tts:request')).toBe(true)
      expect(eventBus.events.has('tts:started')).toBe(true)
      expect(eventBus.events.has('tts:completed')).toBe(true)
      expect(eventBus.events.has('tts:error')).toBe(true)
    })
  })

  describe('"Stop Previous" Behavior - Task 6 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should stop current audio when new request arrives', async () => {
      const startTime = performance.now()

      // First request
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: {
          text: 'First request',
          voice: 'af_bella',
          speed: 1.0
        }
      })

      expect(plugin.currentSession).not.toBeNull()
      expect(plugin.currentSession.sessionId).toBe('session-1')

      // Second request (should stop first)
      eventBus.clearEmittedEvents()
      eventBus.emit('tts:request', {
        id: 'session-2',
        type: 'tts:request',
        request: {
          text: 'Second request',
          voice: 'af_bella',
          speed: 1.0
        }
      })

      const endTime = performance.now()
      const stopTime = endTime - startTime

      // Verify stop was called
      const audioStopEvents = eventBus.getEmittedEvents('audio:stop')
      expect(audioStopEvents.length).toBeGreaterThan(0)
      expect(audioStopEvents[0].data.sessionId).toBe('session-1')

      // Verify new session is active
      expect(plugin.currentSession).not.toBeNull()
      expect(plugin.currentSession.sessionId).toBe('session-2')

      // Verify queue:stopped event was emitted
      const queueStoppedEvents = eventBus.getEmittedEvents('queue:stopped')
      expect(queueStoppedEvents.length).toBeGreaterThan(0)

      // Verify performance target (<50ms for stop)
      expect(stopTime).toBeLessThan(50)
    })

    test('should prevent concurrent audio playback', async () => {
      // Emit multiple rapid requests
      const requests = [
        { id: 'session-1', text: 'Request 1' },
        { id: 'session-2', text: 'Request 2' },
        { id: 'session-3', text: 'Request 3' }
      ]

      for (const req of requests) {
        eventBus.emit('tts:request', {
          id: req.id,
          type: 'tts:request',
          request: {
            text: req.text,
            voice: 'af_bella',
            speed: 1.0
          }
        })
      }

      // Only last session should be active
      expect(plugin.currentSession).not.toBeNull()
      expect(plugin.currentSession.sessionId).toBe('session-3')

      // Verify stop events were emitted for previous sessions
      const audioStopEvents = eventBus.getEmittedEvents('audio:stop')
      expect(audioStopEvents.length).toBe(2) // session-1 and session-2 stopped
    })

    test('should handle enqueue within 10ms performance target', async () => {
      const startTime = performance.now()

      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: {
          text: 'Test request',
          voice: 'af_bella',
          speed: 1.0
        }
      })

      const endTime = performance.now()
      const enqueueTime = endTime - startTime

      // Verify performance target (<10ms)
      expect(enqueueTime).toBeLessThan(10)
    })
  })

  describe('Session Tracking - Task 6 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should track session state transitions', async () => {
      // Initial request
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: {
          text: 'Test',
          voice: 'af_bella',
          speed: 1.0
        }
      })

      // Verify queued state
      expect(plugin.currentSession.status).toBe('queued')

      // Simulate started
      eventBus.emit('tts:started', {
        sessionId: 'session-1'
      })

      // Verify playing state
      expect(plugin.currentSession.status).toBe('playing')

      // Simulate completed
      eventBus.emit('tts:completed', {
        sessionId: 'session-1'
      })

      // Verify completed state
      expect(plugin.currentSession.status).toBe('completed')

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Verify session cleared
      expect(plugin.currentSession).toBeNull()
    })

    test('should emit queue events for UI updates', async () => {
      eventBus.clearEmittedEvents()

      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: {
          text: 'Test',
          voice: 'af_bella',
          speed: 1.0
        }
      })

      // Verify queue:started event
      const queueStartedEvents = eventBus.getEmittedEvents('queue:started')
      expect(queueStartedEvents.length).toBeGreaterThan(0)
      expect(queueStartedEvents[0].data.sessionId).toBe('session-1')

      // Forward to synthesis
      const ttsSynthesizeEvents = eventBus.getEmittedEvents('tts:synthesize')
      expect(ttsSynthesizeEvents.length).toBeGreaterThan(0)
    })

    test('should clear queue on new request', async () => {
      // First request
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'First', voice: 'af_bella', speed: 1.0 }
      })

      const firstSession = plugin.currentSession

      // Second request
      eventBus.emit('tts:request', {
        id: 'session-2',
        type: 'tts:request',
        request: { text: 'Second', voice: 'af_bella', speed: 1.0 }
      })

      // Verify queue is clear (no concurrent audio)
      expect(plugin.getQueueLength()).toBe(0)
      expect(plugin.currentSession.sessionId).toBe('session-2')
      expect(plugin.currentSession.sessionId).not.toBe(firstSession.sessionId)
    })
  })

  describe('State Persistence - Task 9 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should persist state to storage', async () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify storage.set was called
      expect(pal.storage.set).toHaveBeenCalled()

      const calls = pal.storage.set.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toBe('queue-manager-state')
    })

    test('should restore state on initialization', async () => {
      // Set up pre-existing state
      const existingState = {
        totalProcessed: 10,
        totalStopped: 5,
        lastActivity: Date.now()
      }

      pal.storage.data.set('queue-manager-state', existingState)

      // Create new plugin instance
      const newPlugin = new QueueManagerPlugin({ persistState: true })
      await newPlugin.init(eventBus, pal)

      // Verify state was restored
      expect(newPlugin.totalProcessed).toBe(10)
      expect(newPlugin.totalStopped).toBe(5)

      await newPlugin.cleanup()
    })
  })

  describe('Queue Management API', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should get current session', () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      const session = plugin.getCurrentSession()
      expect(session).not.toBeNull()
      expect(session.sessionId).toBe('session-1')
    })

    test('should get queue length', () => {
      const length = plugin.getQueueLength()
      expect(length).toBe(0) // Stop-previous mode has no queue
    })

    test('should get queue state', () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      const state = plugin.getQueueState()
      expect(state.currentSession).not.toBeNull()
      expect(state.queueLength).toBe(0)
      expect(state.totalProcessed).toBe(1)
    })

    test('should stop current session manually', async () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      expect(plugin.currentSession).not.toBeNull()

      eventBus.clearEmittedEvents()
      await plugin.stopCurrent()

      // Verify stop event
      const audioStopEvents = eventBus.getEmittedEvents('audio:stop')
      expect(audioStopEvents.length).toBeGreaterThan(0)

      expect(plugin.currentSession).toBeNull()
    })

    test('should pause and resume current session', async () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      // Simulate started
      eventBus.emit('tts:started', { sessionId: 'session-1' })
      expect(plugin.currentSession.status).toBe('playing')

      // Pause
      eventBus.clearEmittedEvents()
      await plugin.pauseCurrent()
      expect(plugin.currentSession.status).toBe('paused')

      const pauseEvents = eventBus.getEmittedEvents('queue:paused')
      expect(pauseEvents.length).toBeGreaterThan(0)

      // Resume
      eventBus.clearEmittedEvents()
      await plugin.resumeCurrent()
      expect(plugin.currentSession.status).toBe('playing')

      const resumeEvents = eventBus.getEmittedEvents('queue:resumed')
      expect(resumeEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling - Task 9 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should handle tts:error event', async () => {
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      eventBus.clearEmittedEvents()

      // Emit error
      eventBus.emit('tts:error', {
        sessionId: 'session-1',
        error: { message: 'Synthesis failed' }
      })

      // Verify session was stopped
      expect(plugin.currentSession).toBeNull()

      // Verify queue:stopped event
      const queueStoppedEvents = eventBus.getEmittedEvents('queue:stopped')
      expect(queueStoppedEvents.length).toBeGreaterThan(0)
      expect(queueStoppedEvents[0].data.reason).toBe('error')
    })

    test('should handle multiple rapid requests gracefully', async () => {
      // Emit 10 rapid requests
      for (let i = 0; i < 10; i++) {
        eventBus.emit('tts:request', {
          id: `session-${i}`,
          type: 'tts:request',
          request: { text: `Request ${i}`, voice: 'af_bella', speed: 1.0 }
        })
      }

      // Only last session should be active
      expect(plugin.currentSession).not.toBeNull()
      expect(plugin.currentSession.sessionId).toBe('session-9')

      // Verify metrics
      expect(plugin.totalProcessed).toBe(10)
      expect(plugin.totalStopped).toBe(9)
    })
  })

  describe('Session Timeout Cleanup', () => {
    test('should cleanup stale sessions', async () => {
      // Create plugin with short timeout for testing
      const shortTimeoutPlugin = new QueueManagerPlugin({
        sessionTimeout: 100 // 100ms
      })

      await shortTimeoutPlugin.init(eventBus, pal)

      // Create session
      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      expect(shortTimeoutPlugin.currentSession).not.toBeNull()

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Manually trigger cleanup (normally runs every minute)
      shortTimeoutPlugin._cleanupStaleSessions()

      // Verify session was cleared
      expect(shortTimeoutPlugin.currentSession).toBeNull()

      await shortTimeoutPlugin.cleanup()
    })
  })

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      await plugin.init(eventBus, pal)

      const health = await plugin.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.id).toBe('queue-manager')
      expect(health.version).toBe('1.0.0')
      expect(health).toHaveProperty('totalProcessed')
      expect(health).toHaveProperty('totalStopped')
    })
  })

  describe('Cleanup', () => {
    test('should stop current session on cleanup', async () => {
      await plugin.init(eventBus, pal)

      eventBus.emit('tts:request', {
        id: 'session-1',
        type: 'tts:request',
        request: { text: 'Test', voice: 'af_bella', speed: 1.0 }
      })

      expect(plugin.currentSession).not.toBeNull()

      await plugin.cleanup()

      expect(plugin.currentSession).toBeNull()
      expect(plugin.queue.length).toBe(0)
    })

    test('should clear cleanup timer', async () => {
      await plugin.init(eventBus, pal)

      expect(plugin.cleanupTimer).not.toBeNull()

      await plugin.cleanup()

      expect(plugin.cleanupTimer).toBeNull()
    })
  })
})

describe('Performance Benchmarks', () => {
  let plugin
  let eventBus
  let pal

  beforeEach(async () => {
    eventBus = new MockEventBus()
    pal = new MockPAL()
    plugin = new QueueManagerPlugin()
    await plugin.init(eventBus, pal)
  })

  afterEach(async () => {
    await plugin.cleanup()
  })

  test('should handle 100 sequential requests within performance targets', async () => {
    const times = []

    for (let i = 0; i < 100; i++) {
      const start = performance.now()

      eventBus.emit('tts:request', {
        id: `session-${i}`,
        type: 'tts:request',
        request: { text: `Request ${i}`, voice: 'af_bella', speed: 1.0 }
      })

      const end = performance.now()
      times.push(end - start)
    }

    // Calculate average
    const avg = times.reduce((a, b) => a + b, 0) / times.length

    // Verify average is under 10ms
    expect(avg).toBeLessThan(10)

    // Verify 95th percentile is under 50ms
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95)]
    expect(p95).toBeLessThan(50)
  })
})
