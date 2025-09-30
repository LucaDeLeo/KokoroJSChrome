/**
 * @module AudioManager
 * @description Manages audio playback coordination with offscreen document
 */

/**
 * @typedef {Object} PlaybackState
 * @property {'idle'|'playing'|'paused'|'stopped'} status
 * @property {string|null} currentPlaybackId
 * @property {number} position
 * @property {number} duration
 */

class AudioManager {
  constructor(pal, eventBus) {
    this.pal = pal
    this.eventBus = eventBus

    // Playback state
    this.playbackState = {
      status: 'idle',
      currentPlaybackId: null,
      position: 0,
      duration: 0
    }

    // Volume and speed settings
    this.volume = 1.0
    this.speed = 1.0

    // Message listener
    this.messageListener = null
  }

  /**
   * Initialize audio manager
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Set up message listener for offscreen events
      this.messageListener = (message, sender, sendResponse) => {
        if (message.type === 'offscreen-audio-event') {
          this._handleOffscreenEvent(message)
        }
      }

      chrome.runtime.onMessage.addListener(this.messageListener)

      console.log('AudioManager initialized')
    } catch (error) {
      console.error('AudioManager init error:', error)
      throw error
    }
  }

  /**
   * Play audio through offscreen document
   * @param {AudioBuffer} audioBuffer - Audio buffer to play
   * @param {Object} options - Playback options
   * @returns {Promise<void>}
   */
  async play(audioBuffer, options = {}) {
    try {
      // Extract audio data from AudioBuffer
      const audioData = this._extractAudioData(audioBuffer)

      // Update playback state
      this.playbackState.status = 'playing'
      this.playbackState.currentPlaybackId = options.playbackId || null
      this.playbackState.duration = audioBuffer.duration
      this.playbackState.position = 0

      // Send play message to offscreen document
      const response = await chrome.runtime.sendMessage({
        type: 'offscreen-audio-play',
        audioData: audioData.data,
        sampleRate: audioData.sampleRate,
        numberOfChannels: audioData.numberOfChannels,
        playbackId: options.playbackId,
        options: {
          volume: options.volume !== undefined ? options.volume : this.volume,
          speed: options.speed !== undefined ? options.speed : this.speed
        }
      })

      if (!response.success) {
        throw new Error(response.error || 'Playback failed')
      }

      console.log('Audio playback initiated')
    } catch (error) {
      console.error('Audio play error:', error)
      this.playbackState.status = 'idle'
      throw error
    }
  }

  /**
   * Pause current playback
   */
  pause() {
    try {
      chrome.runtime.sendMessage({
        type: 'offscreen-audio-pause'
      })

      this.playbackState.status = 'paused'
    } catch (error) {
      console.error('Audio pause error:', error)
      throw error
    }
  }

  /**
   * Resume paused playback
   */
  resume() {
    try {
      chrome.runtime.sendMessage({
        type: 'offscreen-audio-resume'
      })

      this.playbackState.status = 'playing'
    } catch (error) {
      console.error('Audio resume error:', error)
      throw error
    }
  }

  /**
   * Stop current playback
   */
  stop() {
    try {
      chrome.runtime.sendMessage({
        type: 'offscreen-audio-stop'
      })

      this.playbackState.status = 'stopped'
      this.playbackState.currentPlaybackId = null
      this.playbackState.position = 0
      this.playbackState.duration = 0
    } catch (error) {
      console.error('Audio stop error:', error)
      throw error
    }
  }

  /**
   * Get current playback state
   * @returns {PlaybackState}
   */
  getPlaybackState() {
    return { ...this.playbackState }
  }

  /**
   * Set volume
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    this.volume = volume
  }

  /**
   * Set playback speed
   * @param {number} speed - Speed (0.5-2.0)
   */
  setSpeed(speed) {
    this.speed = speed
  }

  /**
   * Cleanup audio manager
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Remove message listener
      if (this.messageListener) {
        chrome.runtime.onMessage.removeListener(this.messageListener)
        this.messageListener = null
      }

      // Reset state
      this.playbackState = {
        status: 'idle',
        currentPlaybackId: null,
        position: 0,
        duration: 0
      }

      console.log('AudioManager cleaned up')
    } catch (error) {
      console.error('AudioManager cleanup error:', error)
      throw error
    }
  }

  // Private methods

  /**
   * Extract audio data from AudioBuffer
   * @private
   * @param {AudioBuffer} audioBuffer - Audio buffer
   * @returns {Object}
   */
  _extractAudioData(audioBuffer) {
    // Get channel data (assume mono for now)
    const channelData = audioBuffer.getChannelData(0)

    return {
      data: Array.from(channelData),
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      duration: audioBuffer.duration
    }
  }

  /**
   * Handle events from offscreen document
   * @private
   * @param {Object} message - Message from offscreen
   */
  _handleOffscreenEvent(message) {
    const { event, playbackId, timestamp } = message

    switch (event) {
      case 'started':
        this.playbackState.status = 'playing'
        this.playbackState.currentPlaybackId = playbackId

        if (this.eventBus) {
          this.eventBus.emit('audio:playbackStarted', {
            playbackId,
            timestamp,
            duration: message.duration
          })
        }
        break

      case 'completed':
        this.playbackState.status = 'idle'
        this.playbackState.currentPlaybackId = null
        this.playbackState.position = 0

        if (this.eventBus) {
          this.eventBus.emit('audio:playbackCompleted', {
            playbackId,
            timestamp
          })
        }
        break

      case 'paused':
        this.playbackState.status = 'paused'
        this.playbackState.position = message.position

        if (this.eventBus) {
          this.eventBus.emit('audio:playbackPaused', {
            playbackId,
            timestamp,
            position: message.position
          })
        }
        break

      case 'error':
        this.playbackState.status = 'idle'
        this.playbackState.currentPlaybackId = null

        if (this.eventBus) {
          this.eventBus.emit('audio:playbackError', {
            playbackId,
            error: message.error,
            timestamp
          })
        }
        break

      case 'stopped':
        this.playbackState.status = 'stopped'
        this.playbackState.currentPlaybackId = null
        this.playbackState.position = 0

        if (this.eventBus) {
          this.eventBus.emit('audio:playbackStopped', {
            timestamp
          })
        }
        break

      default:
        console.warn('Unknown offscreen event:', event)
    }
  }
}

export { AudioManager }