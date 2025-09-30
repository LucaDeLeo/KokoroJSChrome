/**
 * @module BackgroundScript
 * @description Service worker entry point
 */

import { TTSCore } from '/core/tts-core.js'
import { DebugLogger } from '/tools/debug-logger.js'

const logger = new DebugLogger({
  prefix: '[KokoroJS-Background]',
  level: 'info'
})

let ttsCore = null

async function initializeBackground() {
  logger.info('Initializing background service worker')

  try {
    ttsCore = new TTSCore({
      enableDebugLogging: true,
      enablePerformanceMonitoring: true
    })

    await ttsCore.initialize()

    setupMessageHandlers()
    setupContextMenus()

    logger.info('Background service worker initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize background service worker:', error)
  }
}

function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'tts:request') {
      handleTTSRequest(message, sender, sendResponse)
      return true
    } else if (message.type === 'health:check') {
      handleHealthCheck(sendResponse)
      return true
    }
  })
}

function setupContextMenus() {
  chrome.contextMenus.create({
    id: 'kokoro-tts',
    title: 'Read with KokoroJS',
    contexts: ['selection']
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'kokoro-tts' && info.selectionText) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'tts:request',
        request: {
          text: info.selectionText,
          source: 'context-menu'
        }
      })
    }
  })
}

async function handleTTSRequest(message, sender, sendResponse) {
  try {
    const result = await ttsCore.process({
      ...message.request,
      tabId: sender.tab?.id,
      url: sender.tab?.url
    })
    sendResponse({ success: true, result })
  } catch (error) {
    logger.error('TTS request failed:', error)
    sendResponse({ success: false, error: error.message })
  }
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