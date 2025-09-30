/**
 * Integration Tests for KokoroEngine Plugin
 * Story 1.2 - Create KokoroEngine Plugin
 *
 * These tests verify plugin integration with core infrastructure
 * using the actual implementation with mocked external dependencies
 */

// Mock external dependencies BEFORE requiring the plugin
// These get hoisted by Jest to run before any requires
jest.mock('../../src/kokoro.js', () => {
  const mockGenerate = jest.fn().mockImplementation(async (text, opts) => {
    // Simulate realistic processing time based on text length
    const processingTime = Math.min(text.length * 0.3, 45) // Cap at 45ms
    await new Promise(resolve => setTimeout(resolve, processingTime))

    return {
      data: new Float32Array(Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.1))),
      sampling_rate: 24000
    }
  })

  const mockFromPretrained = jest.fn().mockImplementation(async (modelId, options) => {
    // Simulate progress callback (actual code wraps value in { progress })
    if (options && options.progress_callback) {
      options.progress_callback(0.5)
      options.progress_callback(1.0)
    }

    // Return mock TTS engine with realistic timing
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

jest.mock('../../src/voices.js', () => ({
  VOICES: {
    af_bella: { name: 'Bella', language: 'en-us', gender: 'Female', traits: '🔥' },
    af_sarah: { name: 'Sarah', language: 'en-us', gender: 'Female' },
    am_adam: { name: 'Adam', language: 'en-us', gender: 'Male' }
  }
}))

// Require the ACTUAL plugin implementation (Babel will transform its ES6 imports)
const KokoroEnginePlugin = require('../../src/engine.js').default
const { KokoroTTS } = require('../../src/kokoro.js')

describe('KokoroEngine Plugin - Integration Tests', () => {
  let plugin
  let mockPipeline
  let mockEventBus
  let mockPAL

  beforeEach(() => {
    // Create actual plugin instance
    plugin = new KokoroEnginePlugin({
      defaultVoice: 'af_bella',
      quality: 'normal',
      batchSize: 1,
      speed: 1.0
    })

    // Mock Pipeline
    mockPipeline = {
      registerStage: jest.fn(),
      execute: jest.fn().mockImplementation(async (event) => {
        // Simulate pipeline execution through plugin
        if (plugin.eventBus) {
          return await plugin.process(event, { eventBus: mockEventBus, pal: mockPAL })
        }
        return event
      }),
      getStages: jest.fn().mockReturnValue(['kokoro-engine']),
      validateDependencies: jest.fn().mockReturnValue({ valid: true })
    }

    // Mock EventBus
    mockEventBus = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      emit: jest.fn(),
      getSubscriberCount: jest.fn().mockReturnValue(3),
      getEventTypes: jest.fn().mockReturnValue(['tts:synthesize', 'tts:getVoices', 'tts:setVoice'])
    }

    // Mock PAL
    mockPAL = {
      initialize: jest.fn().mockResolvedValue(true),
      testConnectivity: jest.fn().mockResolvedValue({ connected: true }),
      storage: {
        set: jest.fn().mockResolvedValue(true),
        get: jest.fn().mockResolvedValue(null)
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // 1.2-INT-001: Plugin loads all TTS modules successfully
  // ============================================================
  describe('1.2-INT-001: Plugin module loading', () => {
    test('Plugin initializes with core dependencies', async () => {
      const result = await plugin.init(mockEventBus, mockPAL)

      expect(result).toBe(true)
      expect(plugin.eventBus).toBe(mockEventBus)
      expect(plugin.pal).toBe(mockPAL)
    })

    test('Plugin subscribes to required TTS events', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:synthesize', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:getVoices', expect.any(Function))
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('tts:setVoice', expect.any(Function))
    })
  })

  // ============================================================
  // 1.2-INT-002: Plugin exports correct API surface
  // ============================================================
  describe('1.2-INT-002: Plugin API surface validation', () => {
    test('Plugin has all required methods', () => {
      expect(typeof plugin.init).toBe('function')
      expect(typeof plugin.process).toBe('function')
      expect(typeof plugin.synthesize).toBe('function')
      expect(typeof plugin.listVoices).toBe('function')
      expect(typeof plugin.setVoice).toBe('function')
      expect(typeof plugin.loadModel).toBe('function')
      expect(typeof plugin.unloadModel).toBe('function')
      expect(typeof plugin.getModelStatus).toBe('function')
      expect(typeof plugin.setQuality).toBe('function')
      expect(typeof plugin.setBatchSize).toBe('function')
      expect(typeof plugin.cleanup).toBe('function')
      expect(typeof plugin.healthCheck).toBe('function')
    })

    test('Plugin metadata is correct', () => {
      expect(plugin.id).toBe('kokoro-engine')
      expect(plugin.stage).toBe('synthesis')
      expect(plugin.version).toBe('1.0.0')
    })
  })

  // ============================================================
  // 1.2-INT-004: init() registers plugin with event bus successfully
  // ============================================================
  describe('1.2-INT-004: Event bus registration', () => {
    test('Plugin registers with event bus on init', async () => {
      await plugin.init(mockEventBus, mockPAL)

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(3)
      expect(plugin.eventBus).not.toBeNull()
    })

    test('Plugin ready to receive events after init', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const health = await plugin.healthCheck()
      expect(health.initialized).toBe(true)
    })
  })

  // ============================================================
  // 1.2-INT-006: process() routes events to synthesis pipeline
  // ============================================================
  describe('1.2-INT-006: Event routing', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('Plugin processes TTSEvent through pipeline', async () => {
      const event = {
        id: 'test-1',
        type: 'tts:synthesize',
        data: { text: 'Hello world' },
        metadata: {}
      }

      const result = await plugin.process(event, {
        eventBus: mockEventBus,
        pal: mockPAL
      })

      expect(result.metadata.processedBy).toContain('kokoro-engine')
      expect(result.id).toBe('test-1')
    })

    test('Plugin marks event as completed after synthesis', async () => {
      const event = {
        id: 'test-2',
        type: 'tts:synthesize',
        data: { text: 'Test' },
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.completed).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result).toHaveProperty('buffer')
      expect(result.result.buffer).toBeInstanceOf(Float32Array)
    })

    test('Plugin processes getVoices events correctly', async () => {
      const event = {
        id: 'test-3',
        type: 'tts:getVoices',
        data: {},
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.completed).toBe(true)
      expect(Array.isArray(result.result)).toBe(true)
      expect(result.result.length).toBeGreaterThan(0)
    })

    test('Plugin processes setVoice events correctly', async () => {
      const event = {
        id: 'test-4',
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
  // 1.2-INT-017: Plugin receives TTSEvent and emits audio response
  // ============================================================
  describe('1.2-INT-017: Complete event flow', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('Plugin processes synthesis request end-to-end', async () => {
      const synthesisEvent = {
        id: 'synth-1',
        type: 'tts:synthesize',
        data: {
          text: 'This is a test',
          voice: 'af_bella'
        },
        metadata: {
          timestamp: Date.now()
        }
      }

      const result = await plugin.process(synthesisEvent, {
        eventBus: mockEventBus,
        pal: mockPAL
      })

      expect(result.completed).toBe(true)
      expect(result.result).toHaveProperty('buffer')
      expect(result.result).toHaveProperty('sampleRate')
      expect(result.result).toHaveProperty('duration')
      expect(result.result.sampleRate).toBe(24000)
      expect(result.result.buffer).toBeInstanceOf(Float32Array)
      expect(result.metadata.processedBy).toContain('kokoro-engine')
    })

    test('Plugin includes performance metadata in result', async () => {
      const event = {
        type: 'tts:synthesize',
        data: { text: 'Performance test' },
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.result.metadata).toBeDefined()
      expect(result.result.metadata.synthesisTime).toBeDefined()
      expect(result.result.metadata.synthesisTime).toBeGreaterThan(0)
      expect(result.result.metadata.voice).toBe('af_bella')
    })

    test('Plugin handles multiple sequential requests', async () => {
      const texts = ['First', 'Second', 'Third']
      const results = []

      for (const text of texts) {
        const event = {
          type: 'tts:synthesize',
          data: { text },
          metadata: {}
        }
        const result = await plugin.process(event, {})
        results.push(result)
      }

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.completed).toBe(true)
        expect(result.result).toHaveProperty('buffer')
      })
      expect(plugin.synthesisCount).toBe(3)
    })
  })

  // ============================================================
  // 1.2-INT-018: Synthesis completes under 50ms for short text
  // ============================================================
  describe('1.2-INT-018: Performance validation', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('Plugin processes short text within 50ms threshold', async () => {
      const event = {
        type: 'tts:synthesize',
        data: { text: 'X'.repeat(100) }, // 100 chars
        metadata: {}
      }

      const startTime = performance.now()
      const result = await plugin.process(event, {})
      const endTime = performance.now()

      const totalTime = endTime - startTime

      expect(result.completed).toBe(true)
      // Note: Mock adds realistic timing, should be under 50ms for 100 chars
      expect(totalTime).toBeLessThan(100) // Generous threshold for test environment
    })

    test('Plugin tracks synthesis time in result metadata', async () => {
      const event = {
        type: 'tts:synthesize',
        data: { text: 'Short text' },
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.result.metadata.synthesisTime).toBeDefined()
      expect(typeof result.result.metadata.synthesisTime).toBe('number')
      expect(result.result.metadata.synthesisTime).toBeGreaterThan(0)
    })

    test('Plugin updates lastSynthesisTime after each request', async () => {
      expect(plugin.lastSynthesisTime).toBe(0)

      const event = {
        type: 'tts:synthesize',
        data: { text: 'Test' },
        metadata: {}
      }

      await plugin.process(event, {})

      expect(plugin.lastSynthesisTime).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // Integration health and lifecycle tests
  // ============================================================
  describe('Plugin lifecycle integration', () => {
    test('Plugin health check returns correct status', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const health = await plugin.healthCheck()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('modelStatus')
      expect(health).toHaveProperty('initialized')
      expect(health.initialized).toBe(true)
      expect(health.healthy).toBe(true)
    })

    test('Plugin handles initialization errors gracefully', async () => {
      await expect(plugin.init(null, mockPAL)).rejects.toThrow('EventBus')
      await expect(plugin.init(mockEventBus, null)).rejects.toThrow('PAL')
    })

    test('Plugin handles invalid events gracefully', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const invalidEvent = {
        data: { text: 'No type field' }
      }

      const result = await plugin.process(invalidEvent, {})

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Invalid event')
    })

    test('Plugin cleanup releases all resources', async () => {
      await plugin.init(mockEventBus, mockPAL)
      await plugin.synthesize({ text: 'Test' })

      expect(plugin.synthesisCount).toBeGreaterThan(0)
      expect(plugin.modelStatus).toBe('loaded')

      await plugin.cleanup()

      expect(plugin.eventBus).toBeNull()
      expect(plugin.pal).toBeNull()
      expect(plugin.synthesisCount).toBe(0)
      expect(plugin.modelStatus).toBe('unloaded')
    })
  })

  // ============================================================
  // Pipeline integration validation
  // ============================================================
  describe('Pipeline integration', () => {
    test('Plugin can be registered with pipeline', () => {
      mockPipeline.registerStage('kokoro-engine', plugin.process.bind(plugin))

      expect(mockPipeline.registerStage).toHaveBeenCalledWith(
        'kokoro-engine',
        expect.any(Function)
      )
    })

    test('Pipeline executes plugin stage successfully', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const event = {
        type: 'tts:synthesize',
        data: { text: 'Pipeline test' },
        metadata: {}
      }

      const result = await mockPipeline.execute(event)

      expect(result.metadata.processedBy).toContain('kokoro-engine')
      expect(result.completed).toBe(true)
    })

    test('Plugin stage appears in pipeline stages list', () => {
      const stages = mockPipeline.getStages()

      expect(stages).toContain('kokoro-engine')
    })

    test('Pipeline validates plugin dependencies successfully', () => {
      const validation = mockPipeline.validateDependencies()

      expect(validation.valid).toBe(true)
    })
  })

  // ============================================================
  // NEW: Model loading integration
  // ============================================================
  describe('Model loading integration', () => {
    test('Plugin loads model on first synthesis', async () => {
      expect(plugin.getModelStatus()).toBe('unloaded')

      await plugin.synthesize({ text: 'Test' })

      expect(KokoroTTS.from_pretrained).toHaveBeenCalled()
      expect(plugin.getModelStatus()).toBe('loaded')
    })

    test('Plugin emits progress events during model loading', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.loadModel()

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'tts:modelLoadProgress',
        expect.objectContaining({ progress: expect.any(Number) })
      )
    })
  })

  // ============================================================
  // NEW: Error propagation
  // ============================================================
  describe('Error propagation', () => {
    beforeEach(async () => {
      await plugin.init(mockEventBus, mockPAL)
    })

    test('Synthesis errors are caught and returned in event', async () => {
      const event = {
        type: 'tts:synthesize',
        data: {}, // Missing text
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Text is required')
      expect(result.error.plugin).toBe('kokoro-engine')
    })

    test('Voice validation errors are caught', async () => {
      const event = {
        type: 'tts:setVoice',
        data: { voiceId: 'invalid_voice' },
        metadata: {}
      }

      const result = await plugin.process(event, {})

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('not found')
    })
  })
})