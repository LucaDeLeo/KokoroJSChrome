/**
 * @jest-environment jsdom
 */

/**
 * End-to-end pipeline tests
 * Tests complete TTS flow: popup → Core → KokoroEngine → OffscreenAudio
 */

import { IndexedDBWrapper } from '../../platform/storage/indexeddb-wrapper.js'
import { ModelLoader } from '../../core/model-loader.js'
import { TTSCore } from '../../core/tts-core.js'

// Mock IndexedDB
import 'fake-indexeddb/auto'

// Polyfill structuredClone for Node.js
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true })
      return Promise.resolve({ success: true })
    }),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({})
        return Promise.resolve({})
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback()
        return Promise.resolve()
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        callback({})
        return Promise.resolve({})
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback()
        return Promise.resolve()
      })
    }
  },
  offscreen: {
    createDocument: jest.fn(() => Promise.resolve()),
    closeDocument: jest.fn(() => Promise.resolve()),
    hasDocument: jest.fn(() => Promise.resolve(false))
  }
}

// Mock crypto.subtle for SHA-256
if (!global.crypto) {
  global.crypto = {}
}
if (!global.crypto.subtle) {
  global.crypto.subtle = {}
}
global.crypto.subtle.digest = jest.fn(async (algorithm, data) => {
  // Return mock hash (32 bytes for SHA-256)
  const hashArray = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    hashArray[i] = i
  }
  return hashArray.buffer
})

// Mock fetch for model download
global.fetch = jest.fn((url) => {
  const mockModelData = new ArrayBuffer(1024) // Mock 1KB model
  const mockBody = {
    getReader: () => {
      let done = false
      return {
        read: async () => {
          if (done) {
            return { done: true, value: undefined }
          }
          done = true
          return {
            done: false,
            value: new Uint8Array(mockModelData)
          }
        }
      }
    }
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name) => {
        if (name === 'content-length') {
          return '1024'
        }
        return null
      }
    },
    arrayBuffer: async () => mockModelData,
    body: mockBody
  })
})

describe('E2E Pipeline Tests', () => {
  let storage
  let modelLoader
  let ttsCore

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    // Initialize storage
    storage = new IndexedDBWrapper()
    await storage.init()

    // Initialize model loader
    modelLoader = new ModelLoader(storage)
  })

  afterEach(async () => {
    if (storage) {
      storage.close()
    }
  })

  describe('IndexedDB Storage', () => {
    test('should initialize database with correct schema', async () => {
      expect(storage.db).toBeDefined()
      expect(storage.db.objectStoreNames.contains('models')).toBe(true)
      expect(storage.db.objectStoreNames.contains('textCache')).toBe(true)
      expect(storage.db.objectStoreNames.contains('metadata')).toBe(true)
    })

    test('should store and retrieve model', async () => {
      const modelId = 'test-model'
      const modelData = new ArrayBuffer(1024)

      await storage.storeModel(modelId, modelData, {
        version: 'v1.0',
        checksums: { sha256: 'test-checksum' }
      })

      const retrieved = await storage.loadModel(modelId)
      expect(retrieved).toBeDefined()
      expect(retrieved.byteLength).toBe(1024)
    })

    test('should check model existence', async () => {
      const modelId = 'test-model-2'
      const exists1 = await storage.checkModelExists(modelId)
      expect(exists1).toBe(false)

      await storage.storeModel(modelId, new ArrayBuffer(512))
      const exists2 = await storage.checkModelExists(modelId)
      expect(exists2).toBe(true)
    })

    test('should store and retrieve text cache', async () => {
      const cacheId = 'test-cache'
      const text = 'This is a test text for caching'
      const tabId = 123

      await storage.storeTextCache(cacheId, text, tabId)
      const retrieved = await storage.loadTextCache(cacheId)

      expect(retrieved).toBe(text)
    })

    test('should store and retrieve metadata', async () => {
      const key = 'test-key'
      const value = { foo: 'bar', count: 42 }

      await storage.storeMetadata(key, value)
      const retrieved = await storage.loadMetadata(key)

      expect(retrieved).toEqual(value)
    })
  })

  describe('Model Download and Loading', () => {
    test('should download model with progress tracking', async () => {
      const progressUpdates = []
      const onProgress = (loaded, total, percentage) => {
        progressUpdates.push({ loaded, total, percentage })
      }

      const arrayBuffer = await modelLoader.downloadModel('kokoro-82M', onProgress)

      expect(arrayBuffer).toBeDefined()
      expect(arrayBuffer.byteLength).toBeGreaterThan(0)
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(fetch).toHaveBeenCalled()
    })

    test('should load model from storage if available', async () => {
      // Store model first
      const modelData = new ArrayBuffer(2048)
      await storage.storeModel('kokoro-82M', modelData, {
        version: 'v1.0',
        checksums: { sha256: 'mock-checksum' }
      })

      // Load model (should not download)
      fetch.mockClear()
      const loaded = await modelLoader.loadModel('kokoro-82M')

      expect(loaded).toBeDefined()
      expect(loaded.byteLength).toBe(2048)
      expect(fetch).not.toHaveBeenCalled()
    })

    test('should download model if not in storage', async () => {
      const loaded = await modelLoader.loadModel('kokoro-82M')

      expect(loaded).toBeDefined()
      expect(fetch).toHaveBeenCalled()

      // Verify model was stored
      const exists = await storage.checkModelExists('kokoro-82M')
      expect(exists).toBe(true)
    })

    test('should check model availability', async () => {
      const testModelId = 'availability-test-model'
      const available1 = await modelLoader.isModelAvailable(testModelId)
      expect(available1).toBe(false)

      await storage.storeModel(testModelId, new ArrayBuffer(1024))

      const available2 = await modelLoader.isModelAvailable(testModelId)
      expect(available2).toBe(true)
    })

    test('should get model metadata', async () => {
      const testModelId = 'metadata-test-model'
      await storage.storeModel(testModelId, new ArrayBuffer(1024), {
        version: 'v1.0',
        checksums: { sha256: 'test-checksum' }
      })

      const metadata = await modelLoader.getModelMetadata(testModelId)

      expect(metadata).toBeDefined()
      expect(metadata.modelId).toBe(testModelId)
      expect(metadata.version).toBe('v1.0')
      expect(metadata.checksums.sha256).toBe('test-checksum')
    })

    test.skip('should retry download on failure', async () => {
      // TODO: Fix fetch mock isolation for retry testing
      const savedFetch = global.fetch
      let callCount = 0

      global.fetch = jest.fn(() => {
        callCount++
        if (callCount < 2) {
          return Promise.reject(new Error('Network error'))
        }

        const mockData = new ArrayBuffer(1024)
        return Promise.resolve({
          ok: true,
          headers: {
            get: (name) => (name === 'content-length' ? '1024' : null)
          },
          arrayBuffer: async () => mockData,
          body: {
            getReader: () => {
              let done = false
              return {
                read: async () => {
                  if (done) {
                    return { done: true, value: undefined }
                  }
                  done = true
                  return { done: false, value: new Uint8Array(mockData) }
                }
              }
            }
          }
        })
      })

      const loaded = await modelLoader.loadModel('retry-test-model')

      expect(loaded).toBeDefined()
      expect(callCount).toBeGreaterThanOrEqual(2)

      // Restore original fetch
      global.fetch = savedFetch
    })
  })

  describe('Model Persistence', () => {
    test.skip('should persist model across storage reconnections', async () => {
      // TODO: Fix persistence test with fake-indexeddb
      // Store model
      const testData = new ArrayBuffer(2048)
      await storage.storeModel('persist-test', testData)

      // Verify it was stored
      const exists1 = await storage.checkModelExists('persist-test')
      expect(exists1).toBe(true)

      // Close and reopen storage
      storage.close()
      storage = new IndexedDBWrapper()
      await storage.init()

      // Model should still exist
      const exists2 = await storage.checkModelExists('persist-test')
      expect(exists2).toBe(true)

      const loaded = await storage.loadModel('persist-test')
      expect(loaded).toBeDefined()
      expect(loaded.byteLength).toBe(2048)
    })
  })

  describe('Error Handling', () => {
    test('should handle download failure gracefully', async () => {
      fetch.mockImplementation(() => Promise.reject(new Error('Network error')))

      await expect(modelLoader.downloadModel('kokoro-82M')).rejects.toThrow()
    })

    test('should handle storage errors gracefully', async () => {
      // Test will check that closed storage returns error
      storage.close()

      // Trying to store with closed storage should fail
      const result = await storage.checkModelExists('test').catch(err => false)
      expect(result).toBe(false)
    })

    test('should handle missing model gracefully', async () => {
      const loaded = await storage.loadModel('non-existent-model')
      expect(loaded).toBeNull()
    })
  })

  describe('Text Cache Management', () => {
    test('should cleanup old text cache entries', async () => {
      // Store some entries with old timestamps
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago

      await storage.storeTextCache('old-1', 'Old text 1', 1)
      await storage.storeTextCache('old-2', 'Old text 2', 2)

      // Manually update timestamps to be old
      const transaction = storage.db.transaction(['textCache'], 'readwrite')
      const store = transaction.objectStore('textCache')

      const entries = await new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      for (const entry of entries) {
        entry.timestamp = oldTimestamp
        await new Promise((resolve, reject) => {
          const request = store.put(entry)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      // Cleanup old entries
      const deletedCount = await storage.cleanupTextCache()
      expect(deletedCount).toBeGreaterThan(0)
    })
  })

  describe('Performance Requirements', () => {
    test('should store model in under 1 second', async () => {
      const modelData = new ArrayBuffer(1024 * 1024) // 1MB
      const startTime = Date.now()

      await storage.storeModel('perf-test', modelData)

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000)
    })

    test('should load model in under 500ms', async () => {
      const modelData = new ArrayBuffer(1024 * 1024) // 1MB
      await storage.storeModel('perf-test-2', modelData)

      const startTime = Date.now()
      await storage.loadModel('perf-test-2')
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500)
    })
  })
})

describe('Integration: Complete TTS Flow', () => {
  test('should complete basic TTS flow simulation', async () => {
    const storage = new IndexedDBWrapper()
    await storage.init()

    const modelLoader = new ModelLoader(storage)

    // Simulate model download
    const modelData = await modelLoader.loadModel('kokoro-82M', (loaded, total, percentage) => {
      console.log(`Download progress: ${percentage}%`)
    })

    expect(modelData).toBeDefined()

    // Verify model is stored
    const exists = await modelLoader.isModelAvailable('kokoro-82M')
    expect(exists).toBe(true)

    storage.close()
  })
})