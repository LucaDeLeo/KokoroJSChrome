/**
 * @module OffscreenAudioPlugin
 * @description Audio playback plugin using Chrome Offscreen API
 */

import { AudioManager } from './audio-manager.js'
import { StreamHandler } from './stream-handler.js'

/**
 * @typedef {Object} PlaybackState
 * @property {'idle'|'playing'|'paused'|'stopped'} status
 * @property {string|null} currentPlaybackId
 * @property {number} position
 * @property {number} duration
 */

/**
 * @typedef {Object} PlaybackOptions
 * @property {number} [volume] - Volume (0-1)
 * @property {number} [speed] - Playback speed (0.5-2.0)
 */

const MEMORY_THRESHOLD_MB = 500
const SESSION_THRESHOLD = 20
const OFFSCREEN_URL = 'plugins/offscreen-audio/src/offscreen.html'

class OffscreenAudioPlugin {
  constructor(config = {}) {
    this.id = 'offscreen-audio'
    this.name = 'OffscreenAudio'
    this.version = '1.0.0'
    this.stage = 'playback'
    this.config = config

    // Plugin dependencies
    this.eventBus = null
    this.pal = null

    // Audio management
    this.audioManager = null
    this.streamHandler = null

    // State tracking
    this.sessionCount = 0
    this.offscreenCreated = false
    this.currentPlaybackId = null

    // Performance tracking
    this.playbackCount = 0
    this.lastPlaybackTime = 0
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

      // Initialize audio manager
      this.audioManager = new AudioManager(pal, eventBus)
      await this.audioManager.init()

      // Initialize stream handler
      this.streamHandler = new StreamHandler(this.audioManager)

      // Subscribe to audio playback events
      this.eventBus.subscribe('audio:play', this._handlePlayEvent.bind(this))
      this.eventBus.subscribe('audio:pause', this._handlePauseEvent.bind(this))
      this.eventBus.subscribe('audio:resume', this._handleResumeEvent.bind(this))
      this.eventBus.subscribe('audio:stop', this._handleStopEvent.bind(this))

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

      // Only process events with audio output
      if (!event.output || !event.output.audio) {
        console.warn(`${this.name} received event without audio output`)
        return event
      }

      // Ensure offscreen document exists
      if (!this.offscreenCreated) {
        await this._ensureOffscreenDocument()
      }

      // Check if recycling is needed
      await this._checkRecycling()

      // Increment session counter
      this.sessionCount++
      this.playbackCount++

      // Start playback timing
      const startTime = performance.now()
      const playbackStartedTimestamp = Date.now()

      // Play audio through offscreen document
      const audioBuffer = event.output.audio
      const playbackId = `playback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      this.currentPlaybackId = playbackId

      // Update event metadata with playback start
      event.metadata.timing = event.metadata.timing || {}
      event.metadata.timing.playbackStarted = playbackStartedTimestamp

      // Start audio playback (non-blocking)
      const playbackPromise = this.audioManager.play(audioBuffer, {
        playbackId,
        volume: this.config.volume || 1.0,
        speed: this.config.speed || 1.0
      })

      // Emit playback started event
      this.eventBus.emit('audio:playbackStarted', {
        playbackId,
        timestamp: playbackStartedTimestamp,
        duration: event.output.duration
      })

      // Track playback completion separately (don't block event return)
      playbackPromise.then(() => {
        const endTime = performance.now()
        this.lastPlaybackTime = endTime - startTime

        event.metadata.timing.playbackCompleted = Date.now()

        this.eventBus.emit('audio:playbackCompleted', {
          playbackId,
          timestamp: Date.now(),
          latency: this.lastPlaybackTime
        })

        // Clear current playback ID
        if (this.currentPlaybackId === playbackId) {
          this.currentPlaybackId = null
        }
      }).catch(error => {
        console.error('Playback error:', error)
        this.eventBus.emit('audio:playbackError', {
          playbackId,
          error: error.message,
          timestamp: Date.now()
        })

        // Clear current playback ID on error
        if (this.currentPlaybackId === playbackId) {
          this.currentPlaybackId = null
        }
      })

      // Return event immediately (playback continues in background)
      return event

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
   * Play audio through offscreen document
   * @param {AudioBuffer} audioBuffer - Audio buffer to play
   * @param {PlaybackOptions} options - Playback options
   * @returns {Promise<void>}
   */
  async play(audioBuffer, options = {}) {
    await this._ensureOffscreenDocument()
    await this._checkRecycling()

    this.sessionCount++
    this.playbackCount++

    const playbackId = `playback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.currentPlaybackId = playbackId

    await this.audioManager.play(audioBuffer, { ...options, playbackId })
  }

  /**
   * Pause current playback
   */
  pause() {
    this.audioManager.pause()
  }

  /**
   * Resume paused playback
   */
  resume() {
    this.audioManager.resume()
  }

  /**
   * Stop current playback
   */
  stop() {
    this.audioManager.stop()
    this.currentPlaybackId = null
  }

  /**
   * Stream audio chunk
   * @param {AudioChunk} chunk - Audio chunk to stream
   * @returns {Promise<void>}
   */
  async streamChunk(chunk) {
    await this.streamHandler.streamChunk(chunk)
  }

  /**
   * Flush remaining stream data
   * @returns {Promise<void>}
   */
  async flushStream() {
    await this.streamHandler.flushStream()
  }

  /**
   * Get current playback state
   * @returns {PlaybackState}
   */
  getPlaybackState() {
    return this.audioManager.getPlaybackState()
  }

  /**
   * Set volume
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1')
    }
    this.config.volume = volume
    this.audioManager.setVolume(volume)
  }

  /**
   * Set playback speed
   * @param {number} speed - Speed (0.5-2.0)
   */
  setSpeed(speed) {
    if (speed < 0.5 || speed > 2.0) {
      throw new Error('Speed must be between 0.5 and 2.0')
    }
    this.config.speed = speed
    this.audioManager.setSpeed(speed)
  }

  /**
   * Recycle offscreen document
   * @returns {Promise<void>}
   */
  async recycle() {
    try {
      console.log(`${this.name} recycling offscreen document...`)

      // Stop current playback
      this.stop()

      // Close offscreen document
      if (this.offscreenCreated) {
        await this.pal.audio.closeOffscreen()
        this.offscreenCreated = false
      }

      // Reset counters
      this.sessionCount = 0

      console.log(`${this.name} recycled successfully`)
    } catch (error) {
      console.error(`${this.name} recycle error:`, error)
      throw error
    }
  }

  /**
   * Cleanup plugin resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      console.log(`${this.name} cleaning up...`)

      // Stop playback
      this.stop()

      // Cleanup audio manager
      if (this.audioManager) {
        await this.audioManager.cleanup()
      }

      // Close offscreen document
      if (this.offscreenCreated) {
        await this.pal.audio.closeOffscreen()
        this.offscreenCreated = false
      }

      // Clear references
      this.eventBus = null
      this.pal = null
      this.audioManager = null
      this.streamHandler = null

      // Reset counters
      this.sessionCount = 0
      this.playbackCount = 0
      this.lastPlaybackTime = 0
      this.currentPlaybackId = null

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
    const memoryInfo = this._getMemoryInfo()

    return {
      healthy: this.offscreenCreated,
      offscreenCreated: this.offscreenCreated,
      sessionCount: this.sessionCount,
      playbackCount: this.playbackCount,
      lastPlaybackTime: this.lastPlaybackTime,
      currentPlaybackId: this.currentPlaybackId,
      memoryUsageMB: memoryInfo.usedMB,
      initialized: this.eventBus !== null && this.pal !== null
    }
  }

  // Private methods

  /**
   * Ensure offscreen document is created
   * @private
   */
  async _ensureOffscreenDocument() {
    if (!this.offscreenCreated) {
      await this.pal.audio.createOffscreen(OFFSCREEN_URL)
      this.offscreenCreated = true
      console.log('Offscreen document created')
    }
  }

  /**
   * Check if recycling is needed and perform if necessary
   * @private
   */
  async _checkRecycling() {
    const memoryInfo = this._getMemoryInfo()
    const shouldRecycleMemory = memoryInfo.usedMB >= MEMORY_THRESHOLD_MB
    const shouldRecycleSessions = this.sessionCount >= SESSION_THRESHOLD

    if (shouldRecycleMemory || shouldRecycleSessions) {
      const reason = shouldRecycleMemory
        ? `memory threshold (${memoryInfo.usedMB}MB >= ${MEMORY_THRESHOLD_MB}MB)`
        : `session threshold (${this.sessionCount} >= ${SESSION_THRESHOLD})`

      console.log(`Recycling triggered by ${reason}`)
      await this.recycle()
    }
  }

  /**
   * Get current memory usage
   * @private
   * @returns {Object}
   */
  _getMemoryInfo() {
    if (performance.memory) {
      const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
      const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
      return { usedMB, totalMB }
    }
    return { usedMB: 0, totalMB: 0 }
  }

  // Event handlers

  async _handlePlayEvent(event) {
    try {
      await this.play(event.data.audioBuffer, event.data.options)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _handlePauseEvent(event) {
    try {
      this.pause()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _handleResumeEvent(event) {
    try {
      this.resume()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _handleStopEvent(event) {
    try {
      this.stop()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

export default OffscreenAudioPlugin