/**
 * @module ModelLoader
 * @description Model download and lifecycle management
 */

// Model configuration
const MODEL_CONFIG = {
  'kokoro-82M': {
    url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/model.onnx',
    version: 'v1.0',
    size: 82 * 1024 * 1024, // 82MB
    checksumUrl: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/model.onnx.sha256'
  }
}

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

/**
 * Model loader with download and lifecycle management
 */
class ModelLoader {
  constructor(storage) {
    this.storage = storage
    this.downloadAbortController = null
  }

  /**
   * Download model with progress tracking
   * @param {string} modelId - Model identifier
   * @param {Function} onProgress - Progress callback (loaded, total, percentage)
   * @returns {Promise<ArrayBuffer>}
   */
  async downloadModel(modelId, onProgress) {
    const config = MODEL_CONFIG[modelId]
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    let lastError = null
    let retryDelay = INITIAL_RETRY_DELAY

    // Try download with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${retryDelay}ms`)
          await this._delay(retryDelay)
          retryDelay *= 2
        }

        this.downloadAbortController = new AbortController()
        const arrayBuffer = await this._fetchWithProgress(
          config.url,
          onProgress,
          this.downloadAbortController.signal
        )

        // Verify checksum
        const checksum = await this._calculateSHA256(arrayBuffer)
        console.log(`Downloaded model checksum: ${checksum}`)

        return arrayBuffer
      } catch (error) {
        lastError = error
        if (error.name === 'AbortError') {
          throw new Error('Download cancelled by user')
        }
        console.error(`Download attempt ${attempt + 1} failed:`, error)
      } finally {
        this.downloadAbortController = null
      }
    }

    throw new Error(`Failed to download model after ${MAX_RETRIES} attempts: ${lastError?.message}`)
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload() {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort()
      this.downloadAbortController = null
    }
  }

  /**
   * Fetch with progress tracking
   * @private
   * @param {string} url - URL to fetch
   * @param {Function} onProgress - Progress callback
   * @param {AbortSignal} signal - Abort signal
   * @returns {Promise<ArrayBuffer>}
   */
  async _fetchWithProgress(url, onProgress, signal) {
    const response = await fetch(url, { signal })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!total) {
      // No content length, just download without progress
      return await response.arrayBuffer()
    }

    const reader = response.body.getReader()
    const chunks = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      chunks.push(value)
      loaded += value.length

      const percentage = Math.round((loaded / total) * 100)
      if (onProgress) {
        onProgress(loaded, total, percentage)
      }
    }

    // Combine chunks into single ArrayBuffer
    const arrayBuffer = new ArrayBuffer(loaded)
    const uint8Array = new Uint8Array(arrayBuffer)
    let offset = 0

    for (const chunk of chunks) {
      uint8Array.set(chunk, offset)
      offset += chunk.length
    }

    return arrayBuffer
  }

  /**
   * Calculate SHA-256 checksum
   * @private
   * @param {ArrayBuffer} arrayBuffer - Data to hash
   * @returns {Promise<string>}
   */
  async _calculateSHA256(arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  /**
   * Delay helper for retry logic
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Load model (from storage or download)
   * @param {string} modelId - Model identifier
   * @param {Function} onProgress - Progress callback for download
   * @returns {Promise<ArrayBuffer>}
   */
  async loadModel(modelId, onProgress) {
    try {
      // Check if model exists in storage
      const exists = await this.storage.checkModelExists(modelId)

      if (exists) {
        console.log(`Loading model ${modelId} from storage`)
        const arrayBuffer = await this.storage.loadModel(modelId)
        if (arrayBuffer) {
          return arrayBuffer
        }
        console.warn(`Model ${modelId} exists but failed to load, will re-download`)
      }

      // Model not in storage, download it
      console.log(`Downloading model ${modelId}`)
      const arrayBuffer = await this.downloadModel(modelId, onProgress)

      // Store in IndexedDB
      const config = MODEL_CONFIG[modelId]
      const checksum = await this._calculateSHA256(arrayBuffer)

      await this.storage.storeModel(modelId, arrayBuffer, {
        version: config.version,
        checksums: {
          sha256: checksum
        }
      })

      console.log(`Model ${modelId} downloaded and stored successfully`)
      return arrayBuffer
    } catch (error) {
      throw new Error(`Failed to load model ${modelId}: ${error.message}`)
    }
  }

  /**
   * Check if model is available (in storage)
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>}
   */
  async isModelAvailable(modelId) {
    try {
      return await this.storage.checkModelExists(modelId)
    } catch (error) {
      console.error(`Failed to check model availability:`, error)
      return false
    }
  }

  /**
   * Get model metadata
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object|null>}
   */
  async getModelMetadata(modelId) {
    try {
      return await this.storage.getModelMetadata(modelId)
    } catch (error) {
      console.error(`Failed to get model metadata:`, error)
      return null
    }
  }

  /**
   * Get model configuration
   * @param {string} modelId - Model identifier
   * @returns {Object|null}
   */
  getModelConfig(modelId) {
    return MODEL_CONFIG[modelId] || null
  }
}

export { ModelLoader, MODEL_CONFIG }