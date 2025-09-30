/**
 * @module TTSEvent
 * @description Core event structure for TTS request/response flow
 */

class TTSEvent {
  constructor(request = {}) {
    this.id = this._generateId()
    this.timestamp = Date.now()

    this.request = {
      text: request.text || '',
      source: request.source || 'unknown',
      voiceId: request.voiceId || 'default',
      speed: request.speed || 1.0,
      options: request.options || {}
    }

    this.response = {
      audio: null,
      duration: 0,
      chunks: [],
      cached: false
    }

    this.metadata = {
      tabId: request.tabId || null,
      url: request.url || null,
      timing: {
        created: this.timestamp,
        started: null,
        completed: null,
        stages: {}
      }
    }

    this.state = {
      phase: 'created',
      progress: 0,
      error: null
    }
  }

  _generateId() {
    return `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  setPhase(phase) {
    const validPhases = ['created', 'queued', 'processing', 'streaming', 'completed', 'failed']
    if (!validPhases.includes(phase)) {
      throw new Error(`Invalid phase: ${phase}. Must be one of: ${validPhases.join(', ')}`)
    }
    this.state.phase = phase

    if (phase === 'processing' && !this.metadata.timing.started) {
      this.metadata.timing.started = Date.now()
    } else if (phase === 'completed' || phase === 'failed') {
      this.metadata.timing.completed = Date.now()
    }
  }

  setProgress(progress) {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100')
    }
    this.state.progress = progress
  }

  setError(error) {
    this.state.error = error
    this.setPhase('failed')
  }

  addStageTime(stageName, duration) {
    this.metadata.timing.stages[stageName] = duration
  }

  getElapsedTime() {
    if (!this.metadata.timing.started) {
      return 0
    }
    const end = this.metadata.timing.completed || Date.now()
    return end - this.metadata.timing.started
  }

  setResponse(responseData) {
    if (responseData.audio) {
      this.response.audio = responseData.audio
    }
    if (responseData.duration !== undefined) {
      this.response.duration = responseData.duration
    }
    if (responseData.chunks) {
      this.response.chunks = responseData.chunks
    }
    if (responseData.cached !== undefined) {
      this.response.cached = responseData.cached
    }
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      request: this.request,
      response: this.response,
      metadata: this.metadata,
      state: this.state
    }
  }

  clone() {
    const cloned = new TTSEvent(this.request)
    cloned.id = this.id
    cloned.timestamp = this.timestamp
    cloned.response = { ...this.response }
    cloned.metadata = JSON.parse(JSON.stringify(this.metadata))
    cloned.state = { ...this.state }
    return cloned
  }
}

export { TTSEvent }
module.exports = { TTSEvent }