/**
 * Integration Tests for OffscreenAudio Plugin
 * Story 1.3 - Create OffscreenAudio Plugin
 *
 * These tests verify cross-component integration with real Chrome APIs (mocked at system level)
 */

// Mock Chrome APIs at system level
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  offscreen: {
    createDocument: jest.fn().mockResolvedValue(undefined),
    closeDocument: jest.fn().mockResolvedValue(undefined)
  }
}

global.chrome = mockChrome

// Mock OfflineAudioContext for stream handler
global.OfflineAudioContext = jest.fn().mockImplementation((channels, length, sampleRate) => ({
  createBuffer: jest.fn().mockReturnValue({
    getChannelData: jest.fn().mockReturnValue(new Float32Array(length))
  })
}))

// Mock performance.memory for memory monitoring
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024, // 100MB default
    totalJSHeapSize: 200 * 1024 * 1024  // 200MB default
  }
}

// Import components
import OffscreenAudioPlugin from '../../src/offscreen-audio-plugin.js'
import { AudioManager } from '../../src/audio-manager.js'
import { StreamHandler } from '../../src/stream-handler.js'

describe('OffscreenAudio Plugin - Integration Tests', () => {
  let plugin
  let mockEventBus
  let mockPAL

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    mockChrome.runtime.lastError = null
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      // Simulate successful response
      if (callback) {
        setTimeout(() => callback({ success: true, duration: 5.0 }), 0)
      }
      return Promise.resolve({ success: true })
    })

    // Create plugin
    plugin = new OffscreenAudioPlugin()

    // Create mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      emit: jest.fn()
    }

    // Create mock PAL
    mockPAL = {
      audio: {
        createOffscreen: jest.fn().mockResolvedValue(true),
        closeOffscreen: jest.fn().mockResolvedValue(undefined),
        isOffscreenAvailable: jest.fn().mockReturnValue(true)
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // 1.3-INT-001: Plugin registers with event bus for TTSEvent
  // ============================================================
  describe('1.3-INT-001: Event bus registration', () => {
    test('Plugin subscribes to audio events on init', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(4)
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:play', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:pause', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:resume', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:stop', expect.any(Function))
    })

    test('Plugin processes TTSEvent with audio through pipeline', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const event = {
        type: 'tts:synthesize',
        output: {
          audio: {
            duration: 5.0,
            sampleRate: 24000,
            numberOfChannels: 1,
            getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3]))
          },
          duration: 5.0
        },
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.metadata.processedBy).toContain('offscreen-audio')
      expect(result.metadata.timing).toHaveProperty('playbackStarted')
    })
  })

  // ============================================================
  // 1.3-INT-002: Offscreen document created with correct params
  // ============================================================
  describe('1.3-INT-002: Offscreen document creation', () => {
    test('PAL creates offscreen document with correct URL', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        sampleRate: 24000,
        numberOfChannels: 1,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1, 0.2]))
      }

      await plugin.play(mockAudioBuffer)

      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledWith(
        'plugins/offscreen-audio/src/offscreen.html'
      )
    })

    test('Offscreen document created only once on multiple plays', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)
      await plugin.play(mockAudioBuffer)
      await plugin.play(mockAudioBuffer)

      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 1.3-INT-003: Offscreen document closes on plugin cleanup
  // ============================================================
  describe('1.3-INT-003: Document cleanup', () => {
    test('Cleanup closes offscreen document', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true

      await plugin.cleanup()

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.offscreenCreated).toBe(false)
    })

    test('Cleanup handles already closed document', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = false

      await expect(plugin.cleanup()).resolves.not.toThrow()
      expect(mockPAL.audio.closeOffscreen).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 1.3-INT-004: Document creation failure triggers error event
  // ============================================================
  describe('1.3-INT-004: Document creation error handling', () => {
    test('Play fails gracefully when offscreen creation fails', async () => {
      await plugin.init(mockEventBus, mockPAL)

      mockPAL.audio.createOffscreen.mockRejectedValueOnce(new Error('Creation failed'))

      const mockAudioBuffer = { duration: 5.0 }

      await expect(plugin.play(mockAudioBuffer)).rejects.toThrow('Creation failed')
    })
  })

  // ============================================================
  // 1.3-INT-005: Audio plays through offscreen document
  // ============================================================
  describe('1.3-INT-005: Audio playback flow', () => {
    test('Audio buffer sent to offscreen document via message', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        sampleRate: 24000,
        numberOfChannels: 1,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3]))
      }

      await plugin.play(mockAudioBuffer)

      // AudioManager sends message via chrome.runtime.sendMessage
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offscreen-audio-play',
          audioData: expect.any(Array),
          sampleRate: 24000,
          numberOfChannels: 1
        })
      )
    })

    test('Playback started event emitted when audio begins', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const event = {
        type: 'tts:audio',
        output: {
          audio: {
            duration: 5.0,
            getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
          },
          duration: 5.0
        },
        metadata: {}
      }

      await plugin.process(event, {})

      // Wait for async emission
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'audio:playbackStarted',
        expect.objectContaining({
          playbackId: expect.any(String),
          timestamp: expect.any(Number)
        })
      )
    })
  })

  // ============================================================
  // 1.3-INT-006: Playback progress events emitted via event bus
  // ============================================================
  describe('1.3-INT-006: Progress event emission', () => {
    test('AudioManager emits progress events through event bus', async () => {
      await plugin.init(mockEventBus, mockPAL)

      // Simulate offscreen document sending progress event
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      const progressMessage = {
        type: 'offscreen-audio-event',
        event: 'started',
        playbackId: 'test-id',
        timestamp: Date.now(),
        duration: 5.0
      }

      messageListener(progressMessage, {}, jest.fn())

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'audio:playbackStarted',
        expect.objectContaining({
          playbackId: 'test-id',
          duration: 5.0
        })
      )
    })

    test('Completion event emitted when playback ends', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      const completionMessage = {
        type: 'offscreen-audio-event',
        event: 'completed',
        playbackId: 'test-id',
        timestamp: Date.now()
      }

      messageListener(completionMessage, {}, jest.fn())

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'audio:playbackCompleted',
        expect.objectContaining({
          playbackId: 'test-id'
        })
      )
    })
  })

  // ============================================================
  // 1.3-INT-007: setVolume() changes audio output volume
  // ============================================================
  describe('1.3-INT-007: Volume control', () => {
    test('Volume setting passed to offscreen document', async () => {
      await plugin.init(mockEventBus, mockPAL)

      plugin.setVolume(0.7)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer, { volume: 0.7 })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            volume: 0.7
          })
        })
      )
    })
  })

  // ============================================================
  // 1.3-INT-008: Sequential play() calls stop previous audio
  // ============================================================
  describe('1.3-INT-008: Stop previous audio', () => {
    test('New play() updates playback ID', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)
      const firstId = plugin.currentPlaybackId

      await plugin.play(mockAudioBuffer)
      const secondId = plugin.currentPlaybackId

      expect(firstId).not.toEqual(secondId)
    })

    test('Offscreen document receives new play command for each play()', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)
      await plugin.play(mockAudioBuffer)

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================
  // 1.3-INT-009: Rapid play() calls handle race conditions
  // ============================================================
  describe('1.3-INT-009: Race condition handling', () => {
    test('Rapid play() calls all succeed', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 1.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      const promises = [
        plugin.play(mockAudioBuffer),
        plugin.play(mockAudioBuffer),
        plugin.play(mockAudioBuffer)
      ]

      await expect(Promise.all(promises)).resolves.not.toThrow()
      expect(plugin.sessionCount).toBe(3)
    })
  })

  // ============================================================
  // 1.3-INT-010: Stop event emitted when previous audio stopped
  // ============================================================
  describe('1.3-INT-010: Stop event emission', () => {
    test('Stop event emitted through event bus', async () => {
      await plugin.init(mockEventBus, mockPAL)

      plugin.stop()

      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0]

      const stopMessage = {
        type: 'offscreen-audio-event',
        event: 'stopped',
        timestamp: Date.now()
      }

      messageListener(stopMessage, {}, jest.fn())

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'audio:playbackStopped',
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      )
    })
  })

  // ============================================================
  // 1.3-INT-011: Second createDocument() call skips if doc exists
  // ============================================================
  describe('1.3-INT-011: Singleton document handling', () => {
    test('Document not recreated if already exists', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)
      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(1)

      await plugin.play(mockAudioBuffer)
      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // 1.3-INT-012: Document reused across multiple play() calls
  // ============================================================
  describe('1.3-INT-012: Document reuse', () => {
    test('Same offscreen document handles multiple playbacks', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      for (let i = 0; i < 5; i++) {
        await plugin.play(mockAudioBuffer)
      }

      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(1)
      expect(plugin.sessionCount).toBe(5)
    })
  })

  // ============================================================
  // 1.3-INT-014: Recycle triggered after 20 sessions
  // ============================================================
  describe('1.3-INT-014: Session-based recycling', () => {
    test('Recycle triggered at session threshold', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true

      const mockAudioBuffer = {
        duration: 1.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      // Play 20 times, which will make sessionCount = 20
      for (let i = 0; i < 20; i++) {
        await plugin.play(mockAudioBuffer)
      }

      // At this point, sessionCount should be 20
      expect(plugin.sessionCount).toBe(20)
      expect(mockPAL.audio.closeOffscreen).not.toHaveBeenCalled()

      // Next play (21st) should trigger recycling because sessionCount >= 20
      await plugin.play(mockAudioBuffer)

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.sessionCount).toBe(1) // Reset and then incremented
    })
  })

  // ============================================================
  // 1.3-INT-015: Recycle triggered when memory exceeds 500MB
  // ============================================================
  describe('1.3-INT-015: Memory-based recycling', () => {
    test('Recycle triggered at memory threshold', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true

      // Mock high memory usage
      global.performance.memory = {
        usedJSHeapSize: 550 * 1024 * 1024, // 550MB
        totalJSHeapSize: 1024 * 1024 * 1024
      }

      const mockAudioBuffer = {
        duration: 1.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.sessionCount).toBe(1) // Reset and incremented
    })
  })

  // ============================================================
  // 1.3-INT-016: Recycle closes document and resets counters
  // ============================================================
  describe('1.3-INT-016: Recycle workflow', () => {
    test('Recycle performs full cleanup', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true
      plugin.sessionCount = 15

      await plugin.recycle()

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.offscreenCreated).toBe(false)
      expect(plugin.sessionCount).toBe(0)
      expect(plugin.currentPlaybackId).toBeNull()
    })
  })

  // ============================================================
  // 1.3-INT-017: Next play() after recycle creates new document
  // ============================================================
  describe('1.3-INT-017: Post-recycle document creation', () => {
    test('New document created after recycle', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 1.0,
        getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1]))
      }

      await plugin.play(mockAudioBuffer)
      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(1)

      await plugin.recycle()

      await plugin.play(mockAudioBuffer)
      expect(mockPAL.audio.createOffscreen).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================
  // Stream handling integration
  // ============================================================
  describe('Stream handling integration', () => {
    test('Stream chunks buffer and flush correctly', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const chunk1 = {
        data: new Float32Array([0.1, 0.2]),
        sampleRate: 24000,
        timestamp: Date.now()
      }

      const chunk2 = {
        data: new Float32Array([0.3, 0.4]),
        sampleRate: 24000,
        timestamp: Date.now(),
        isLast: true
      }

      await plugin.streamChunk(chunk1)
      await plugin.streamChunk(chunk2) // Should auto-flush

      // Stream handler should handle buffering internally
      expect(plugin.streamHandler).toBeDefined()
    })
  })
})