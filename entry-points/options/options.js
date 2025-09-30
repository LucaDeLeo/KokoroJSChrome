/**
 * @module OptionsScript
 * @description Options page functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  const voiceEl = document.getElementById('voice')
  const speedEl = document.getElementById('speed')
  const speedValueEl = document.getElementById('speedValue')
  const autoReadEl = document.getElementById('autoRead')
  const saveBtn = document.getElementById('save')
  const statusEl = document.getElementById('status')

  speedEl.addEventListener('input', () => {
    speedValueEl.textContent = `${speedEl.value}x`
  })

  chrome.storage.sync.get(['voice', 'speed', 'autoRead'], (result) => {
    if (result.voice) voiceEl.value = result.voice
    if (result.speed) {
      speedEl.value = result.speed
      speedValueEl.textContent = `${result.speed}x`
    }
    if (result.autoRead !== undefined) {
      autoReadEl.checked = result.autoRead
    }
  })

  saveBtn.addEventListener('click', () => {
    const options = {
      voice: voiceEl.value,
      speed: parseFloat(speedEl.value),
      autoRead: autoReadEl.checked
    }

    chrome.storage.sync.set(options, () => {
      statusEl.textContent = 'Options saved!'
      statusEl.className = 'status success'

      setTimeout(() => {
        statusEl.className = 'status'
      }, 3000)
    })
  })
})