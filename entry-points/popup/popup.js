/**
 * @module PopupScript
 * @description Popup interface
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status')
  const readBtn = document.getElementById('readSelection')
  const stopBtn = document.getElementById('stop')
  const optionsBtn = document.getElementById('options')

  readBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    chrome.tabs.sendMessage(tab.id, {
      type: 'tts:request',
      request: {
        action: 'read-selection',
        source: 'popup'
      }
    }, response => {
      if (response?.success) {
        statusEl.textContent = 'Reading...'
      } else {
        statusEl.textContent = 'Error: ' + (response?.error || 'Unknown')
      }
    })
  })

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'tts:stop'
    })
    statusEl.textContent = 'Stopped'
  })

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })

  chrome.runtime.sendMessage({ type: 'health:check' }, response => {
    if (response?.success) {
      statusEl.textContent = 'System: ' + response.health.status
    }
  })
})