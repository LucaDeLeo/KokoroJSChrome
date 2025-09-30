/**
 * @module PopupScript
 * @description Popup interface for TTS control
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI elements
  const modelIndicator = document.getElementById('modelIndicator')
  const modelStatusText = document.getElementById('modelStatusText')
  const progressContainer = document.getElementById('progressContainer')
  const progressFill = document.getElementById('progressFill')
  const textInput = document.getElementById('textInput')
  const voiceSelect = document.getElementById('voiceSelect')
  const speedControl = document.getElementById('speedControl')
  const speedValue = document.getElementById('speedValue')
  const speakBtn = document.getElementById('speakBtn')
  const stopBtn = document.getElementById('stopBtn')
  const readSelectionBtn = document.getElementById('readSelection')
  const optionsBtn = document.getElementById('optionsBtn')
  const statusMessage = document.getElementById('statusMessage')

  let isPlaying = false

  /**
   * Update model status UI
   * @param {string} status - Status: 'not-downloaded', 'downloading', 'ready'
   * @param {string} text - Status text
   */
  function updateModelStatus(status, text) {
    modelIndicator.className = `indicator ${status}`
    modelStatusText.textContent = text
  }

  /**
   * Update download progress
   * @param {number} percentage - Progress percentage (0-100)
   */
  function updateProgress(percentage) {
    progressFill.style.width = `${percentage}%`
    progressFill.textContent = `${percentage}%`
  }

  /**
   * Show progress bar
   */
  function showProgress() {
    progressContainer.style.display = 'block'
  }

  /**
   * Hide progress bar
   */
  function hideProgress() {
    progressContainer.style.display = 'none'
  }

  /**
   * Show status message
   * @param {string} message - Message text
   * @param {string} type - Message type: 'info', 'success', 'error'
   */
  function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message
    statusMessage.className = `status-message ${type}`
    statusMessage.style.display = 'block'
  }

  /**
   * Hide status message
   */
  function hideStatusMessage() {
    statusMessage.style.display = 'none'
  }

  /**
   * Update button states
   */
  function updateButtonStates() {
    speakBtn.disabled = isPlaying
    stopBtn.disabled = !isPlaying
  }

  // Speed control handler
  speedControl.addEventListener('input', (e) => {
    speedValue.textContent = parseFloat(e.target.value).toFixed(1)
  })

  // Speak button handler
  speakBtn.addEventListener('click', async () => {
    const text = textInput.value.trim()
    if (!text) {
      showStatusMessage('Please enter some text', 'error')
      return
    }

    hideStatusMessage()
    isPlaying = true
    updateButtonStates()

    try {
      // Send TTS request to background
      const response = await chrome.runtime.sendMessage({
        type: 'TTS_REQUEST',
        payload: {
          text,
          voice: voiceSelect.value,
          speed: parseFloat(speedControl.value)
        }
      })

      if (response?.status === 'playing') {
        showStatusMessage('Playing...', 'info')
      } else if (response?.error) {
        showStatusMessage(`Error: ${response.error}`, 'error')
        isPlaying = false
        updateButtonStates()
      }
    } catch (error) {
      console.error('Failed to send TTS request:', error)
      showStatusMessage(`Error: ${error.message}`, 'error')
      isPlaying = false
      updateButtonStates()
    }
  })

  // Stop button handler
  stopBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'TTS_STOP'
      })

      showStatusMessage('Stopped', 'info')
      isPlaying = false
      updateButtonStates()
    } catch (error) {
      console.error('Failed to stop TTS:', error)
    }
  })

  // Read selection button handler
  readSelectionBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      chrome.tabs.sendMessage(tab.id, {
        type: 'tts:request',
        request: {
          action: 'read-selection',
          source: 'popup'
        }
      }, response => {
        if (response?.success) {
          showStatusMessage('Reading selection...', 'info')
          isPlaying = true
          updateButtonStates()
        } else {
          showStatusMessage('Error: ' + (response?.error || 'No text selected'), 'error')
        }
      })
    } catch (error) {
      console.error('Failed to read selection:', error)
      showStatusMessage(`Error: ${error.message}`, 'error')
    }
  })

  // Options button handler
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })

  // Listen for pipeline events
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TTS_RESPONSE') {
      if (message.status === 'completed') {
        showStatusMessage('Completed', 'success')
        isPlaying = false
        updateButtonStates()
      } else if (message.status === 'error') {
        showStatusMessage(`Error: ${message.error}`, 'error')
        isPlaying = false
        updateButtonStates()
      } else if (message.status === 'playing') {
        showStatusMessage('Playing...', 'info')
      }
    } else if (message.type === 'MODEL_DOWNLOAD_PROGRESS') {
      showProgress()
      updateProgress(message.percentage)
      updateModelStatus('downloading', `Downloading model... ${message.percentage}%`)
    } else if (message.type === 'MODEL_READY') {
      hideProgress()
      updateModelStatus('ready', 'Model ready')
      showStatusMessage('Model ready', 'success')
    } else if (message.type === 'MODEL_ERROR') {
      hideProgress()
      updateModelStatus('not-downloaded', 'Model not available')
      showStatusMessage(`Model error: ${message.error}`, 'error')
    }

    sendResponse({ success: true })
    return true
  })

  // Check model status on load
  try {
    const response = await chrome.runtime.sendMessage({ type: 'MODEL_STATUS' })

    if (response?.available) {
      updateModelStatus('ready', 'Model ready')
    } else if (response?.downloading) {
      updateModelStatus('downloading', 'Downloading model...')
      showProgress()
    } else {
      updateModelStatus('not-downloaded', 'Model not downloaded')
      showStatusMessage('Click "Speak" to download model', 'info')
    }
  } catch (error) {
    console.error('Failed to check model status:', error)
    updateModelStatus('not-downloaded', 'Status unknown')
  }

  // Initialize button states
  updateButtonStates()
})