/**
 * @module PAL
 * @description Platform Abstraction Layer - Central interface for all platform adapters
 */

import { StorageAdapter } from './storage-adapter.js'
import { MessagingAdapter } from './messaging-adapter.js'
import { AudioAdapter } from './audio-adapter.js'
import { UIAdapter } from './ui-adapter.js'
import { ManifestAdapter } from './manifest-adapter.js'

class PAL {
  constructor() {
    this.storage = new StorageAdapter()
    this.messaging = new MessagingAdapter()
    this.audio = new AudioAdapter()
    this.ui = new UIAdapter()
    this.manifest = new ManifestAdapter()
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) {
      return
    }

    try {
      await Promise.all([
        this.storage.initialize(),
        this.messaging.initialize(),
        this.audio.initialize(),
        this.ui.initialize(),
        this.manifest.initialize()
      ])
      this.initialized = true
    } catch (error) {
      console.error('PAL initialization failed:', error)
      throw error
    }
  }

  async cleanup() {
    if (!this.initialized) {
      return
    }

    try {
      await Promise.all([
        this.storage.cleanup(),
        this.messaging.cleanup(),
        this.audio.cleanup(),
        this.ui.cleanup(),
        this.manifest.cleanup()
      ])
      this.initialized = false
    } catch (error) {
      console.error('PAL cleanup failed:', error)
      throw error
    }
  }

  isAvailable(feature) {
    switch (feature) {
      case 'chrome.storage':
        return this.storage.isAvailable('chrome')
      case 'indexedDB':
        return this.storage.isAvailable('indexedDB')
      case 'offscreen':
        return this.audio.isOffscreenAvailable()
      case 'shadowDOM':
        return this.ui.isShadowDOMAvailable()
      case 'messaging':
        return this.messaging.isAvailable()
      default:
        return false
    }
  }

  getCapabilities() {
    return {
      storage: this.storage.getCapabilities(),
      messaging: this.messaging.getCapabilities(),
      audio: this.audio.getCapabilities(),
      ui: this.ui.getCapabilities(),
      manifest: this.manifest.getCapabilities()
    }
  }

  async testConnectivity() {
    const results = {}

    try {
      results.storage = await this.storage.test()
    } catch (error) {
      results.storage = { success: false, error: error.message }
    }

    try {
      results.messaging = await this.messaging.test()
    } catch (error) {
      results.messaging = { success: false, error: error.message }
    }

    try {
      results.audio = await this.audio.test()
    } catch (error) {
      results.audio = { success: false, error: error.message }
    }

    try {
      results.ui = await this.ui.test()
    } catch (error) {
      results.ui = { success: false, error: error.message }
    }

    return results
  }
}

export { PAL }