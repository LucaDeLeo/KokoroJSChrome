/**
 * @module QueueManagerPlugin
 * @description Queue manager plugin with "stop previous" behavior for TTS requests
 */

/**
 * @typedef {Object} TTSSession
 * @property {string} sessionId - UUID
 * @property {number} tabId - Chrome tab ID
 * @property {'queued'|'playing'|'paused'|'stopped'|'completed'} status - Session status
 * @property {string} text - Text being synthesized
 * @property {string} [textId] - Reference to IndexedDB if large (>50KB)
 * @property {string} voiceId - Selected Kokoro voice
 * @property {number} speed - Playback rate (0.5-3.0)
 * @property {number} progress - Current position (0-100)
 * @property {number} startTime - Session start time
 * @property {number} [pausedTime] - Time when paused
 * @property {number} [resumeTime] - Time when resumed
 */

/**
 * @typedef {Object} QueueConfig
 * @property {number} [maxQueueSize] - Maximum queue size
 * @property {boolean} [stopPrevious] - Stop previous audio on new request
 * @property {number} [sessionTimeout] - Session timeout in ms
 * @property {boolean} [persistState] - Persist state to chrome.storage.local
 */

class QueueManagerPlugin {
  constructor(config = {}) {
    this.id = 'queue-manager'
    this.name = 'QueueManager'
    this.version = '1.0.0'
    this.stage = 'queue'
    this.config = config

    // Plugin dependencies
    this.eventBus = null
    this.pal = null

    // Configuration
    this.maxQueueSize = config.maxQueueSize || 10
    this.stopPrevious = config.stopPrevious !== false  // Default: true
    this.sessionTimeout = config.sessionTimeout || 300000  // 5 minutes
    this.persistState = config.persistState !== false  // Default: true

    // Queue state
    this.currentSession = null
    this.queue = []

    // Metrics
    this.totalProcessed = 0
    this.totalStopped = 0
    this.lastActivity = Date.now()

    // Cleanup timer
    this.cleanupTimer = null
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

      // Subscribe to TTS request events
      this.eventBus.subscribe('tts:request', this._handleNewRequest.bind(this))

      // Subscribe to TTS lifecycle events for session tracking
      this.eventBus.subscribe('tts:started', this._handleStarted.bind(this))
      this.eventBus.subscribe('tts:completed', this._handleCompleted.bind(this))
      this.eventBus.subscribe('tts:error', this._handleError.bind(this))

      // Restore state if persisted
      if (this.persistState) {
        await this._restoreState()
      }

      // Start cleanup timer
      this._startCleanupTimer()

      console.log(`${this.name} v${this.version} initialized at stage: ${this.stage}`)
      return true
    } catch (error) {
      console.error(`Failed to initialize ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Handle new TTS request
   * @param {Object} event - TTS request event
   * @private
   */
  async _handleNewRequest(event) {
    try {
      const startTime = performance.now()

      // Stop previous audio if playing (stopPrevious behavior)
      if (this.stopPrevious && this.currentSession) {
        await this._stopCurrentSession()
      }

      // Create new session
      const session = this._createSession(event)

      // Set as current session
      this.currentSession = session

      // Update last activity
      this.lastActivity = Date.now()

      // Persist state if enabled
      if (this.persistState) {
        await this._persistState()
      }

      // Emit queue:started event for UI
      this.eventBus.emit('queue:started', {
        sessionId: session.sessionId,
        tabId: session.tabId,
        status: session.status,
        timestamp: Date.now()
      })

      // Forward to synthesis stage
      // Note: The event bus will route this to the KokoroEngine plugin
      this.eventBus.emit('tts:synthesize', event)

      // Metrics
      this.totalProcessed++

      const endTime = performance.now()
      const enqueueTime = endTime - startTime

      if (enqueueTime > 10) {
        console.warn(`Queue enqueue took ${enqueueTime}ms (target: <10ms)`)
      }
    } catch (error) {
      console.error('Error handling new request:', error)
      // Emit error event
      this.eventBus.emit('queue:error', {
        error: error.message,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle TTS started event
   * @param {Object} event - Started event
   * @private
   */
  async _handleStarted(event) {
    try {
      if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
        this.currentSession.status = 'playing'
        this.lastActivity = Date.now()

        // Persist state
        if (this.persistState) {
          await this._persistState()
        }
      }
    } catch (error) {
      console.error('Error handling started event:', error)
    }
  }

  /**
   * Handle TTS completed event
   * @param {Object} event - Completed event
   * @private
   */
  async _handleCompleted(event) {
    try {
      if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
        this.currentSession.status = 'completed'
        this.lastActivity = Date.now()

        // Emit queue:completed event
        this.eventBus.emit('queue:completed', {
          sessionId: this.currentSession.sessionId,
          timestamp: Date.now()
        })

        // Clear current session after a short delay
        setTimeout(() => {
          if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
            this.currentSession = null
          }
        }, 1000)

        // Persist state
        if (this.persistState) {
          await this._persistState()
        }
      }
    } catch (error) {
      console.error('Error handling completed event:', error)
    }
  }

  /**
   * Handle TTS error event
   * @param {Object} event - Error event
   * @private
   */
  async _handleError(event) {
    try {
      if (this.currentSession && this.currentSession.sessionId === event.sessionId) {
        this.currentSession.status = 'stopped'
        this.lastActivity = Date.now()

        // Emit queue:stopped event
        this.eventBus.emit('queue:stopped', {
          sessionId: this.currentSession.sessionId,
          reason: 'error',
          error: event.error,
          timestamp: Date.now()
        })

        // Clear current session
        this.currentSession = null

        // Persist state
        if (this.persistState) {
          await this._persistState()
        }
      }
    } catch (error) {
      console.error('Error handling error event:', error)
    }
  }

  /**
   * Stop current session
   * @private
   */
  async _stopCurrentSession() {
    try {
      if (!this.currentSession) {
        return
      }

      const startTime = performance.now()

      // Send audio:stop event to OffscreenAudio plugin
      this.eventBus.emit('audio:stop', {
        sessionId: this.currentSession.sessionId,
        timestamp: Date.now()
      })

      // Update session status
      this.currentSession.status = 'stopped'

      // Emit queue:stopped event for UI
      this.eventBus.emit('queue:stopped', {
        sessionId: this.currentSession.sessionId,
        reason: 'new-request',
        timestamp: Date.now()
      })

      // Clear current session
      const stoppedSession = this.currentSession
      this.currentSession = null

      // Metrics
      this.totalStopped++

      const endTime = performance.now()
      const stopTime = endTime - startTime

      if (stopTime > 50) {
        console.warn(`Queue stop took ${stopTime}ms (target: <50ms)`)
      }

      console.log(`Stopped session ${stoppedSession.sessionId} for new request`)
    } catch (error) {
      console.error('Error stopping current session:', error)
      throw error
    }
  }

  /**
   * Create session from event
   * @param {Object} event - TTS event
   * @returns {TTSSession}
   * @private
   */
  _createSession(event) {
    return {
      sessionId: event.id || this._generateSessionId(),
      tabId: event.source?.tabId || 0,
      status: 'queued',
      text: event.request?.text || '',
      textId: event.request?.textId,
      voiceId: event.request?.voice || event.input?.voice || 'af_bella',
      speed: event.request?.speed || event.input?.speed || 1.0,
      progress: 0,
      startTime: Date.now()
    }
  }

  /**
   * Generate unique session ID
   * @returns {string}
   * @private
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Persist state to chrome.storage.local
   * @private
   */
  async _persistState() {
    try {
      if (!this.pal.storage) {
        return
      }

      const state = {
        currentSession: this.currentSession,
        queueLength: this.queue.length,
        totalProcessed: this.totalProcessed,
        totalStopped: this.totalStopped,
        lastActivity: this.lastActivity,
        timestamp: Date.now()
      }

      await this.pal.storage.set('queue-manager-state', state)
    } catch (error) {
      console.error('Error persisting state:', error)
    }
  }

  /**
   * Restore state from chrome.storage.local
   * @private
   */
  async _restoreState() {
    try {
      if (!this.pal.storage) {
        return
      }

      const state = await this.pal.storage.get('queue-manager-state')
      if (!state) {
        return
      }

      // Restore metrics
      this.totalProcessed = state.totalProcessed || 0
      this.totalStopped = state.totalStopped || 0
      this.lastActivity = state.lastActivity || Date.now()

      // Don't restore current session - always start fresh
      // This prevents stale sessions from previous runs

      console.log(`Restored queue state: ${this.totalProcessed} processed, ${this.totalStopped} stopped`)
    } catch (error) {
      console.error('Error restoring state:', error)
    }
  }

  /**
   * Start cleanup timer for session timeout
   * @private
   */
  _startCleanupTimer() {
    // Check for stale sessions every minute
    this.cleanupTimer = setInterval(() => {
      this._cleanupStaleSessions()
    }, 60000)
  }

  /**
   * Cleanup stale sessions
   * @private
   */
  _cleanupStaleSessions() {
    try {
      if (!this.currentSession) {
        return
      }

      const now = Date.now()
      const sessionAge = now - this.currentSession.startTime

      // If session is older than timeout, clear it
      if (sessionAge > this.sessionTimeout) {
        console.warn(`Cleaning up stale session ${this.currentSession.sessionId}`)
        this.currentSession = null

        // Persist state
        if (this.persistState) {
          this._persistState()
        }
      }
    } catch (error) {
      console.error('Error cleaning up stale sessions:', error)
    }
  }

  // Public methods

  /**
   * Enqueue a TTS request
   * @param {Object} event - TTS event
   * @param {'low'|'normal'|'high'} [priority] - Priority level
   * @returns {Promise<void>}
   */
  async enqueue(event, priority = 'normal') {
    // In stop-previous mode, we don't queue - we stop current and start new
    // This method is here for API compatibility
    await this._handleNewRequest(event)
  }

  /**
   * Dequeue next request
   * @returns {Object|null}
   */
  dequeue() {
    // In stop-previous mode, there's no queue
    return null
  }

  /**
   * Clear entire queue
   */
  clear() {
    this.queue = []
    console.log('Queue cleared')
  }

  /**
   * Stop current session
   * @returns {Promise<void>}
   */
  async stopCurrent() {
    if (this.currentSession) {
      await this._stopCurrentSession()
    }
  }

  /**
   * Pause current session
   * @returns {Promise<void>}
   */
  async pauseCurrent() {
    try {
      if (!this.currentSession || this.currentSession.status !== 'playing') {
        return
      }

      // Send audio:pause event
      this.eventBus.emit('audio:pause', {
        sessionId: this.currentSession.sessionId,
        timestamp: Date.now()
      })

      // Update session
      this.currentSession.status = 'paused'
      this.currentSession.pausedTime = Date.now()

      // Emit event
      this.eventBus.emit('queue:paused', {
        sessionId: this.currentSession.sessionId,
        timestamp: Date.now()
      })

      // Persist state
      if (this.persistState) {
        await this._persistState()
      }
    } catch (error) {
      console.error('Error pausing current session:', error)
    }
  }

  /**
   * Resume current session
   * @returns {Promise<void>}
   */
  async resumeCurrent() {
    try {
      if (!this.currentSession || this.currentSession.status !== 'paused') {
        return
      }

      // Send audio:resume event
      this.eventBus.emit('audio:resume', {
        sessionId: this.currentSession.sessionId,
        timestamp: Date.now()
      })

      // Update session
      this.currentSession.status = 'playing'
      this.currentSession.resumeTime = Date.now()

      // Emit event
      this.eventBus.emit('queue:resumed', {
        sessionId: this.currentSession.sessionId,
        timestamp: Date.now()
      })

      // Persist state
      if (this.persistState) {
        await this._persistState()
      }
    } catch (error) {
      console.error('Error resuming current session:', error)
    }
  }

  /**
   * Get current session
   * @returns {TTSSession|null}
   */
  getCurrentSession() {
    return this.currentSession
  }

  /**
   * Get queue length
   * @returns {number}
   */
  getQueueLength() {
    return this.queue.length
  }

  /**
   * Get queue state
   * @returns {Object}
   */
  getQueueState() {
    return {
      currentSession: this.currentSession,
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalStopped: this.totalStopped,
      lastActivity: this.lastActivity
    }
  }

  /**
   * Cleanup plugin resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Stop current session
      if (this.currentSession) {
        await this.stopCurrent()
      }

      // Clear cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
        this.cleanupTimer = null
      }

      // Clear queue
      this.queue = []

      // Persist final state
      if (this.persistState) {
        await this._persistState()
      }

      console.log(`${this.name} cleaned up`)
    } catch (error) {
      console.error(`Error cleaning up ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      stage: this.stage,
      status: 'healthy',
      currentSession: this.currentSession ? {
        sessionId: this.currentSession.sessionId,
        status: this.currentSession.status
      } : null,
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalStopped: this.totalStopped,
      lastActivity: this.lastActivity
    }
  }
}

export default QueueManagerPlugin
