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