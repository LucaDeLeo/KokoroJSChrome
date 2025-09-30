/**
 * @module AudioAdapter
 * @description Audio wrapper for Web Audio API and Offscreen API
 */

class AudioAdapter {
  constructor() {
    this.audioContext = null
    this.offscreenDocument = null
    this.audioNodes = new Map()
  }

  async initialize() {
    if (this._isWebAudioAvailable()) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
  }

  async cleanup() {
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    if (this.offscreenDocument) {
      await this.closeOffscreen()
    }

    this.audioNodes.clear()
  }

  async createOffscreen(url = 'offscreen.html') {
    if (!this.isOffscreenAvailable()) {
      throw new Error('Offscreen API not available')
    }

    if (this.offscreenDocument) {
      return this.offscreenDocument
    }

    try {
      await chrome.offscreen.createDocument({
        url,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Playing TTS audio in offscreen document'
      })
      this.offscreenDocument = true
      return true
    } catch (error) {
      if (error.message.includes('already exists')) {
        this.offscreenDocument = true
        return true
      }
      throw error
    }
  }

  async closeOffscreen() {
    if (!this.offscreenDocument) {
      return
    }

    try {
      await chrome.offscreen.closeDocument()
      this.offscreenDocument = null
    } catch (error) {
      console.warn('Failed to close offscreen document:', error)
    }
  }

  async playAudio(audioData, options = {}) {
    if (options.offscreen && this.isOffscreenAvailable()) {
      return this._playViaOffscreen(audioData, options)
    } else {
      return this._playViaWebAudio(audioData, options)
    }
  }

  async _playViaWebAudio(audioData, options = {}) {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized')
    }

    const audioBuffer = await this.audioContext.decodeAudioData(audioData)
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer

    if (options.volume !== undefined) {
      const gainNode = this.audioContext.createGain()
      gainNode.gain.value = options.volume
      source.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
    } else {
      source.connect(this.audioContext.destination)
    }

    if (options.playbackRate !== undefined) {
      source.playbackRate.value = options.playbackRate
    }

    return new Promise((resolve) => {
      source.onended = () => {
        resolve({ duration: audioBuffer.duration })
      }

      source.start(0)

      if (options.nodeId) {
        this.audioNodes.set(options.nodeId, source)
      }
    })
  }

  async _playViaOffscreen(audioData, options = {}) {
    if (!this.offscreenDocument) {
      await this.createOffscreen()
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'offscreen-audio',
        action: 'play',
        audioData: Array.from(new Uint8Array(audioData)),
        options
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  stopAudio(nodeId) {
    const source = this.audioNodes.get(nodeId)
    if (source) {
      try {
        source.stop()
      } catch (error) {
        console.warn('Failed to stop audio:', error)
      }
      this.audioNodes.delete(nodeId)
    }
  }

  async getAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return []
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(device => device.kind === 'audiooutput')
  }

  isOffscreenAvailable() {
    return typeof chrome !== 'undefined' &&
           chrome.offscreen &&
           chrome.offscreen.createDocument
  }

  getCapabilities() {
    return {
      webAudio: this._isWebAudioAvailable(),
      offscreen: this.isOffscreenAvailable(),
      audioContext: this.audioContext !== null,
      sampleRate: this.audioContext ? this.audioContext.sampleRate : null
    }
  }

  async test() {
    try {
      const sampleRate = 22050
      const duration = 0.1
      const numSamples = sampleRate * duration
      const audioData = new Float32Array(numSamples)

      for (let i = 0; i < numSamples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1
      }

      const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate)
      audioBuffer.copyToChannel(audioData, 0)

      return {
        success: true,
        capabilities: this.getCapabilities()
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  _isWebAudioAvailable() {
    return typeof window !== 'undefined' &&
           (window.AudioContext || window.webkitAudioContext)
  }
}

export { AudioAdapter }