/**
 * @module ContentExtractorPlugin
 * @description Text extraction plugin with simple and advanced modes
 */

import SimpleExtractor from './simple-extractor.js'
import ReadabilityWrapper from './readability-wrapper.js'
import SelectionHandler from './selection-handler.js'
import FloatingButton from './floating-button.js'

/**
 * @typedef {Object} ExtractedContent
 * @property {string} text - Extracted text content
 * @property {string} [textId] - Reference to IndexedDB if large (>50KB)
 * @property {string} [title] - Article title
 * @property {string} [excerpt] - Article excerpt
 * @property {string} [byline] - Author info
 * @property {number} length - Text length in characters
 * @property {number} wordCount - Word count
 * @property {'simple'|'advanced'} extractionMode - Extraction mode used
 * @property {string} url - Source URL
 * @property {number} timestamp - Extraction time
 */

/**
 * @typedef {Object} ExtractionOptions
 * @property {'selection'|'article'|'full'|'custom'} mode - Extraction mode
 * @property {string} [selector] - Custom selector for extraction
 * @property {Array} [filters] - Content filters
 */

class ContentExtractorPlugin {
  constructor(config = {}) {
    this.id = 'content-extractor'
    this.name = 'ContentExtractor'
    this.version = '1.0.0'
    this.stage = 'extraction'
    this.config = config

    // Plugin dependencies
    this.eventBus = null
    this.pal = null

    // Extractors
    this.simpleExtractor = null
    this.readabilityWrapper = null
    this.selectionHandler = null
    this.floatingButton = null

    // Configuration
    this.debounceDelay = config.debounceDelay || 200
    this.maxTextLength = config.maxTextLength || 100000
    this.buttonTimeout = config.buttonTimeout || 10000
    this.defaultVoice = config.defaultVoice || 'af_bella'
    this.defaultSpeed = config.defaultSpeed || 1.0

    // Tab tracking (null in content script context, set by background when available)
    this.tabId = config.tabId || null

    // Performance tracking
    this.extractionCount = 0
    this.lastExtractionTime = 0
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

      // Initialize extractors
      this.simpleExtractor = new SimpleExtractor()
      this.readabilityWrapper = new ReadabilityWrapper()
      this.selectionHandler = new SelectionHandler(eventBus, pal, {
        debounceDelay: this.debounceDelay
      })
      this.floatingButton = new FloatingButton({
        timeout: this.buttonTimeout
      })

      // Initialize selection handler
      await this.selectionHandler.init()

      // Set up floating button click handler
      this.floatingButton.onClick = async (action) => {
        await this._handleButtonClick(action)
      }

      // Wire selection detection to floating button display
      this.eventBus.subscribe('selection:detected', this._handleSelectionDetected.bind(this))
      this.eventBus.subscribe('selection:cleared', this._handleSelectionCleared.bind(this))

      // Subscribe to TTS events
      this.eventBus.subscribe('tts:extract', this._handleExtractionEvent.bind(this))

      console.log(`${this.name} v${this.version} initialized at stage: ${this.stage}`)
      return true
    } catch (error) {
      console.error(`Failed to initialize ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Process TTSEvent through the plugin
   * @param {Object} event - TTSEvent to process
   * @param {Object} context - Processing context
   * @returns {Promise<Object>}
   */
  async process(event, context) {
    try {
      // Validate event structure
      if (!event || !event.type) {
        throw new Error('Invalid event: missing type')
      }

      // Track processing
      event.metadata = event.metadata || {}
      event.metadata.processedBy = event.metadata.processedBy || []
      event.metadata.processedBy.push(this.id)

      // Route to appropriate handler
      switch (event.type) {
        case 'tts:extract':
          return await this._processExtraction(event, context)
        default:
          console.warn(`${this.name} received unknown event type: ${event.type}`)
          return event
      }
    } catch (error) {
      console.error(`${this.name} process error:`, error)
      event.error = {
        message: error.message,
        plugin: this.id,
        timestamp: Date.now()
      }
      return event
    }
  }

  /**
   * Extract content based on options
   * @param {ExtractionOptions} options - Extraction options
   * @returns {Promise<ExtractedContent>}
   */
  async extract(options) {
    try {
      const startTime = performance.now()

      let result
      switch (options.mode) {
        case 'selection':
          result = await this._extractSelection()
          break
        case 'article':
          result = await this._extractArticle()
          break
        case 'full':
          result = await this._extractFull()
          break
        case 'custom':
          result = await this._extractCustom(options.selector, options.filters)
          break
        default:
          throw new Error(`Unknown extraction mode: ${options.mode}`)
      }

      // Calculate metrics
      const endTime = performance.now()
      this.lastExtractionTime = endTime - startTime
      this.extractionCount++

      // Add metadata
      result.url = window.location.href
      result.timestamp = Date.now()

      // Handle large text (>50KB)
      if (result.text.length > 50000 && this.pal.indexeddb) {
        const textId = await this.pal.indexeddb.storeText({
          text: result.text,
          tabId: await this._getTabId(),
          timestamp: Date.now(),
          size: result.text.length,
          extracted: true
        })
        result.textId = textId
      }

      return result
    } catch (error) {
      console.error('Extraction error:', error)
      throw error
    }
  }

  /**
   * Extract article using Readability.js (advanced mode)
   * @param {Document} [doc] - Document to extract from
   * @returns {Promise<ExtractedContent>}
   */
  async extractArticle(doc = document) {
    try {
      // Try advanced mode first
      const result = await this.readabilityWrapper.extract(doc)

      if (result && result.text && result.text.trim().length > 0) {
        return result
      }

      // Fallback to simple mode
      console.log('Readability extraction failed or returned empty content, falling back to simple mode')
      return await this.extractSimple(doc)
    } catch (error) {
      console.error('Advanced extraction failed, falling back to simple mode:', error)
      return await this.extractSimple(doc)
    }
  }

  /**
   * Extract content from main/article elements (simple mode)
   * @param {Document} [doc] - Document to extract from
   * @returns {Promise<ExtractedContent>}
   */
  async extractSimple(doc = document) {
    return this.simpleExtractor.extract(doc)
  }

  /**
   * Get plugin capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      supportsReadability: true,
      supportsShadowDOM: true,
      maxTextSize: this.maxTextLength,
      supportedModes: ['selection', 'article', 'full', 'custom']
    }
  }

  /**
   * Cleanup plugin resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      console.log(`${this.name} cleaning up...`)

      // Cleanup selection handler
      if (this.selectionHandler) {
        await this.selectionHandler.cleanup()
      }

      // Cleanup floating button
      if (this.floatingButton) {
        this.floatingButton.hide()
      }

      // Clear references
      this.eventBus = null
      this.pal = null
      this.simpleExtractor = null
      this.readabilityWrapper = null
      this.selectionHandler = null
      this.floatingButton = null

      // Reset counters
      this.extractionCount = 0
      this.lastExtractionTime = 0

      console.log(`${this.name} cleaned up successfully`)
    } catch (error) {
      console.error(`${this.name} cleanup error:`, error)
      throw error
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return {
      healthy: true,
      extractionCount: this.extractionCount,
      lastExtractionTime: this.lastExtractionTime,
      initialized: this.eventBus !== null && this.pal !== null,
      capabilities: this.getCapabilities()
    }
  }

  // Private methods

  async _extractSelection() {
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''

    if (!text) {
      throw new Error('No text selected')
    }

    return {
      text,
      length: text.length,
      wordCount: text.split(/\s+/).length,
      extractionMode: 'simple',
      url: window.location.href,
      timestamp: Date.now()
    }
  }

  async _extractArticle() {
    return await this.extractArticle()
  }

  async _extractFull() {
    return this.simpleExtractor.extractAll(document)
  }

  async _extractCustom(selector, filters) {
    return this.simpleExtractor.extractCustom(document, selector, filters)
  }

  async _handleButtonClick(action) {
    try {
      let extractedContent

      if (action === 'read-selection') {
        extractedContent = await this._extractSelection()
      } else if (action === 'read-page') {
        extractedContent = await this._extractArticle()
      }

      if (extractedContent) {
        // Create TTS request
        await this._sendTTSRequest(extractedContent)
      }

      // Hide button after click
      this.floatingButton.hide()
    } catch (error) {
      console.error('Error handling button click:', error)
    }
  }

  async _sendTTSRequest(extractedContent) {
    try {
      const payload = {
        text: extractedContent.textId ? undefined : extractedContent.text,
        textId: extractedContent.textId,
        voice: this.defaultVoice,
        speed: this.defaultSpeed,
        source: {
          type: extractedContent.textId ? 'page' : 'selection',
          url: extractedContent.url
        }
      }

      // Send message to background
      if (this.pal.messaging) {
        await this.pal.messaging.sendMessage({
          type: 'TTS_REQUEST',
          tabId: await this._getTabId(),
          payload
        })
      }

      // Emit event to event bus
      this.eventBus.emit('tts:request', {
        type: 'tts:request',
        data: payload,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Error sending TTS request:', error)
      throw error
    }
  }

  async _getTabId() {
    // Return cached tabId (null in content script context)
    // Background script enriches messages with sender.tab.id when received
    // This is a Chrome extension architecture limitation:
    // chrome.tabs.getCurrent() only works in popup/options, not content scripts
    return this.tabId
  }

  // Event handlers

  _handleSelectionDetected(event) {
    try {
      const { selection } = event
      if (selection && selection.rect) {
        // Show floating button near selection
        this.floatingButton.show(selection.rect)
      }
    } catch (error) {
      console.error('Error handling selection detected:', error)
    }
  }

  _handleSelectionCleared(event) {
    try {
      // Hide floating button when selection is cleared
      this.floatingButton.hide()
    } catch (error) {
      console.error('Error handling selection cleared:', error)
    }
  }

  async _handleExtractionEvent(event) {
    try {
      const result = await this.extract(event.data)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async _processExtraction(event, context) {
    const result = await this.extract(event.data)
    event.result = result
    event.completed = true
    return event
  }
}

export default ContentExtractorPlugin