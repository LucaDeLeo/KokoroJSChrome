/**
 * @module StorageAdapter
 * @description Storage wrapper for IndexedDB, localStorage, and chrome.storage
 */

class StorageAdapter {
  constructor() {
    this.providers = new Map()
    this.defaultProvider = null
  }

  async initialize() {
    if (this._isChromeStorageAvailable()) {
      this.providers.set('chrome', new ChromeStorageProvider())
      this.defaultProvider = 'chrome'
    }

    if (this._isIndexedDBAvailable()) {
      this.providers.set('indexedDB', new IndexedDBProvider())
      if (!this.defaultProvider) {
        this.defaultProvider = 'indexedDB'
      }
    }

    if (this._isLocalStorageAvailable()) {
      this.providers.set('localStorage', new LocalStorageProvider())
      if (!this.defaultProvider) {
        this.defaultProvider = 'localStorage'
      }
    }

    for (const provider of this.providers.values()) {
      await provider.initialize()
    }
  }

  async cleanup() {
    for (const provider of this.providers.values()) {
      await provider.cleanup()
    }
    this.providers.clear()
    this.defaultProvider = null
  }

  async get(key, options = {}) {
    const provider = this._selectProvider(options.provider)
    return provider.get(key, options)
  }

  async set(key, value, options = {}) {
    const provider = this._selectProvider(options.provider)
    return provider.set(key, value, options)
  }

  async remove(key, options = {}) {
    const provider = this._selectProvider(options.provider)
    return provider.remove(key, options)
  }

  async clear(options = {}) {
    const provider = this._selectProvider(options.provider)
    return provider.clear(options)
  }

  async getAllKeys(options = {}) {
    const provider = this._selectProvider(options.provider)
    return provider.getAllKeys(options)
  }

  isAvailable(providerName) {
    return this.providers.has(providerName)
  }

  getCapabilities() {
    const capabilities = {}
    for (const [name, provider] of this.providers.entries()) {
      capabilities[name] = provider.getCapabilities()
    }
    return capabilities
  }

  async test() {
    const testKey = '__storage_test__'
    const testValue = { test: true, timestamp: Date.now() }

    try {
      await this.set(testKey, testValue)
      const retrieved = await this.get(testKey)
      await this.remove(testKey)

      return {
        success: true,
        provider: this.defaultProvider,
        value: retrieved
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  _selectProvider(providerName) {
    const name = providerName || this.defaultProvider
    const provider = this.providers.get(name)

    if (!provider) {
      throw new Error(`Storage provider not available: ${name}`)
    }

    return provider
  }

  _isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' &&
           chrome.storage &&
           chrome.storage.local
  }

  _isIndexedDBAvailable() {
    return typeof indexedDB !== 'undefined'
  }

  _isLocalStorageAvailable() {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }
}

class ChromeStorageProvider {
  async initialize() {
    this.syncAvailable = chrome.storage.sync !== undefined
    this.localAvailable = chrome.storage.local !== undefined
  }

  async cleanup() {}

  async get(key, options = {}) {
    const storage = options.sync ? chrome.storage.sync : chrome.storage.local
    return new Promise((resolve, reject) => {
      storage.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(result[key])
        }
      })
    })
  }

  async set(key, value, options = {}) {
    const storage = options.sync ? chrome.storage.sync : chrome.storage.local
    return new Promise((resolve, reject) => {
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve()
        }
      })
    })
  }

  async remove(key, options = {}) {
    const storage = options.sync ? chrome.storage.sync : chrome.storage.local
    return new Promise((resolve, reject) => {
      storage.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve()
        }
      })
    })
  }

  async clear(options = {}) {
    const storage = options.sync ? chrome.storage.sync : chrome.storage.local
    return new Promise((resolve, reject) => {
      storage.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve()
        }
      })
    })
  }

  async getAllKeys(options = {}) {
    const storage = options.sync ? chrome.storage.sync : chrome.storage.local
    return new Promise((resolve, reject) => {
      storage.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(Object.keys(items))
        }
      })
    })
  }

  getCapabilities() {
    return {
      sync: this.syncAvailable,
      local: this.localAvailable,
      maxSize: {
        sync: 102400,
        local: 10485760
      }
    }
  }
}

class IndexedDBProvider {
  async initialize() {
    this.dbName = 'kokorojs-storage'
    this.storeName = 'keyvalue'
    this.db = null
  }

  async cleanup() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  async _getDB() {
    if (this.db) {
      return this.db
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' })
        }
      }
    })
  }

  async get(key) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : undefined)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async set(key, value) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async remove(key) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear() {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllKeys() {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  getCapabilities() {
    return {
      persistent: true,
      maxSize: 'unlimited',
      async: true
    }
  }
}

class LocalStorageProvider {
  async initialize() {}
  async cleanup() {}

  async get(key) {
    const value = localStorage.getItem(key)
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  async set(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, serialized)
  }

  async remove(key) {
    localStorage.removeItem(key)
  }

  async clear() {
    localStorage.clear()
  }

  async getAllKeys() {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i))
    }
    return keys
  }

  getCapabilities() {
    return {
      persistent: false,
      maxSize: 5242880,
      async: false
    }
  }
}

export { StorageAdapter }