/**
 * @module BackgroundScript
 * @description Service worker entry point
 */

import { TTSCore } from '/core/tts-core.js'
import { DebugLogger } from '/tools/debug-logger.js'
import { IndexedDBWrapper } from '/platform/storage/indexeddb-wrapper.js'
import { ModelLoader } from '/core/model-loader.js'

const logger = new DebugLogger({
  prefix: '[KokoroJS-Background]',
  level: 'info'
})

let ttsCore = null
let storage = null
let modelLoader = null
let modelReady = false
let modelDownloading = false

async function initializeBackground() {
  logger.info('Initializing background service worker')

  try {
    // Initialize storage
    storage = new IndexedDBWrapper()
    await storage.init()
    await storage.requestPersistentStorage()

    // Initialize model loader
    modelLoader = new ModelLoader(storage)

    // Initialize TTS Core
    ttsCore = new TTSCore({
      enableDebugLogging: true,
      enablePerformanceMonitoring: true
    })

    await ttsCore.initialize()

    setupMessageHandlers()
    setupContextMenus()

    // Check if model is already available
    const isAvailable = await modelLoader.isModelAvailable('kokoro-82M')
    if (isAvailable) {
      modelReady = true
      logger.info('Model already available in storage')
    } else {
      logger.info('Model not available, will download on first TTS request')
    }

    logger.info('Background service worker initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize background service worker:', error)
  }
}

function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TTS_REQUEST') {
      handleTTSRequest(message, sender, sendResponse)
      return true
    } else if (message.type === 'TTS_STOP') {
      handleTTSStop(sendResponse)
      return true
    } else if (message.type === 'MODEL_STATUS') {
      handleModelStatus(sendResponse)
      return true
    } else if (message.type === 'tts:request') {
      handleTTSRequest(message, sender, sendResponse)
      return true
    } else if (message.type === 'health:check') {
      handleHealthCheck(sendResponse)
      return true
    }
  })
}

function setupContextMenus() {
  try {
    // Create "Speak selection" menu item (visible when text selected)
    chrome.contextMenus.create({
      id: 'kokoro-tts-speak-selection',
      title: 'Speak selection',
      contexts: ['selection']
    }, () => {
      if (chrome.runtime.lastError) {
        logger.error('Failed to create "Speak selection" context menu:', chrome.runtime.lastError)
      } else {
        logger.info('"Speak selection" context menu created successfully')
      }
    })

    // Create "Read page" menu item (always visible)
    chrome.contextMenus.create({
      id: 'kokoro-tts-read-page',
      title: 'Read page',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        logger.error('Failed to create "Read page" context menu:', chrome.runtime.lastError)
      } else {
        logger.info('"Read page" context menu created successfully')
      }
    })

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      try {
        if (info.menuItemId === 'kokoro-tts-speak-selection' && info.selectionText) {
          // Send message to content script to handle selection
          chrome.tabs.sendMessage(tab.id, {
            type: 'TTS_REQUEST',
            action: 'speak-selection',
            text: info.selectionText,
            source: 'context-menu'
          }).catch(error => {
            logger.error('Failed to send speak-selection message to content script:', error)
          })
        } else if (info.menuItemId === 'kokoro-tts-read-page') {
          // Send message to content script to handle page reading
          chrome.tabs.sendMessage(tab.id, {
            type: 'TTS_REQUEST',
            action: 'read-page',
            source: 'context-menu'
          }).catch(error => {
            logger.error('Failed to send read-page message to content script:', error)
          })
        }
      } catch (error) {
        logger.error('Error handling context menu click:', error)
      }
    })
  } catch (error) {
    logger.error('Failed to setup context menus:', error)
  }
}

async function handleTTSRequest(message, sender, sendResponse) {
  try {
    // Ensure model is loaded before processing
    if (!modelReady && !modelDownloading) {
      modelDownloading = true

      // Notify popup of download start
      chrome.runtime.sendMessage({
        type: 'MODEL_DOWNLOAD_PROGRESS',
        percentage: 0
      })

      try {
        await modelLoader.loadModel('kokoro-82M', (loaded, total, percentage) => {
          chrome.runtime.sendMessage({
            type: 'MODEL_DOWNLOAD_PROGRESS',
            loaded,
            total,
            percentage
          })
        })

        modelReady = true
        modelDownloading = false

        chrome.runtime.sendMessage({
          type: 'MODEL_READY'
        })

        logger.info('Model loaded successfully')
      } catch (error) {
        modelDownloading = false
        chrome.runtime.sendMessage({
          type: 'MODEL_ERROR',
          error: error.message
        })
        throw new Error(`Failed to load model: ${error.message}`)
      }
    }

    // Wait for model to be ready if currently downloading
    while (modelDownloading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Process TTS request through pipeline
    const request = message.payload || message.request || {}
    const event = {
      id: `tts-${Date.now()}`,
      type: 'tts:request',
      request: {
        text: request.text,
        voice: request.voice || 'af_bella',
        speed: request.speed || 1.0
      },
      tabId: sender.tab?.id,
      url: sender.tab?.url
    }

    const result = await ttsCore.process(event)

    sendResponse({
      status: 'playing',
      sessionId: event.id
    })

    // Notify popup of completion
    chrome.runtime.sendMessage({
      type: 'TTS_RESPONSE',
      status: 'completed',
      sessionId: event.id
    })
  } catch (error) {
    logger.error('TTS request failed:', error)
    sendResponse({
      status: 'error',
      error: error.message
    })

    chrome.runtime.sendMessage({
      type: 'TTS_RESPONSE',
      status: 'error',
      error: error.message
    })
  }
}

function handleTTSStop(sendResponse) {
  try {
    // TODO: Implement stop functionality in Core
    logger.info('TTS stop requested')
    sendResponse({ success: true })
  } catch (error) {
    logger.error('TTS stop failed:', error)
    sendResponse({ success: false, error: error.message })
  }
}

function handleModelStatus(sendResponse) {
  sendResponse({
    available: modelReady,
    downloading: modelDownloading
  })
}

async function handleHealthCheck(sendResponse) {
  try {
    const health = await ttsCore.healthCheck()
    sendResponse({ success: true, health })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

initializeBackground()