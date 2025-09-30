/**
 * @module KokoroEnginePlugin
 * @description Wraps existing kokoro.js TTS engine as a plugin
 */

import { KokoroTTS } from './kokoro.js'
import { VOICES } from './voices.js'

/**
 * @typedef {Object} KokoroVoice
 * @property {string} id - Voice identifier
 * @property {string} name - Display name
 * @property {string} language - Language code
 * @property {string} gender - Voice gender
 * @property {string} [traits] - Optional traits emoji
 */

/**
 * @typedef {Object} AudioResult
 * @property {Float32Array} buffer - Audio data
 * @property {number} sampleRate - Sample rate in Hz
 * @property {number} duration - Duration in seconds
 */

/**
 * @typedef {'unloaded'|'loading'|'loaded'|'error'} ModelStatus
 */

class KokoroEnginePlugin {
  constructor(config = {}) {
    this.id = 'kokoro-engine'
    this.name = 'KokoroEngine'
    this.version = '1.0.0'
    this.stage = 'synthesis'
    this.config = config

    // Plugin dependencies
    this.eventBus = null
    this.pal = null

    // TTS engine state
    this.ttsEngine = null
    this.modelStatus = 'unloaded'
    this.currentVoice = config.defaultVoice || 'af_bella'
    this.quality = config.quality || 'normal'
    this.batchSize = config.batchSize || 1
    this.speed = config.speed || 1.0

    // Performance tracking
    this.synthesisCount = 0
    this.lastSynthesisTime = 0
  }

  /**
   * Initialize plugin with event bus and platform abstraction layer
   * @param {Object} eventBus - Event bus instance
   * @param {Object} pal - Platform abstraction layer
   * @returns {Promise<boolean>}
   */
  async init(eventBus, pal) {
    try {
      if (!eventBus) {
        throw new Error('EventBus is required for plugin initialization')
      }
      if (!pal) {
        throw new Error('PAL is required for plugin initialization')
      }

      this.eventBus = eventBus
      this.pal = pal

      // Subscribe to TTS events
      this.eventBus.subscribe('tts:synthesize', this._handleSynthesisEvent.bind(this))
      this.eventBus.subscribe('tts:getVoices', this._handleGetVoicesEvent.bind(this))
      this.eventBus.subscribe('tts:setVoice', this._handleSetVoiceEvent.bind(this))

      console.log(`${this.name} v${this.version} initialized at stage: ${this.stage}`)
      return true
    } catch (error) {
      console.error(`Failed to initialize ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Process TTSEvent through the plugin
   * @param {Object} event - TTSEvent to process
   * @param {Object} context - Processing context
   * @returns {Promise<Object>}
   */
  async process(event, context) {
    try {
      // Validate event structure
      if (!event || !event.type) {
        throw new Error('Invalid event: missing type')
      }

      // Track processing
      event.metadata = event.metadata || {}
      event.metadata.processedBy = event.metadata.processedBy || []
      event.metadata.processedBy.push(this.id)

      // Route to appropriate handler
      switch (event.type) {
        case 'tts:synthesize':
          return await this._processSynthesis(event, context)
        case 'tts:getVoices':
          return await this._processGetVoices(event, context)
        case 'tts:setVoice':
          return await this._processSetVoice(event, context)
        default:
          console.warn(`${this.name} received unknown event type: ${event.type}`)
          return event
      }
    } catch (error) {
      console.error(`${this.name} process error:`, error)
      event.error = {
        message: error.message,
        plugin: this.id,
        timestamp: Date.now()
      }
      return event
    }
  }

  /**
   * Core synthesis method - wraps kokoro.js generate()
   * @param {Object} options - Synthesis options
   * @param {string} options.text - Text to synthesize
   * @param {string} [options.voice] - Voice ID
   * @param {number} [options.speed] - Speaking speed
   * @returns {Promise<AudioResult>}
   */
  async synthesize(options) {
    try {
      // Validate input
      if (!options || !options.text) {
        throw new Error('Text is required for synthesis')
      }

      const startTime = performance.now()

      // Ensure model is loaded
      if (this.modelStatus !== 'loaded') {
        await this.loadModel()
      }

      // Use provided voice or current voice
      const voice = options.voice || this.currentVoice
      const speed = options.speed || this.speed

      // Validate voice
      if (!Object.hasOwn(VOICES, voice)) {
        throw new Error(`Voice "${voice}" not found. Available voices: ${Object.keys(VOICES).join(', ')}`)
      }

      // Generate audio using original TTS engine
      const rawAudio = await this.ttsEngine.generate(options.text, { voice, speed })

      // Calculate metrics
      const endTime = performance.now()
      this.lastSynthesisTime = endTime - startTime
      this.synthesisCount++

      // Return structured AudioResult
      return {
        buffer: rawAudio.data,
        sampleRate: rawAudio.sampling_rate,
        duration: rawAudio.data.length / rawAudio.sampling_rate,
        metadata: {
          voice,
          speed,
          synthesisTime: this.lastSynthesisTime,
          textLength: options.text.length
        }
      }
    } catch (error) {
      console.error('Synthesis error:', error)
      throw error
    }
  }

  /**
   * List available voices
   * @returns {KokoroVoice[]}
   */
  listVoices() {
    return Object.entries(VOICES).map(([id, voice]) => ({
      id,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
      traits: voice.traits || ''
    }))
  }

  /**
   * Set current voice
   * @param {string} voiceId - Voice identifier
   */
  setVoice(voiceId) {
    if (!Object.hasOwn(VOICES, voiceId)) {
      throw new Error(`Voice "${voiceId}" not found`)
    }
    this.currentVoice = voiceId
    console.log(`Voice set to: ${voiceId} (${VOICES[voiceId].name})`)
  }

  /**
   * Load ONNX model
   * @returns {Promise<void>}
   */
  async loadModel() {
    if (this.modelStatus === 'loaded') {
      console.log('Model already loaded')
      return
    }

    if (this.modelStatus === 'loading') {
      console.log('Model is already loading')
      return
    }

    try {
      this.modelStatus = 'loading'
      console.log('Loading Kokoro TTS model...')

      const modelId = this.config.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX'
      const dtype = this.config.dtype || 'fp32'
      const device = this.config.device || null

      this.ttsEngine = await KokoroTTS.from_pretrained(modelId, {
        dtype,
        device,
        progress_callback: (progress) => {
          if (this.eventBus) {
            this.eventBus.emit('tts:modelLoadProgress', { progress })
          }
        }
      })

      this.modelStatus = 'loaded'
      console.log('Model loaded successfully')
    } catch (error) {
      this.modelStatus = 'error'
      console.error('Failed to load model:', error)
      throw error
    }
  }

  /**
   * Unload model and cleanup resources
   */
  unloadModel() {
    try {
      if (this.ttsEngine) {
        // Cleanup model resources
        this.ttsEngine = null
      }
      this.modelStatus = 'unloaded'
      console.log('Model unloaded and resources cleaned up')
    } catch (error) {
      console.error('Error unloading model:', error)
      throw error
    }
  }

  /**
   * Get current model status
   * @returns {ModelStatus}
   */
  getModelStatus() {
    return this.modelStatus
  }

  /**
   * Set synthesis quality
   * @param {'draft'|'normal'|'high'} quality - Quality setting
   */
  setQuality(quality) {
    const validQualities = ['draft', 'normal', 'high']
    if (!validQualities.includes(quality)) {
      throw new Error(`Invalid quality: ${quality}. Must be one of: ${validQualities.join(', ')}`)
    }
    this.quality = quality
    console.log(`Quality set to: ${quality}`)
  }

  /**
   * Set batch processing size
   * @param {number} size - Batch size (1-1000)
   */
  setBatchSize(size) {
    if (typeof size !== 'number' || size < 1 || size > 1000) {
      throw new Error('Batch size must be a number between 1 and 1000')
    }
    this.batchSize = size
    console.log(`Batch size set to: ${size}`)
  }

  /**
   * Cleanup plugin resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      console.log(`${this.name} cleaning up...`)

      // Unload model
      this.unloadModel()

      // Clear references
      this.eventBus = null
      this.pal = null

      // Reset counters
      this.synthesisCount = 0
      this.lastSynthesisTime = 0

      console.log(`${this.name} cleaned up successfully`)
    } catch (error) {
      console.error(`${this.name} cleanup error:`, error)
      throw error
    }
  }

  /**
   * Health check
   * @returns {Object}
   */
  async healthCheck() {
    return {
      healthy: this.modelStatus !== 'error',
      modelStatus: this.modelStatus,
      synthesisCount: this.synthesisCount,
      lastSynthesisTime: this.lastSynthesisTime,
      currentVoice: this.currentVoice,
      initialized: this.eventBus !== null && this.pal !== null
    }
  }

  // Private event handlers

  async _handleSynthesisEvent(event) {
    try {
      const result = await this.synthesize(event.data)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _handleGetVoicesEvent(event) {
    try {
      const voices = this.listVoices()
      return { success: true, data: voices }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _handleSetVoiceEvent(event) {
    try {
      this.setVoice(event.data.voiceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _processSynthesis(event, context) {
    const result = await this.synthesize(event.data)
    event.result = result
    event.completed = true
    return event
  }

  async _processGetVoices(event, context) {
    const voices = this.listVoices()
    event.result = voices
    event.completed = true
    return event
  }

  async _processSetVoice(event, context) {
    this.setVoice(event.data.voiceId)
    event.completed = true
    return event
  }
}

export default KokoroEnginePlugin