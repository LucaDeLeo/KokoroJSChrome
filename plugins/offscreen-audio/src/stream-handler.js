/**
 * @module StreamHandler
 * @description Handles chunked audio streaming for progressive playback
 */

/**
 * @typedef {Object} AudioChunk
 * @property {Float32Array} data - Audio data
 * @property {number} sampleRate - Sample rate in Hz
 * @property {number} timestamp - Chunk timestamp
 * @property {boolean} [isLast] - Whether this is the last chunk
 */

class StreamHandler {
  constructor(audioManager) {
    this.audioManager = audioManager

    // Stream state
    this.chunkBuffer = []
    this.isStreaming = false
    this.streamId = null
    this.totalDuration = 0
  }

  /**
   * Stream audio chunk
   * @param {AudioChunk} chunk - Audio chunk to stream
   * @returns {Promise<void>}
   */
  async streamChunk(chunk) {
    try {
      if (!this.isStreaming) {
        this.isStreaming = true
        this.streamId = `stream-${Date.now()}`
        this.chunkBuffer = []
        this.totalDuration = 0
      }

      // Add chunk to buffer
      this.chunkBuffer.push(chunk)

      // Calculate cumulative duration
      const chunkDuration = chunk.data.length / chunk.sampleRate
      this.totalDuration += chunkDuration

      console.log(`Buffered chunk ${this.chunkBuffer.length}, duration: ${chunkDuration}s, total: ${this.totalDuration}s`)

      // If this is the last chunk, flush automatically
      if (chunk.isLast) {
        await this.flushStream()
      }
    } catch (error) {
      console.error('Stream chunk error:', error)
      throw error
    }
  }

  /**
   * Flush stream and play buffered audio
   * @returns {Promise<void>}
   */
  async flushStream() {
    try {
      if (this.chunkBuffer.length === 0) {
        console.warn('No chunks to flush')
        return
      }

      console.log(`Flushing stream with ${this.chunkBuffer.length} chunks`)

      // Concatenate all chunks into single buffer
      const concatenatedBuffer = this._concatenateChunks()

      // Create AudioBuffer from concatenated data
      const audioBuffer = this._createAudioBuffer(concatenatedBuffer)

      // Play through audio manager
      await this.audioManager.play(audioBuffer, {
        playbackId: this.streamId
      })

      // Reset stream state
      this._resetStream()

      console.log('Stream flushed and playing')
    } catch (error) {
      console.error('Flush stream error:', error)
      this._resetStream()
      throw error
    }
  }

  /**
   * Cancel current stream
   */
  cancelStream() {
    console.log('Canceling stream')
    this._resetStream()
  }

  /**
   * Get stream state
   * @returns {Object}
   */
  getStreamState() {
    return {
      isStreaming: this.isStreaming,
      streamId: this.streamId,
      bufferedChunks: this.chunkBuffer.length,
      totalDuration: this.totalDuration
    }
  }

  // Private methods

  /**
   * Concatenate audio chunks
   * @private
   * @returns {Object}
   */
  _concatenateChunks() {
    if (this.chunkBuffer.length === 0) {
      throw new Error('No chunks to concatenate')
    }

    // Use sample rate from first chunk
    const sampleRate = this.chunkBuffer[0].sampleRate

    // Calculate total length
    let totalLength = 0
    for (const chunk of this.chunkBuffer) {
      totalLength += chunk.data.length
    }

    // Allocate concatenated array
    const concatenated = new Float32Array(totalLength)

    // Copy all chunks
    let offset = 0
    for (const chunk of this.chunkBuffer) {
      concatenated.set(chunk.data, offset)
      offset += chunk.data.length
    }

    return {
      data: concatenated,
      sampleRate,
      numberOfChannels: 1, // Assume mono for now
      duration: totalLength / sampleRate
    }
  }

  /**
   * Create AudioBuffer from concatenated data
   * @private
   * @param {Object} bufferData - Concatenated buffer data
   * @returns {AudioBuffer}
   */
  _createAudioBuffer(bufferData) {
    // Create offline audio context for buffer creation
    const offlineContext = new OfflineAudioContext(
      bufferData.numberOfChannels,
      bufferData.data.length,
      bufferData.sampleRate
    )

    const audioBuffer = offlineContext.createBuffer(
      bufferData.numberOfChannels,
      bufferData.data.length,
      bufferData.sampleRate
    )

    audioBuffer.getChannelData(0).set(bufferData.data)

    return audioBuffer
  }

  /**
   * Reset stream state
   * @private
   */
  _resetStream() {
    this.chunkBuffer = []
    this.isStreaming = false
    this.streamId = null
    this.totalDuration = 0
  }
}

export { StreamHandler }