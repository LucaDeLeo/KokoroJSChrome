/**
 * @module SelectionHandler
 * @description Handles text selection detection and TTS request creation
 */

/**
 * @typedef {Object} TTSEvent
 * @property {string} id - Unique event ID
 * @property {string} type - Event type ('tts:request')
 * @property {Object} source - Source information
 * @property {Object} request - TTS request data
 * @property {Object} metadata - Event metadata
 */

class SelectionHandler {
  constructor(eventBus, pal, config = {}) {
    this.eventBus = eventBus
    this.pal = pal
    this.config = config

    // Configuration
    this.debounceDelay = config.debounceDelay || 200
    this.minSelectionLength = config.minSelectionLength || 1
    this.maxTextLength = config.maxTextLength || 100000

    // Tab tracking (null in content script context, set by background when available)
    this.tabId = config.tabId || null

    // State
    this.debounceTimer = null
    this.lastSelection = null
    this.isInitialized = false

    // Bound event handlers
    this.handleMouseUp = this._handleMouseUp.bind(this)
    this.handleSelectionChange = this._handleSelectionChange.bind(this)
  }

  /**
   * Initialize selection handler
   * @returns {Promise<void>}
   */
  async init() {
    try {
      if (this.isInitialized) {
        console.warn('SelectionHandler already initialized')
        return
      }

      // Add event listeners
      document.addEventListener('mouseup', this.handleMouseUp)
      document.addEventListener('selectionchange', this.handleSelectionChange)

      this.isInitialized = true
      console.log('SelectionHandler initialized')
    } catch (error) {
      console.error('SelectionHandler init error:', error)
      throw error
    }
  }

  /**
   * Cleanup selection handler
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Remove event listeners
      document.removeEventListener('mouseup', this.handleMouseUp)
      document.removeEventListener('selectionchange', this.handleSelectionChange)

      // Clear debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }

      // Clear state
      this.lastSelection = null
      this.isInitialized = false

      console.log('SelectionHandler cleaned up')
    } catch (error) {
      console.error('SelectionHandler cleanup error:', error)
      throw error
    }
  }

  /**
   * Get current selection
   * @returns {Object|null}
   */
  getSelection() {
    try {
      const selection = window.getSelection()

      if (!selection || selection.rangeCount === 0) {
        return null
      }

      const text = selection.toString().trim()

      if (!text || text.length < this.minSelectionLength) {
        return null
      }

      // Get selection bounding rect for positioning
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      return {
        text,
        length: text.length,
        rect: {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        },
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error getting selection:', error)
      return null
    }
  }

  /**
   * Create TTSEvent from selection
   * @param {Object} selection - Selection data
   * @returns {Promise<TTSEvent>}
   */
  async createTTSEvent(selection) {
    try {
      const eventId = this._generateUUID()
      const tabId = await this._getTabId()

      // Handle large text (>50KB)
      let text = selection.text
      let textId = undefined

      if (selection.text.length > 50000) {
        // Store in IndexedDB
        if (this.pal.indexeddb) {
          textId = await this.pal.indexeddb.storeText({
            text: selection.text,
            tabId,
            timestamp: Date.now(),
            size: selection.text.length,
            extracted: false
          })
          text = undefined
        } else {
          // Truncate if IndexedDB not available
          text = selection.text.substring(0, 50000)
          console.warn('Text truncated to 50KB (IndexedDB not available)')
        }
      }

      const ttsEvent = {
        id: eventId,
        type: 'tts:request',
        source: {
          type: 'selection',
          tabId,
          url: window.location.href
        },
        request: {
          text,
          textId,
          voice: 'af_bella',
          speed: 1.0
        },
        input: {
          // Only store text if not using textId (avoids duplicating large text in payload)
          text: textId ? undefined : selection.text,
          textId,
          voice: 'af_bella',
          speed: 1.0
        },
        metadata: {
          timing: {
            started: Date.now(),
            extractionStarted: selection.timestamp,
            extractionCompleted: Date.now()
          },
          performance: {
            extractionLatency: Date.now() - selection.timestamp
          }
        }
      }

      return ttsEvent
    } catch (error) {
      console.error('Error creating TTS event:', error)
      throw error
    }
  }

  // Private methods

  /**
   * Handle mouseup event
   * @param {MouseEvent} event - Mouse event
   */
  _handleMouseUp(event) {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Debounce selection handling
    this.debounceTimer = setTimeout(() => {
      this._processSelection()
    }, this.debounceDelay)
  }

  /**
   * Handle selection change event
   * @param {Event} event - Selection change event
   */
  _handleSelectionChange(event) {
    // Store selection for later processing
    // This is mainly for tracking, actual processing happens on mouseup
  }

  /**
   * Process current selection
   */
  async _processSelection() {
    try {
      const selection = this.getSelection()

      if (!selection) {
        // Clear last selection
        this.lastSelection = null
        // Emit selection cleared event
        if (this.eventBus) {
          this.eventBus.emit('selection:cleared', {})
        }
        return
      }

      // Check if selection changed
      if (this.lastSelection && this.lastSelection.text === selection.text) {
        return
      }

      this.lastSelection = selection

      // Emit selection detected event
      if (this.eventBus) {
        this.eventBus.emit('selection:detected', {
          selection,
          timestamp: Date.now()
        })
      }

      // Create TTS event (but don't send yet - wait for user action)
      // The floating button will handle the actual TTS request
    } catch (error) {
      console.error('Error processing selection:', error)
    }
  }

  /**
   * Generate UUID
   * @returns {string}
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Get current tab ID
   * @returns {Promise<number|null>}
   */
  async _getTabId() {
    // Return cached tabId (null in content script context)
    // Background script enriches messages with sender.tab.id when received
    // This is a Chrome extension architecture limitation:
    // chrome.tabs.getCurrent() only works in popup/options, not content scripts
    return this.tabId
  }
}

export default SelectionHandler