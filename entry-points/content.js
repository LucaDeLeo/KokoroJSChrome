/**
 * @module ContentScript
 * @description Content script entry point
 */

import { TTSCore } from '/core/tts-core.js'
import { DebugLogger } from '/tools/debug-logger.js'

const logger = new DebugLogger({
  prefix: '[KokoroJS-Content]',
  level: 'info'
})

/**
 * Handle context menu TTS request
 * @param {TTSCore} core - TTS Core instance
 * @param {Object} message - Message from context menu
 * @returns {Promise<Object>}
 */
async function handleContextMenuRequest(core, message) {
  try {
    logger.info(`Context menu request: ${message.action}`)

    // Get the event bus from core
    const eventBus = core.eventBus

    if (!eventBus) {
      throw new Error('Event bus not available')
    }

    // Create TTS request event
    const event = {
      id: `tts-${Date.now()}`,
      type: 'tts:request',
      source: {
        type: message.action === 'speak-selection' ? 'selection' : 'page',
        tabId: 0, // Will be set by pipeline if needed
        url: window.location.href
      },
      request: {
        text: message.text || '',
        voice: 'af_bella',
        speed: 1.0
      },
      input: {
        text: message.text || '',
        voice: 'af_bella',
        speed: 1.0
      }
    }

    // For "read-page", we need to trigger extraction
    // The ContentExtractor plugin will handle this via the event bus
    if (message.action === 'read-page') {
      // Emit extraction request - ContentExtractor will handle this
      eventBus.emit('extraction:request', {
        mode: 'article',
        url: window.location.href,
        timestamp: Date.now()
      })
    } else if (message.action === 'speak-selection' && message.text) {
      // For selection, we already have the text, emit TTS request directly
      eventBus.emit('tts:request', event)
    }

    return { success: true, sessionId: event.id }
  } catch (error) {
    logger.error('Context menu request failed:', error)
    throw error
  }
}

async function initializeContentScript() {
  logger.info('Initializing content script')

  try {
    const core = new TTSCore({
      enableDebugLogging: true,
      enablePerformanceMonitoring: true
    })

    await core.initialize()

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'tts:request') {
        core.process(message.request)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true
      } else if (message.type === 'TTS_REQUEST') {
        // Handle context menu TTS requests
        handleContextMenuRequest(core, message)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }))
        return true
      }
    })

    logger.info('Content script initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize content script:', error)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript)
} else {
  initializeContentScript()
}