/**
 * @module IndexedDBWrapper
 * @description Wrapper for IndexedDB operations for model and text storage
 */

const DB_NAME = 'KokoroJSExtension'
const DB_VERSION = 1

const STORES = {
  MODELS: 'models',
  TEXT_CACHE: 'textCache',
  METADATA: 'metadata'
}

/**
 * IndexedDB wrapper implementing PAL storage interface
 */
class IndexedDBWrapper {
  constructor() {
    this.db = null
    this.initPromise = null
  }

  /**
   * Initialize database connection
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) {
      return this.db
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Models store - for ONNX model binaries
        if (!db.objectStoreNames.contains(STORES.MODELS)) {
          const modelsStore = db.createObjectStore(STORES.MODELS, { keyPath: 'modelId' })
          modelsStore.createIndex('version', 'version', { unique: false })
          modelsStore.createIndex('downloadDate', 'downloadDate', { unique: false })
        }

        // Text cache store - for large text transport
        if (!db.objectStoreNames.contains(STORES.TEXT_CACHE)) {
          const textCacheStore = db.createObjectStore(STORES.TEXT_CACHE, { keyPath: 'cacheId' })
          textCacheStore.createIndex('tabId', 'tabId', { unique: false })
          textCacheStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Metadata store - for app state
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
        }
      }
    })

    return this.initPromise
  }

  /**
   * Request persistent storage if available
   * @returns {Promise<boolean>}
   */
  async requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist()
        return isPersisted
      }
      return false
    } catch (error) {
      console.warn('Failed to request persistent storage', error)
      return false
    }
  }

  /**
   * Store model binary in IndexedDB
   * @param {string} modelId - Model identifier
   * @param {ArrayBuffer} arrayBuffer - Model binary data
   * @param {Object} metadata - Model metadata
   * @returns {Promise<void>}
   */
  async storeModel(modelId, arrayBuffer, metadata = {}) {
    try {
      await this.init()

      const modelData = {
        modelId,
        data: arrayBuffer,
        version: metadata.version || 'v1.0',
        size: arrayBuffer.byteLength,
        downloadDate: Date.now(),
        lastUsed: Date.now(),
        storageType: 'indexeddb',
        checksums: metadata.checksums || {}
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.MODELS], 'readwrite')
        const store = transaction.objectStore(STORES.MODELS)
        const request = store.put(modelData)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to store model: ${request.error}`))
      })
    } catch (error) {
      throw new Error(`Failed to store model ${modelId}: ${error.message}`)
    }
  }

  /**
   * Load model binary from IndexedDB
   * @param {string} modelId - Model identifier
   * @returns {Promise<ArrayBuffer|null>}
   */
  async loadModel(modelId) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.MODELS], 'readonly')
        const store = transaction.objectStore(STORES.MODELS)
        const request = store.get(modelId)

        request.onsuccess = () => {
          const result = request.result
          if (result) {
            // Update last used timestamp
            this._updateModelLastUsed(modelId).catch(err => {
              console.warn('Failed to update last used timestamp', err)
            })
            resolve(result.data)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(new Error(`Failed to load model: ${request.error}`))
      })
    } catch (error) {
      throw new Error(`Failed to load model ${modelId}: ${error.message}`)
    }
  }

  /**
   * Check if model exists in IndexedDB
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>}
   */
  async checkModelExists(modelId) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.MODELS], 'readonly')
        const store = transaction.objectStore(STORES.MODELS)
        const request = store.get(modelId)

        request.onsuccess = () => {
          resolve(!!request.result)
        }
        request.onerror = () => reject(new Error(`Failed to check model existence: ${request.error}`))
      })
    } catch (error) {
      console.error(`Failed to check model ${modelId}:`, error)
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
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.MODELS], 'readonly')
        const store = transaction.objectStore(STORES.MODELS)
        const request = store.get(modelId)

        request.onsuccess = () => {
          const result = request.result
          if (result) {
            const { data, ...metadata } = result
            resolve(metadata)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(new Error(`Failed to get model metadata: ${request.error}`))
      })
    } catch (error) {
      console.error(`Failed to get model metadata ${modelId}:`, error)
      return null
    }
  }

  /**
   * Update model last used timestamp
   * @private
   * @param {string} modelId - Model identifier
   * @returns {Promise<void>}
   */
  async _updateModelLastUsed(modelId) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.MODELS], 'readwrite')
        const store = transaction.objectStore(STORES.MODELS)
        const getRequest = store.get(modelId)

        getRequest.onsuccess = () => {
          const modelData = getRequest.result
          if (modelData) {
            modelData.lastUsed = Date.now()
            const putRequest = store.put(modelData)
            putRequest.onsuccess = () => resolve()
            putRequest.onerror = () => reject(new Error(`Failed to update last used: ${putRequest.error}`))
          } else {
            resolve()
          }
        }
        getRequest.onerror = () => reject(new Error(`Failed to get model for update: ${getRequest.error}`))
      })
    } catch (error) {
      console.error(`Failed to update last used for ${modelId}:`, error)
    }
  }

  /**
   * Store large text in cache for cross-context transport
   * @param {string} cacheId - Cache identifier
   * @param {string} text - Text content
   * @param {number} tabId - Tab identifier
   * @returns {Promise<void>}
   */
  async storeTextCache(cacheId, text, tabId) {
    try {
      await this.init()

      const cacheData = {
        cacheId,
        text,
        tabId,
        timestamp: Date.now()
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.TEXT_CACHE], 'readwrite')
        const store = transaction.objectStore(STORES.TEXT_CACHE)
        const request = store.put(cacheData)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to store text cache: ${request.error}`))
      })
    } catch (error) {
      throw new Error(`Failed to store text cache ${cacheId}: ${error.message}`)
    }
  }

  /**
   * Load text from cache
   * @param {string} cacheId - Cache identifier
   * @returns {Promise<string|null>}
   */
  async loadTextCache(cacheId) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.TEXT_CACHE], 'readonly')
        const store = transaction.objectStore(STORES.TEXT_CACHE)
        const request = store.get(cacheId)

        request.onsuccess = () => {
          const result = request.result
          resolve(result ? result.text : null)
        }
        request.onerror = () => reject(new Error(`Failed to load text cache: ${request.error}`))
      })
    } catch (error) {
      throw new Error(`Failed to load text cache ${cacheId}: ${error.message}`)
    }
  }

  /**
   * Clean up old text cache entries (older than 1 hour)
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanupTextCache() {
    try {
      await this.init()

      const oneHourAgo = Date.now() - (60 * 60 * 1000)

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.TEXT_CACHE], 'readwrite')
        const store = transaction.objectStore(STORES.TEXT_CACHE)
        const index = store.index('timestamp')
        const range = IDBKeyRange.upperBound(oneHourAgo)
        const request = index.openCursor(range)

        let deletedCount = 0

        request.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor) {
            cursor.delete()
            deletedCount++
            cursor.continue()
          } else {
            resolve(deletedCount)
          }
        }
        request.onerror = () => reject(new Error(`Failed to cleanup text cache: ${request.error}`))
      })
    } catch (error) {
      console.error('Failed to cleanup text cache:', error)
      return 0
    }
  }

  /**
   * Store metadata
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @returns {Promise<void>}
   */
  async storeMetadata(key, value) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.METADATA], 'readwrite')
        const store = transaction.objectStore(STORES.METADATA)
        const request = store.put({ key, value })

        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to store metadata: ${request.error}`))
      })
    } catch (error) {
      throw new Error(`Failed to store metadata ${key}: ${error.message}`)
    }
  }

  /**
   * Load metadata
   * @param {string} key - Metadata key
   * @returns {Promise<*>}
   */
  async loadMetadata(key) {
    try {
      await this.init()

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.METADATA], 'readonly')
        const store = transaction.objectStore(STORES.METADATA)
        const request = store.get(key)

        request.onsuccess = () => {
          const result = request.result
          resolve(result ? result.value : null)
        }
        request.onerror = () => reject(new Error(`Failed to load metadata: ${request.error}`))
      })
    } catch (error) {
      console.error(`Failed to load metadata ${key}:`, error)
      return null
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
}

export { IndexedDBWrapper, STORES }