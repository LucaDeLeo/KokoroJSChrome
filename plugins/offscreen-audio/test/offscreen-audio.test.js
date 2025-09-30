/**
 * Unit Tests for OffscreenAudio Plugin
 * Story 1.3 - Create OffscreenAudio Plugin
 *
 * These tests verify the plugin implementation with mocked external dependencies
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  offscreen: {
    createDocument: jest.fn(),
    closeDocument: jest.fn()
  }
}

// Mock performance.memory
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 100 * 1024 * 1024, // 100MB
    totalJSHeapSize: 200 * 1024 * 1024  // 200MB
  }
}

// Mock AudioManager
jest.mock('../src/audio-manager.js', () => {
  return {
    AudioManager: jest.fn().mockImplementation(() => ({
      init: jest.fn().mockResolvedValue(undefined),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(),
      getPlaybackState: jest.fn().mockReturnValue({
        status: 'idle',
        currentPlaybackId: null,
        position: 0,
        duration: 0
      }),
      setVolume: jest.fn(),
      setSpeed: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }))
  }
})

// Mock StreamHandler
jest.mock('../src/stream-handler.js', () => {
  return {
    StreamHandler: jest.fn().mockImplementation(() => ({
      streamChunk: jest.fn().mockResolvedValue(undefined),
      flushStream: jest.fn().mockResolvedValue(undefined),
      getStreamState: jest.fn().mockReturnValue({
        isStreaming: false,
        streamId: null,
        bufferedChunks: 0,
        totalDuration: 0
      })
    }))
  }
})

// Import plugin after mocks
import OffscreenAudioPlugin from '../src/offscreen-audio-plugin.js'
import { AudioManager } from '../src/audio-manager.js'
import { StreamHandler } from '../src/stream-handler.js'

describe('OffscreenAudio Plugin - Unit Tests', () => {
  let plugin
  let mockEventBus
  let mockPAL

  beforeEach(() => {
    // Create fresh plugin instance
    plugin = new OffscreenAudioPlugin({
      volume: 1.0,
      speed: 1.0
    })

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

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // 1.3-UNIT-001: Plugin initialization with valid eventBus and PAL
  // ============================================================
  describe('1.3-UNIT-001: Plugin initialization success', () => {
    test('Plugin has correct id, stage, and version', () => {
      expect(plugin.id).toBe('offscreen-audio')
      expect(plugin.stage).toBe('playback')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.name).toBe('OffscreenAudio')
    })

    test('init() accepts valid eventBus and pal without errors', async () => {
      await expect(plugin.init(mockEventBus, mockPAL)).resolves.toBe(true)
      expect(plugin.eventBus).toBe(mockEventBus)
      expect(plugin.pal).toBe(mockPAL)
    })

    test('init() initializes audio manager', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(AudioManager).toHaveBeenCalledWith(mockPAL, mockEventBus)
      expect(plugin.audioManager).toBeDefined()
      expect(plugin.audioManager.init).toHaveBeenCalled()
    })

    test('init() initializes stream handler', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(StreamHandler).toHaveBeenCalled()
      expect(plugin.streamHandler).toBeDefined()
    })

    test('init() subscribes to audio events', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:play', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:pause', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:resume', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('audio:stop', expect.any(Function))
    })
  })

  // ============================================================
  // 1.3-UNIT-002: Plugin initialization fails with missing eventBus
  // ============================================================
  describe('1.3-UNIT-002: Plugin initialization failure', () => {
    test('init() throws error when eventBus is missing', async () => {
      await expect(plugin.init(null, mockPAL)).rejects.toThrow('EventBus is required')
    })

    test('init() throws error when pal is missing', async () => {
      await expect(plugin.init(mockEventBus, null)).rejects.toThrow('PAL is required')
    })
  })

  // ============================================================
  // 1.3-UNIT-003: Plugin cleanup releases all resources
  // ============================================================
  describe('1.3-UNIT-003: Plugin cleanup', () => {
    test('cleanup() stops playback and closes offscreen document', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true

      // Store references to spy on them before cleanup nullifies them
      const stopSpy = plugin.audioManager.stop
      const cleanupSpy = plugin.audioManager.cleanup

      await plugin.cleanup()

      expect(stopSpy).toHaveBeenCalled()
      expect(cleanupSpy).toHaveBeenCalled()
      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
    })

    test('cleanup() resets plugin state', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.sessionCount = 10
      plugin.playbackCount = 5
      plugin.currentPlaybackId = 'test-id'

      await plugin.cleanup()

      expect(plugin.eventBus).toBeNull()
      expect(plugin.pal).toBeNull()
      expect(plugin.sessionCount).toBe(0)
      expect(plugin.playbackCount).toBe(0)
      expect(plugin.currentPlaybackId).toBeNull()
    })

    test('cleanup() handles missing offscreen document gracefully', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = false

      await expect(plugin.cleanup()).resolves.not.toThrow()
      expect(mockPAL.audio.closeOffscreen).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 1.3-UNIT-004: play() method accepts AudioBuffer and options
  // ============================================================
  describe('1.3-UNIT-004: play() method', () => {
    test('play() accepts AudioBuffer and options', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const mockAudioBuffer = {
        duration: 5.0,
        sampleRate: 24000,
        numberOfChannels: 1
      }

      await expect(plugin.play(mockAudioBuffer, { volume: 0.8 })).resolves.not.toThrow()
      expect(plugin.audioManager.play).toHaveBeenCalledWith(
        mockAudioBuffer,
        expect.objectContaining({ volume: 0.8 })
      )
    })

    test('play() creates offscreen document if not created', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = false

      const mockAudioBuffer = { duration: 5.0 }

      await plugin.play(mockAudioBuffer)

      expect(mockPAL.audio.createOffscreen).toHaveBeenCalled()
      expect(plugin.offscreenCreated).toBe(true)
    })

    test('play() increments session counter', async () => {
      await plugin.init(mockEventBus, mockPAL)
      const initialCount = plugin.sessionCount

      await plugin.play({ duration: 5.0 })

      expect(plugin.sessionCount).toBe(initialCount + 1)
    })
  })

  // ============================================================
  // 1.3-UNIT-005: pause() method stops playback without cleanup
  // ============================================================
  describe('1.3-UNIT-005: pause() method', () => {
    test('pause() calls audio manager pause', () => {
      plugin.audioManager = { pause: jest.fn() }

      plugin.pause()

      expect(plugin.audioManager.pause).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 1.3-UNIT-006: resume() method continues paused playback
  // ============================================================
  describe('1.3-UNIT-006: resume() method', () => {
    test('resume() calls audio manager resume', () => {
      plugin.audioManager = { resume: jest.fn() }

      plugin.resume()

      expect(plugin.audioManager.resume).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 1.3-UNIT-007: stop() method ends playback and cleans up
  // ============================================================
  describe('1.3-UNIT-007: stop() method', () => {
    test('stop() calls audio manager stop', () => {
      plugin.audioManager = { stop: jest.fn() }

      plugin.stop()

      expect(plugin.audioManager.stop).toHaveBeenCalled()
    })

    test('stop() clears current playback ID', () => {
      plugin.audioManager = { stop: jest.fn() }
      plugin.currentPlaybackId = 'test-id'

      plugin.stop()

      expect(plugin.currentPlaybackId).toBeNull()
    })
  })

  // ============================================================
  // 1.3-UNIT-008: getPlaybackState() returns current state
  // ============================================================
  describe('1.3-UNIT-008: getPlaybackState()', () => {
    test('getPlaybackState() returns playback state from audio manager', () => {
      const mockState = {
        status: 'playing',
        currentPlaybackId: 'test-id',
        position: 2.5,
        duration: 10.0
      }

      plugin.audioManager = {
        getPlaybackState: jest.fn().mockReturnValue(mockState)
      }

      const state = plugin.getPlaybackState()

      expect(state).toEqual(mockState)
      expect(plugin.audioManager.getPlaybackState).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 1.3-UNIT-009: New play() call stops any active playback
  // ============================================================
  describe('1.3-UNIT-009: Stop previous audio behavior', () => {
    test('process() increments session count for each TTSEvent', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const event1 = {
        type: 'tts:audio',
        output: { audio: { duration: 5.0 }, duration: 5.0 },
        metadata: {}
      }

      const initialCount = plugin.sessionCount

      await plugin.process(event1, {})

      expect(plugin.sessionCount).toBe(initialCount + 1)
    })

    test('Multiple play() calls update currentPlaybackId', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.play({ duration: 5.0 })
      const firstId = plugin.currentPlaybackId

      await plugin.play({ duration: 3.0 })
      const secondId = plugin.currentPlaybackId

      expect(firstId).not.toEqual(secondId)
    })
  })

  // ============================================================
  // 1.3-UNIT-010: Document existence check
  // ============================================================
  describe('1.3-UNIT-010: Document existence check', () => {
    test('offscreenCreated flag tracks document state', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(plugin.offscreenCreated).toBe(false)

      await plugin.play({ duration: 5.0 })

      expect(plugin.offscreenCreated).toBe(true)
    })
  })

  // ============================================================
  // 1.3-UNIT-011: Session counter increments on each play() call
  // ============================================================
  describe('1.3-UNIT-011: Session counter', () => {
    test('Session counter starts at 0', () => {
      expect(plugin.sessionCount).toBe(0)
    })

    test('Session counter increments on play()', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(plugin.sessionCount).toBe(0)

      await plugin.play({ duration: 5.0 })
      expect(plugin.sessionCount).toBe(1)

      await plugin.play({ duration: 3.0 })
      expect(plugin.sessionCount).toBe(2)
    })

    test('Session counter resets on cleanup()', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.play({ duration: 5.0 })
      expect(plugin.sessionCount).toBe(1)

      await plugin.cleanup()
      expect(plugin.sessionCount).toBe(0)
    })
  })

  // ============================================================
  // 1.3-UNIT-012: Memory threshold check
  // ============================================================
  describe('1.3-UNIT-012: Memory threshold check', () => {
    test('_getMemoryInfo() returns memory usage', () => {
      const memoryInfo = plugin._getMemoryInfo()

      expect(memoryInfo).toHaveProperty('usedMB')
      expect(memoryInfo).toHaveProperty('totalMB')
      expect(typeof memoryInfo.usedMB).toBe('number')
    })

    test('_getMemoryInfo() handles missing performance.memory', () => {
      const originalMemory = performance.memory
      delete performance.memory

      const memoryInfo = plugin._getMemoryInfo()

      expect(memoryInfo).toEqual({ usedMB: 0, totalMB: 0 })

      performance.memory = originalMemory
    })
  })

  // ============================================================
  // Additional tests for complete coverage
  // ============================================================
  describe('Additional plugin functionality', () => {
    test('setVolume() updates config and audio manager', () => {
      plugin.audioManager = { setVolume: jest.fn() }

      plugin.setVolume(0.7)

      expect(plugin.config.volume).toBe(0.7)
      expect(plugin.audioManager.setVolume).toHaveBeenCalledWith(0.7)
    })

    test('setVolume() validates range', () => {
      expect(() => plugin.setVolume(-0.1)).toThrow('Volume must be between 0 and 1')
      expect(() => plugin.setVolume(1.5)).toThrow('Volume must be between 0 and 1')
    })

    test('setSpeed() updates config and audio manager', () => {
      plugin.audioManager = { setSpeed: jest.fn() }

      plugin.setSpeed(1.5)

      expect(plugin.config.speed).toBe(1.5)
      expect(plugin.audioManager.setSpeed).toHaveBeenCalledWith(1.5)
    })

    test('setSpeed() validates range', () => {
      expect(() => plugin.setSpeed(0.4)).toThrow('Speed must be between 0.5 and 2.0')
      expect(() => plugin.setSpeed(2.5)).toThrow('Speed must be between 0.5 and 2.0')
    })

    test('recycle() closes offscreen and resets counters', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true
      plugin.sessionCount = 15

      await plugin.recycle()

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.offscreenCreated).toBe(false)
      expect(plugin.sessionCount).toBe(0)
    })

    test('healthCheck() returns correct structure', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const health = await plugin.healthCheck()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('offscreenCreated')
      expect(health).toHaveProperty('sessionCount')
      expect(health).toHaveProperty('playbackCount')
      expect(health).toHaveProperty('memoryUsageMB')
      expect(health).toHaveProperty('initialized')
      expect(health.initialized).toBe(true)
    })

    test('process() handles events without audio gracefully', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const event = {
        type: 'tts:text',
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result).toBe(event)
      expect(plugin.audioManager.play).not.toHaveBeenCalled()
    })

    test('streamChunk() forwards to stream handler', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const chunk = {
        data: new Float32Array([0.1, 0.2]),
        sampleRate: 24000,
        timestamp: Date.now()
      }

      await plugin.streamChunk(chunk)

      expect(plugin.streamHandler.streamChunk).toHaveBeenCalledWith(chunk)
    })

    test('flushStream() forwards to stream handler', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.flushStream()

      expect(plugin.streamHandler.flushStream).toHaveBeenCalled()
    })
  })

  // ============================================================
  // Recycling logic tests
  // ============================================================
  describe('Recycling logic', () => {
    test('_checkRecycling() triggers recycle on session threshold', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true
      plugin.sessionCount = 20

      await plugin._checkRecycling()

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.sessionCount).toBe(0)
    })

    test('_checkRecycling() triggers recycle on memory threshold', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true

      // Mock high memory usage
      global.performance.memory = {
        usedJSHeapSize: 550 * 1024 * 1024, // 550MB
        totalJSHeapSize: 1024 * 1024 * 1024
      }

      await plugin._checkRecycling()

      expect(mockPAL.audio.closeOffscreen).toHaveBeenCalled()
      expect(plugin.sessionCount).toBe(0)
    })

    test('_checkRecycling() does not recycle below thresholds', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.offscreenCreated = true
      plugin.sessionCount = 10

      // Mock low memory usage
      global.performance.memory = {
        usedJSHeapSize: 100 * 1024 * 1024, // 100MB
        totalJSHeapSize: 200 * 1024 * 1024
      }

      await plugin._checkRecycling()

      expect(mockPAL.audio.closeOffscreen).not.toHaveBeenCalled()
      expect(plugin.sessionCount).toBe(10)
    })
  })
})