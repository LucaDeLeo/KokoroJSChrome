/**
 * UIRenderer Plugin Integration Tests
 * Tests UI components rendering, event handling, and Shadow DOM isolation
 */

import UIRendererPlugin from '../../src/renderer.js'

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
      get: jest.fn(),
      set: jest.fn()
    }
  }
}

describe('UIRenderer Plugin Integration Tests', () => {
  let plugin
  let eventBus
  let pal

  beforeEach(() => {
    // Create mocks
    eventBus = new MockEventBus()
    pal = new MockPAL()

    // Create plugin instance
    plugin = new UIRendererPlugin({
      defaultTheme: 'default',
      defaultSize: 'medium',
      buttonAutoHideDelay: 10000,
      progressAutoHideDelay: 2000,
      enableAnimations: true
    })

    // Mock document.body if needed
    if (typeof document === 'undefined') {
      global.document = {
        createElement: jest.fn((tag) => ({
          attachShadow: jest.fn(() => ({
            appendChild: jest.fn(),
            adoptedStyleSheets: []
          })),
          style: {},
          addEventListener: jest.fn(),
          appendChild: jest.fn(),
          classList: { add: jest.fn(), remove: jest.fn() },
          setAttribute: jest.fn(),
          removeAttribute: jest.fn()
        })),
        body: {
          appendChild: jest.fn()
        }
      }
      global.window = {
        innerWidth: 1920,
        innerHeight: 1080,
        scrollX: 0,
        scrollY: 0,
        getSelection: jest.fn(() => ({
          toString: () => 'Test selection',
          getRangeAt: () => ({
            getBoundingClientRect: () => ({
              left: 100,
              top: 100,
              right: 200,
              bottom: 120,
              width: 100,
              height: 20
            })
          })
        })),
        requestAnimationFrame: jest.fn(cb => setTimeout(cb, 0))
      }
    }
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

      expect(eventBus.events.has('selection:detected')).toBe(true)
      expect(eventBus.events.has('tts:progress')).toBe(true)
      expect(eventBus.events.has('tts:started')).toBe(true)
      expect(eventBus.events.has('tts:completed')).toBe(true)
      expect(eventBus.events.has('tts:error')).toBe(true)
    })
  })

  describe('Floating Button - Task 2 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should render floating button on selection:detected event', async () => {
      const startTime = performance.now()

      // Emit selection detected event
      eventBus.emit('selection:detected', {
        selection: {
          text: 'Hello world, this is a test.',
          rect: {
            left: 100,
            top: 100,
            right: 200,
            bottom: 120,
            width: 100,
            height: 20
          }
        }
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Verify performance target (<200ms)
      expect(renderTime).toBeLessThan(200)

      // Verify button was created
      expect(plugin.components.has('floating-button')).toBe(true)
    })

    test('should handle viewport boundary edge cases', async () => {
      // Test selection near right edge
      eventBus.emit('selection:detected', {
        selection: {
          text: 'Test',
          rect: {
            left: 1800,
            top: 100,
            right: 1900,
            bottom: 120,
            width: 100,
            height: 20
          }
        }
      })

      expect(plugin.components.has('floating-button')).toBe(true)

      // Test selection near bottom edge
      eventBus.emit('selection:detected', {
        selection: {
          text: 'Test',
          rect: {
            left: 100,
            top: 1000,
            right: 200,
            bottom: 1020,
            width: 100,
            height: 20
          }
        }
      })

      expect(plugin.components.has('floating-button')).toBe(true)
    })

    test('should emit ui:button-click event when button clicked', async () => {
      await plugin.renderButton({
        position: { x: 100, y: 100 }
      })

      // Simulate button click
      if (plugin.floatingButton && plugin.floatingButton.onClick) {
        plugin.floatingButton.onClick('play')
      }

      // Verify event was emitted
      const buttonClickEvents = eventBus.getEmittedEvents('ui:button-click')
      expect(buttonClickEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Progress Bar - Task 3 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should update progress bar on tts:progress events', async () => {
      // Emit progress events
      eventBus.emit('tts:progress', {
        progress: 25,
        progressMessage: 'Synthesizing...'
      })

      expect(plugin.currentProgress).toBe(25)
      expect(plugin.currentProgressMessage).toBe('Synthesizing...')

      eventBus.emit('tts:progress', {
        progress: 50,
        progressMessage: 'Playing...'
      })

      expect(plugin.currentProgress).toBe(50)
    })

    test('should show status messages correctly', async () => {
      const messages = [
        { progress: 0, message: 'Initializing...' },
        { progress: 25, message: 'Synthesizing...' },
        { progress: 75, message: 'Playing...' },
        { progress: 100, message: 'Complete' }
      ]

      for (const msg of messages) {
        eventBus.emit('tts:progress', {
          progress: msg.progress,
          progressMessage: msg.message
        })

        expect(plugin.currentProgress).toBe(msg.progress)
        expect(plugin.currentProgressMessage).toBe(msg.message)
      }
    })

    test('should update within 50ms performance target', async () => {
      await plugin.renderProgress({
        value: 0,
        message: 'Starting...'
      })

      const startTime = performance.now()

      await plugin.updateProgress(50, 'Processing...')

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Verify performance target (<50ms)
      expect(updateTime).toBeLessThan(50)
    })
  })

  describe('Control Panel - Task 4 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should render control panel with all controls', async () => {
      await plugin.renderControlPanel({
        position: { x: 0, y: 0 },
        voices: [
          { id: 'af_bella', name: 'Bella', gender: 'Female' },
          { id: 'af_nicole', name: 'Nicole', gender: 'Female' },
          { id: 'am_adam', name: 'Adam', gender: 'Male' }
        ],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      expect(plugin.components.has('control-panel')).toBe(true)
    })

    test('should emit play/pause/stop events', async () => {
      await plugin.renderControlPanel({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      eventBus.clearEmittedEvents()

      // Simulate play click
      if (plugin.controlPanel && plugin.controlPanel.onPlayClick) {
        plugin.controlPanel.onPlayClick()
      }

      expect(eventBus.getEmittedEvents('ui:play').length).toBeGreaterThan(0)

      // Simulate pause click
      if (plugin.controlPanel && plugin.controlPanel.onPauseClick) {
        plugin.controlPanel.onPauseClick()
      }

      expect(eventBus.getEmittedEvents('ui:pause').length).toBeGreaterThan(0)

      // Simulate stop click
      if (plugin.controlPanel && plugin.controlPanel.onStopClick) {
        plugin.controlPanel.onStopClick()
      }

      expect(eventBus.getEmittedEvents('ui:stop').length).toBeGreaterThan(0)
    })

    test('should emit voice change event', async () => {
      await plugin.renderControlPanel({
        voices: [
          { id: 'af_bella', name: 'Bella', gender: 'Female' },
          { id: 'af_nicole', name: 'Nicole', gender: 'Female' }
        ],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      eventBus.clearEmittedEvents()

      // Simulate voice change
      if (plugin.controlPanel && plugin.controlPanel.onVoiceChange) {
        plugin.controlPanel.onVoiceChange('af_nicole')
      }

      const voiceChangeEvents = eventBus.getEmittedEvents('ui:voice-change')
      expect(voiceChangeEvents.length).toBeGreaterThan(0)
      expect(voiceChangeEvents[0].data.voiceId).toBe('af_nicole')
    })

    test('should emit speed change event', async () => {
      await plugin.renderControlPanel({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      eventBus.clearEmittedEvents()

      // Simulate speed change
      if (plugin.controlPanel && plugin.controlPanel.onSpeedChange) {
        plugin.controlPanel.onSpeedChange(1.5)
      }

      const speedChangeEvents = eventBus.getEmittedEvents('ui:speed-change')
      expect(speedChangeEvents.length).toBeGreaterThan(0)
      expect(speedChangeEvents[0].data.speed).toBe(1.5)
    })
  })

  describe('Event Flow Integration - Task 8 Tests', () => {
    beforeEach(async () => {
      await plugin.init(eventBus, pal)
    })

    test('should show control panel on tts:started event', async () => {
      eventBus.emit('tts:started', {
        sessionId: 'test-session-1'
      })

      expect(plugin.panelVisible).toBe(true)
    })

    test('should hide control panel on tts:completed event', async () => {
      // First show the panel
      eventBus.emit('tts:started', {
        sessionId: 'test-session-1'
      })

      expect(plugin.panelVisible).toBe(true)

      // Then complete
      eventBus.emit('tts:completed', {
        sessionId: 'test-session-1'
      })

      // Wait for auto-hide delay
      await new Promise(resolve => setTimeout(resolve, 2100))

      expect(plugin.panelVisible).toBe(false)
    })

    test('should display error message on tts:error event', async () => {
      eventBus.emit('tts:error', {
        sessionId: 'test-session-1',
        error: {
          message: 'Synthesis failed'
        }
      })

      expect(plugin.currentProgressMessage).toContain('Error')
    })
  })

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      await plugin.init(eventBus, pal)

      const health = await plugin.healthCheck()

      expect(health.status).toBe('healthy')
      expect(health.id).toBe('ui-renderer')
      expect(health.version).toBe('1.0.0')
    })
  })

  describe('Cleanup', () => {
    test('should cleanup all components', async () => {
      await plugin.init(eventBus, pal)

      // Render some components
      await plugin.renderButton({ position: { x: 100, y: 100 } })
      await plugin.renderProgress({ value: 50, message: 'Test' })

      expect(plugin.components.size).toBeGreaterThan(0)

      // Cleanup
      await plugin.cleanup()

      expect(plugin.components.size).toBe(0)
      expect(plugin.activeComponents.size).toBe(0)
    })
  })
})

describe('Sample Test Text Scenarios', () => {
  let plugin
  let eventBus
  let pal

  beforeEach(async () => {
    eventBus = new MockEventBus()
    pal = new MockPAL()
    plugin = new UIRendererPlugin()
    await plugin.init(eventBus, pal)
  })

  afterEach(async () => {
    await plugin.cleanup()
  })

  test('should handle short text: "Hello world, this is a test."', async () => {
    const text = 'Hello world, this is a test.'

    eventBus.emit('tts:progress', {
      progress: 0,
      progressMessage: 'Initializing...'
    })

    eventBus.emit('tts:progress', {
      progress: 100,
      progressMessage: 'Complete'
    })

    expect(plugin.currentProgress).toBe(100)
  })

  test('should handle medium text: "The quick brown fox..."', async () => {
    const text = 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet and is commonly used for testing.'

    eventBus.emit('tts:progress', {
      progress: 25,
      progressMessage: 'Synthesizing...'
    })

    eventBus.emit('tts:progress', {
      progress: 75,
      progressMessage: 'Playing...'
    })

    eventBus.emit('tts:progress', {
      progress: 100,
      progressMessage: 'Complete'
    })

    expect(plugin.currentProgress).toBe(100)
  })
})
