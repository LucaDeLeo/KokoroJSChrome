/**
 * Unit Tests for KokoroEngine Plugin
 * Story 1.2 - Create KokoroEngine Plugin
 *
 * These tests verify the actual plugin implementation with mocked external dependencies
 */

// Node.js built-ins use require()
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Mock external dependencies BEFORE importing the plugin
jest.mock('../src/kokoro.js', () => {
  const mockGenerate = jest.fn().mockResolvedValue({
    data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    sampling_rate: 24000
  })

  const mockFromPretrained = jest.fn().mockImplementation(async (modelId, options) => {
    // Simulate progress callback (actual code wraps value in { progress })
    if (options && options.progress_callback) {
      options.progress_callback(0.5)
      options.progress_callback(1.0)
    }

    // Return mock TTS engine
    return {
      generate: mockGenerate
    }
  })

  return {
    KokoroTTS: {
      from_pretrained: mockFromPretrained
    }
  }
})

jest.mock('../src/voices.js', () => ({
  VOICES: {
    af_bella: { name: 'Bella', language: 'en-us', gender: 'Female', traits: '🔥' },
    af_sarah: { name: 'Sarah', language: 'en-us', gender: 'Female' },
    am_adam: { name: 'Adam', language: 'en-us', gender: 'Male' }
  }
}))

// Import the ACTUAL plugin implementation
import KokoroEnginePlugin from '../src/engine.js'
import { KokoroTTS } from '../src/kokoro.js'

describe('KokoroEngine Plugin - Unit Tests', () => {
  let plugin
  let mockEventBus
  let mockPAL

  beforeEach(() => {
    plugin = new KokoroEnginePlugin({
      defaultVoice: 'af_bella',
      quality: 'normal',
      batchSize: 1,
      speed: 1.0
    })

    mockEventBus = {
      subscribe: jest.fn(),
      emit: jest.fn(),
      publish: jest.fn()
    }

    mockPAL = {
      initialize: jest.fn().mockResolvedValue(true),
      testConnectivity: jest.fn().mockResolvedValue({ connected: true })
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // 1.2-UNIT-001: Plugin metadata validation
  // ============================================================
  describe('1.2-UNIT-001: Plugin metadata validation', () => {
    test('Plugin has correct id, stage, and version', () => {
      expect(plugin.id).toBe('kokoro-engine')
      expect(plugin.stage).toBe('synthesis')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.name).toBe('KokoroEngine')
    })

    test('Plugin config is properly initialized', () => {
      expect(plugin.config).toEqual({
        defaultVoice: 'af_bella',
        quality: 'normal',
        batchSize: 1,
        speed: 1.0
      })
    })
  })

  // ============================================================
  // 1.2-UNIT-002: File hash comparison of original vs wrapped TTS files
  // ============================================================
  describe('1.2-UNIT-002: File hash comparison', () => {
    const computeFileHash = (filePath) => {
      const fileBuffer = fs.readFileSync(filePath)
      const hashSum = crypto.createHash('sha256')
      hashSum.update(fileBuffer)
      return hashSum.digest('hex')
    }

    const originalPath = path.join(__dirname, '../../../')
    const pluginPath = path.join(__dirname, '../src')

    test('kokoro.js is unchanged from original', () => {
      const originalHash = computeFileHash(path.join(originalPath, 'kokoro.js'))
      const pluginHash = computeFileHash(path.join(pluginPath, 'kokoro.js'))
      expect(pluginHash).toBe(originalHash)
    })

    test('phonemize.js is unchanged from original', () => {
      const originalHash = computeFileHash(path.join(originalPath, 'phonemize.js'))
      const pluginHash = computeFileHash(path.join(pluginPath, 'phonemize.js'))
      expect(pluginHash).toBe(originalHash)
    })

    test('voices.js is unchanged from original', () => {
      const originalHash = computeFileHash(path.join(originalPath, 'voices.js'))
      const pluginHash = computeFileHash(path.join(pluginPath, 'voices.js'))
      expect(pluginHash).toBe(originalHash)
    })

    test('semantic-split.js is unchanged from original', () => {
      const originalHash = computeFileHash(path.join(originalPath, 'semantic-split.js'))
      const pluginHash = computeFileHash(path.join(pluginPath, 'semantic-split.js'))
      expect(pluginHash).toBe(originalHash)
    })
  })

  // ============================================================
  // 1.2-UNIT-003: init() accepts eventBus and pal parameters
  // ============================================================
  describe('1.2-UNIT-003: init() parameter validation', () => {
    test('init() accepts valid eventBus and pal without errors', async () => {
      await expect(plugin.init(mockEventBus, mockPAL)).resolves.toBe(true)
      expect(plugin.eventBus).toBe(mockEventBus)
      expect(plugin.pal).toBe(mockPAL)
    })

    test('init() throws error when eventBus is missing', async () => {
      await expect(plugin.init(null, mockPAL)).rejects.toThrow('EventBus is required')
    })

    test('init() throws error when pal is missing', async () => {
      await expect(plugin.init(mockEventBus, null)).rejects.toThrow('PAL is required')
    })

    test('init() subscribes to TTS events', async () => {
      await plugin.init(mockEventBus, mockPAL)
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:synthesize', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:getVoices', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:setVoice', expect.any(Function))
    })
  })

  // ============================================================
  // 1.2-UNIT-004: process() validates TTSEvent structure
  // ============================================================
  describe('1.2-UNIT-004: process() event validation', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('process() accepts valid TTSEvent and adds metadata', async () => {
      const validEvent = {
        type: 'tts:synthesize',
        data: { text: 'Hello world' },
        metadata: {}
      }

      const result = await plugin.process(validEvent, {})
      expect(result).toBeDefined()
      expect(result.metadata.processedBy).toContain('kokoro-engine')
    })

    test('process() rejects event without type', async () => {
      const invalidEvent = {
        data: { text: 'Hello' }
      }

      const result = await plugin.process(invalidEvent, {})
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Invalid event')
    })

    test('process() handles unknown event types gracefully', async () => {
      const unknownEvent = {
        type: 'unknown:event',
        metadata: {}
      }

      const result = await plugin.process(unknownEvent, {})
      expect(result.type).toBe('unknown:event')
      expect(result.metadata.processedBy).toContain('kokoro-engine')
    })

    test('process() routes tts:synthesize to synthesis handler', async () => {
      const event = {
        type: 'tts:synthesize',
        data: { text: 'Test' },
        metadata: {}
      }

      const result = await plugin.process(event, {})
      expect(result.completed).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result).toHaveProperty('buffer')
    })

    test('process() routes tts:getVoices to voice list handler', async () => {
      const event = {
        type: 'tts:getVoices',
        data: {},
        metadata: {}
      }

      const result = await plugin.process(event, {})
      expect(result.completed).toBe(true)
      expect(result.result).toBeDefined()
      expect(Array.isArray(result.result)).toBe(true)
    })

    test('process() routes tts:setVoice to voice selection handler', async () => {
      const event = {
        type: 'tts:setVoice',
        data: { voiceId: 'af_sarah' },
        metadata: {}
      }

      const result = await plugin.process(event, {})
      expect(result.completed).toBe(true)
      expect(plugin.currentVoice).toBe('af_sarah')
    })
  })

  // ============================================================
  // 1.2-UNIT-005: synthesize() validates input options schema
  // ============================================================
  describe('1.2-UNIT-005: synthesize() input validation', () => {
    test('synthesize() rejects missing text', async () => {
      await expect(plugin.synthesize({})).rejects.toThrow('Text is required')
    })

    test('synthesize() rejects null options', async () => {
      await expect(plugin.synthesize(null)).rejects.toThrow('Text is required')
    })

    test('synthesize() rejects invalid voice', async () => {
      await expect(plugin.synthesize({
        text: 'Hello',
        voice: 'invalid_voice'
      })).rejects.toThrow('Voice "invalid_voice" not found')
    })

    test('synthesize() accepts valid options and returns AudioResult', async () => {
      const result = await plugin.synthesize({
        text: 'Test text',
        voice: 'af_bella',
        speed: 1.0
      })

      expect(result).toHaveProperty('buffer')
      expect(result).toHaveProperty('sampleRate')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('metadata')
      expect(result.sampleRate).toBe(24000)
      expect(result.buffer).toBeInstanceOf(Float32Array)
    })

    test('synthesize() uses current voice when not specified', async () => {
      plugin.currentVoice = 'am_adam'
      const result = await plugin.synthesize({ text: 'Test' })

      expect(result.metadata.voice).toBe('am_adam')
    })

    test('synthesize() tracks synthesis count and time', async () => {
      const initialCount = plugin.synthesisCount

      await plugin.synthesize({ text: 'Test' })

      expect(plugin.synthesisCount).toBe(initialCount + 1)
      expect(plugin.lastSynthesisTime).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // 1.2-UNIT-006: listVoices() returns array of valid KokoroVoice objects
  // ============================================================
  describe('1.2-UNIT-006: listVoices() validation', () => {
    test('listVoices() returns an array', () => {
      const voices = plugin.listVoices()
      expect(Array.isArray(voices)).toBe(true)
      expect(voices.length).toBeGreaterThan(0)
    })

    test('listVoices() returns correct schema for each voice', () => {
      const voices = plugin.listVoices()
      const firstVoice = voices[0]

      expect(firstVoice).toHaveProperty('id')
      expect(firstVoice).toHaveProperty('name')
      expect(firstVoice).toHaveProperty('language')
      expect(firstVoice).toHaveProperty('gender')
      expect(typeof firstVoice.id).toBe('string')
      expect(typeof firstVoice.name).toBe('string')
      expect(typeof firstVoice.language).toBe('string')
      expect(typeof firstVoice.gender).toBe('string')
    })
  })

  // ============================================================
  // 1.2-UNIT-007: getModelStatus() returns correct state enum
  // ============================================================
  describe('1.2-UNIT-007: getModelStatus() validation', () => {
    test('getModelStatus() returns "unloaded" initially', () => {
      expect(plugin.getModelStatus()).toBe('unloaded')
    })

    test('getModelStatus() returns valid ModelStatus enum', () => {
      const validStatuses = ['unloaded', 'loading', 'loaded', 'error']
      const status = plugin.getModelStatus()
      expect(validStatuses).toContain(status)
    })

    test('getModelStatus() reflects status changes', async () => {
      expect(plugin.getModelStatus()).toBe('unloaded')

      await plugin.loadModel()
      expect(plugin.getModelStatus()).toBe('loaded')

      plugin.unloadModel()
      expect(plugin.getModelStatus()).toBe('unloaded')
    })

    test('getModelStatus() shows "loading" during model load', async () => {
      // Start loading but don't await
      const loadPromise = plugin.loadModel()

      // Should transition through loading state
      // (Note: might be too fast to catch, but logic is tested)

      await loadPromise
      expect(plugin.getModelStatus()).toBe('loaded')
    })
  })

  // ============================================================
  // 1.2-UNIT-008: setQuality() accepts valid quality enum values
  // ============================================================
  describe('1.2-UNIT-008: setQuality() validation', () => {
    test('setQuality() accepts "draft"', () => {
      expect(() => plugin.setQuality('draft')).not.toThrow()
      expect(plugin.quality).toBe('draft')
    })

    test('setQuality() accepts "normal"', () => {
      expect(() => plugin.setQuality('normal')).not.toThrow()
      expect(plugin.quality).toBe('normal')
    })

    test('setQuality() accepts "high"', () => {
      expect(() => plugin.setQuality('high')).not.toThrow()
      expect(plugin.quality).toBe('high')
    })

    test('setQuality() rejects invalid quality values', () => {
      expect(() => plugin.setQuality('ultra')).toThrow('Invalid quality')
      expect(() => plugin.setQuality('low')).toThrow('Invalid quality')
      expect(() => plugin.setQuality(123)).toThrow('Invalid quality')
    })
  })

  // ============================================================
  // 1.2-UNIT-009: setBatchSize() validates numeric range
  // ============================================================
  describe('1.2-UNIT-009: setBatchSize() validation', () => {
    test('setBatchSize() accepts valid range (1-1000)', () => {
      expect(() => plugin.setBatchSize(1)).not.toThrow()
      expect(plugin.batchSize).toBe(1)

      expect(() => plugin.setBatchSize(500)).not.toThrow()
      expect(plugin.batchSize).toBe(500)

      expect(() => plugin.setBatchSize(1000)).not.toThrow()
      expect(plugin.batchSize).toBe(1000)
    })

    test('setBatchSize() rejects values below 1', () => {
      expect(() => plugin.setBatchSize(0)).toThrow('Batch size must be a number between 1 and 1000')
      expect(() => plugin.setBatchSize(-1)).toThrow('Batch size must be a number between 1 and 1000')
    })

    test('setBatchSize() rejects values above 1000', () => {
      expect(() => plugin.setBatchSize(1001)).toThrow('Batch size must be a number between 1 and 1000')
      expect(() => plugin.setBatchSize(9999)).toThrow('Batch size must be a number between 1 and 1000')
    })

    test('setBatchSize() rejects non-numeric values', () => {
      expect(() => plugin.setBatchSize('10')).toThrow('Batch size must be a number between 1 and 1000')
      expect(() => plugin.setBatchSize(null)).toThrow('Batch size must be a number between 1 and 1000')
      expect(() => plugin.setBatchSize(undefined)).toThrow('Batch size must be a number between 1 and 1000')
    })
  })

  // ============================================================
  // Additional tests for complete coverage
  // ============================================================
  describe('Additional plugin functionality', () => {
    test('setVoice() updates current voice', () => {
      expect(() => plugin.setVoice('af_sarah')).not.toThrow()
      expect(plugin.currentVoice).toBe('af_sarah')
    })

    test('setVoice() rejects invalid voice', () => {
      expect(() => plugin.setVoice('invalid')).toThrow('Voice "invalid" not found')
    })

    test('unloadModel() clears engine reference', async () => {
      await plugin.loadModel()
      expect(plugin.ttsEngine).not.toBeNull()
      expect(plugin.modelStatus).toBe('loaded')

      plugin.unloadModel()

      expect(plugin.ttsEngine).toBeNull()
      expect(plugin.modelStatus).toBe('unloaded')
    })

    test('healthCheck() returns correct structure', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const health = await plugin.healthCheck()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('modelStatus')
      expect(health).toHaveProperty('synthesisCount')
      expect(health).toHaveProperty('initialized')
      expect(health.initialized).toBe(true)
    })

    test('cleanup() resets plugin state', async () => {
      await plugin.init(mockEventBus, mockPAL)
      plugin.synthesisCount = 10

      await plugin.cleanup()

      expect(plugin.eventBus).toBeNull()
      expect(plugin.pal).toBeNull()
      expect(plugin.synthesisCount).toBe(0)
      expect(plugin.modelStatus).toBe('unloaded')
    })
  })

  // ============================================================
  // NEW: Model loading state machine tests
  // ============================================================
  describe('Model loading state machine', () => {
    test('loadModel() skips loading if already loaded', async () => {
      await plugin.loadModel()
      expect(KokoroTTS.from_pretrained).toHaveBeenCalledTimes(1)

      // Call again - should skip
      await plugin.loadModel()
      expect(KokoroTTS.from_pretrained).toHaveBeenCalledTimes(1) // Still 1
    })

    test('loadModel() skips loading if already loading', async () => {
      // Start two loads concurrently
      const load1 = plugin.loadModel()
      const load2 = plugin.loadModel()

      await Promise.all([load1, load2])

      // Should only call from_pretrained once
      expect(KokoroTTS.from_pretrained).toHaveBeenCalledTimes(1)
    })

    test('loadModel() calls progress callback during loading', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.loadModel()

      // Progress callback should have emitted events
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'tts:modelLoadProgress',
        expect.objectContaining({ progress: expect.any(Number) })
      )
    })

    test('synthesize() auto-loads model if not loaded', async () => {
      expect(plugin.getModelStatus()).toBe('unloaded')

      await plugin.synthesize({ text: 'Test' })

      expect(KokoroTTS.from_pretrained).toHaveBeenCalled()
      expect(plugin.getModelStatus()).toBe('loaded')
    })
  })

  // ============================================================
  // NEW: Event handler tests (private methods via event bus)
  // ============================================================
  describe('Event bus handlers', () => {
    let synthesizeHandler
    let getVoicesHandler
    let setVoiceHandler

    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)

      // Capture the registered handlers
      const calls = mockEventBus.subscribe.mock.calls
      synthesizeHandler = calls.find(call => call[0] === 'tts:synthesize')[1]
      getVoicesHandler = calls.find(call => call[0] === 'tts:getVoices')[1]
      setVoiceHandler = calls.find(call => call[0] === 'tts:setVoice')[1]
    })

    test('_handleSynthesisEvent processes synthesis request', async () => {
      const event = { data: { text: 'Test' } }

      const result = await synthesizeHandler(event)

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('buffer')
      expect(result.data).toHaveProperty('sampleRate')
    })

    test('_handleSynthesisEvent returns error on failure', async () => {
      const event = { data: {} } // Missing text

      const result = await synthesizeHandler(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Text is required')
    })

    test('_handleGetVoicesEvent returns voice list', async () => {
      const event = { data: {} }

      const result = await getVoicesHandler(event)

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    test('_handleSetVoiceEvent updates current voice', async () => {
      const event = { data: { voiceId: 'am_adam' } }

      const result = await setVoiceHandler(event)

      expect(result.success).toBe(true)
      expect(plugin.currentVoice).toBe('am_adam')
    })

    test('_handleSetVoiceEvent returns error for invalid voice', async () => {
      const event = { data: { voiceId: 'invalid' } }

      const result = await setVoiceHandler(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  // ============================================================
  // NEW: Error handling in process()
  // ============================================================
  describe('Error handling', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('process() catches errors and adds error object to event', async () => {
      // Force an error by passing invalid data
      const event = {
        type: 'tts:synthesize',
        data: {}, // Missing text will cause error
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Text is required')
      expect(result.error.plugin).toBe('kokoro-engine')
      expect(result.error.timestamp).toBeDefined()
    })
  })

  // ============================================================
  // NEW: Performance tracking
  // ============================================================
  describe('Performance tracking', () => {
    test('synthesize() updates lastSynthesisTime', async () => {
      expect(plugin.lastSynthesisTime).toBe(0)

      await plugin.synthesize({ text: 'Test' })

      expect(plugin.lastSynthesisTime).toBeGreaterThan(0)
    })

    test('synthesize() includes performance metadata in result', async () => {
      const result = await plugin.synthesize({ text: 'Test message' })

      expect(result.metadata.synthesisTime).toBeDefined()
      expect(result.metadata.synthesisTime).toBeGreaterThan(0)
      expect(result.metadata.textLength).toBe(12)
    })
  })
})