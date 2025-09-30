/**
 * @module ControlPanel
 * @description Shadow DOM control panel for TTS playback control (mini player)
 */

class ControlPanel {
  constructor(config = {}) {
    this.config = config

    // Configuration
    this.theme = config.theme || 'default'
    this.enableAnimations = config.enableAnimations !== false
    this.defaultVoice = config.defaultVoice || 'af_bella'
    this.defaultSpeed = config.defaultSpeed || 1.0
    this.defaultVolume = config.defaultVolume || 100
    this.position = config.position || 'bottom-right'

    // State
    this.container = null
    this.shadowRoot = null
    this.isVisible = false
    this.isMinimized = false
    this.currentVoice = this.defaultVoice
    this.currentSpeed = this.defaultSpeed
    this.currentVolume = this.defaultVolume
    this.currentStatus = 'Ready'
    this.currentProgress = 0

    // UI Elements
    this.panelContent = null
    this.minimizeButton = null
    this.playButton = null
    this.pauseButton = null
    this.stopButton = null
    this.resumeButton = null
    this.voiceSelect = null
    this.speedSlider = null
    this.speedValue = null
    this.volumeSlider = null
    this.volumeValue = null
    this.statusDisplay = null
    this.progressDisplay = null

    // Callbacks
    this.onPlayClick = null
    this.onPauseClick = null
    this.onStopClick = null
    this.onResumeClick = null
    this.onVoiceChange = null
    this.onSpeedChange = null
    this.onVolumeChange = null
  }

  /**
   * Render control panel component
   * @param {Object} options - Render options
   * @param {Array} [options.voices] - Available voices
   * @param {string} [options.currentVoice] - Current voice ID
   * @param {number} [options.currentSpeed] - Current speed (0.5-3.0)
   * @param {number} [options.currentVolume] - Current volume (0-100)
   * @param {boolean} [options.minimized] - Panel minimized state
   * @returns {Promise<number>} Render time in milliseconds
   */
  async render(options = {}) {
    try {
      const startTime = performance.now()

      // Create container if not exists
      if (!this.container) {
        this._createContainer()
      }

      // Update configuration
      if (options.currentVoice) {
        this.currentVoice = options.currentVoice
      }
      if (options.currentSpeed !== undefined) {
        this.currentSpeed = options.currentSpeed
      }
      if (options.currentVolume !== undefined) {
        this.currentVolume = options.currentVolume
      }
      if (options.minimized !== undefined) {
        this.isMinimized = options.minimized
      }

      // Populate voices if provided
      if (options.voices && Array.isArray(options.voices)) {
        this._populateVoices(options.voices)
      }

      // Update UI to reflect current state
      this._updateUIState()

      // Show panel
      this.show()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Warn if render time exceeds target (300ms)
      if (renderTime > 300) {
        console.warn(`ControlPanel render took ${renderTime}ms (target: <300ms)`)
      }

      return renderTime
    } catch (error) {
      console.error('Error rendering control panel:', error)
      throw error
    }
  }

  /**
   * Show control panel
   */
  show() {
    try {
      if (this.isVisible) {
        return
      }

      // Show container
      this.container.style.display = 'block'

      // Trigger slide-in animation
      if (this.enableAnimations) {
        requestAnimationFrame(() => {
          this.container.style.transform = 'translateX(0)'
          this.container.style.opacity = '1'
        })
      } else {
        this.container.style.transform = 'translateX(0)'
        this.container.style.opacity = '1'
      }

      this.isVisible = true
    } catch (error) {
      console.error('Error showing control panel:', error)
    }
  }

  /**
   * Hide control panel
   */
  hide() {
    try {
      if (!this.isVisible) {
        return
      }

      // Slide out
      this.container.style.transform = 'translateX(100%)'
      this.container.style.opacity = '0'

      // Hide after animation
      const delay = this.enableAnimations ? 300 : 0
      setTimeout(() => {
        this.container.style.display = 'none'
        this.isVisible = false
      }, delay)
    } catch (error) {
      console.error('Error hiding control panel:', error)
    }
  }

  /**
   * Toggle minimized state
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized
    this._updateMinimizedState()
  }

  /**
   * Update status display
   * @param {string} status - Status message
   * @param {number} [progress] - Progress value (0-100)
   */
  updateStatus(status, progress) {
    try {
      if (status !== undefined) {
        this.currentStatus = status
        if (this.statusDisplay) {
          this.statusDisplay.textContent = status
        }
      }

      if (progress !== undefined) {
        this.currentProgress = Math.max(0, Math.min(100, progress))
        if (this.progressDisplay) {
          this.progressDisplay.textContent = `${Math.round(this.currentProgress)}%`
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  /**
   * Cleanup control panel resources
   */
  async cleanup() {
    try {
      // Remove event listeners (handled by Shadow DOM cleanup)

      // Remove from DOM
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container)
      }

      this.container = null
      this.shadowRoot = null
      this.isVisible = false

      // Clear callbacks
      this.onPlayClick = null
      this.onPauseClick = null
      this.onStopClick = null
      this.onResumeClick = null
      this.onVoiceChange = null
      this.onSpeedChange = null
      this.onVolumeChange = null
    } catch (error) {
      console.error('Error cleaning up control panel:', error)
    }
  }

  // Private methods

  /**
   * Create container with Shadow DOM
   * @private
   */
  _createContainer() {
    // Create container element
    this.container = document.createElement('div')
    this.container.id = 'kokoro-tts-control-panel'
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483646;
      display: none;
      opacity: 0;
      transform: translateX(100%);
      transition: transform 0.3s ease, opacity 0.3s ease;
      pointer-events: auto;
    `

    // Create Shadow DOM (closed mode for security and CSS isolation)
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' })

    // Create control panel UI
    this._createPanelUI()

    // Add to document
    document.body.appendChild(this.container)
  }

  /**
   * Create control panel UI in Shadow DOM
   * @private
   */
  _createPanelUI() {
    // Create adopted stylesheet
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(this._getStyles())
    this.shadowRoot.adoptedStyleSheets = [sheet]

    // Create panel container with ARIA landmark
    const panel = document.createElement('div')
    panel.className = 'control-panel'
    panel.setAttribute('role', 'region')
    panel.setAttribute('aria-label', 'TTS Control Panel')

    // Create header with minimize button
    const header = document.createElement('div')
    header.className = 'panel-header'

    const title = document.createElement('div')
    title.className = 'panel-title'
    title.textContent = 'TTS Controls'

    this.minimizeButton = document.createElement('button')
    this.minimizeButton.className = 'minimize-button'
    this.minimizeButton.setAttribute('aria-label', 'Minimize control panel')
    this.minimizeButton.setAttribute('aria-expanded', 'true')
    this.minimizeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 8h8"/>
      </svg>
    `
    this.minimizeButton.addEventListener('click', () => {
      this.toggleMinimize()
    })

    header.appendChild(title)
    header.appendChild(this.minimizeButton)

    // Create panel content (collapsible)
    this.panelContent = document.createElement('div')
    this.panelContent.className = 'panel-content'

    // Create status display with aria-live
    const statusContainer = document.createElement('div')
    statusContainer.className = 'status-container'
    statusContainer.setAttribute('aria-live', 'polite')

    this.statusDisplay = document.createElement('div')
    this.statusDisplay.className = 'status-text'
    this.statusDisplay.textContent = this.currentStatus

    this.progressDisplay = document.createElement('div')
    this.progressDisplay.className = 'progress-text'
    this.progressDisplay.textContent = '0%'

    statusContainer.appendChild(this.statusDisplay)
    statusContainer.appendChild(this.progressDisplay)

    // Create control buttons
    const controlsContainer = document.createElement('div')
    controlsContainer.className = 'controls-container'

    this.playButton = this._createButton('play', 'Play', this._handlePlayClick.bind(this))
    this.pauseButton = this._createButton('pause', 'Pause', this._handlePauseClick.bind(this))
    this.stopButton = this._createButton('stop', 'Stop', this._handleStopClick.bind(this))
    this.resumeButton = this._createButton('resume', 'Resume', this._handleResumeClick.bind(this))

    controlsContainer.appendChild(this.playButton)
    controlsContainer.appendChild(this.pauseButton)
    controlsContainer.appendChild(this.stopButton)
    controlsContainer.appendChild(this.resumeButton)

    // Create voice selector
    const voiceContainer = document.createElement('div')
    voiceContainer.className = 'control-group'

    const voiceLabel = document.createElement('label')
    voiceLabel.textContent = 'Voice'
    voiceLabel.setAttribute('for', 'voice-select')

    this.voiceSelect = document.createElement('select')
    this.voiceSelect.id = 'voice-select'
    this.voiceSelect.className = 'voice-select'
    this.voiceSelect.setAttribute('aria-label', 'Select voice')
    this.voiceSelect.addEventListener('change', this._handleVoiceChange.bind(this))

    voiceContainer.appendChild(voiceLabel)
    voiceContainer.appendChild(this.voiceSelect)

    // Create speed control
    const speedContainer = document.createElement('div')
    speedContainer.className = 'control-group'

    const speedLabel = document.createElement('label')
    speedLabel.textContent = 'Speed'
    speedLabel.setAttribute('for', 'speed-slider')

    this.speedSlider = document.createElement('input')
    this.speedSlider.id = 'speed-slider'
    this.speedSlider.type = 'range'
    this.speedSlider.min = '0.5'
    this.speedSlider.max = '3.0'
    this.speedSlider.step = '0.1'
    this.speedSlider.value = this.currentSpeed.toString()
    this.speedSlider.className = 'slider'
    this.speedSlider.setAttribute('aria-label', 'Playback speed')
    this.speedSlider.setAttribute('aria-valuetext', `${this.currentSpeed}x`)
    this.speedSlider.addEventListener('input', this._handleSpeedInput.bind(this))

    this.speedValue = document.createElement('span')
    this.speedValue.className = 'control-value'
    this.speedValue.textContent = `${this.currentSpeed}x`

    speedContainer.appendChild(speedLabel)
    speedContainer.appendChild(this.speedSlider)
    speedContainer.appendChild(this.speedValue)

    // Create volume control
    const volumeContainer = document.createElement('div')
    volumeContainer.className = 'control-group'

    const volumeLabel = document.createElement('label')
    volumeLabel.textContent = 'Volume'
    volumeLabel.setAttribute('for', 'volume-slider')

    this.volumeSlider = document.createElement('input')
    this.volumeSlider.id = 'volume-slider'
    this.volumeSlider.type = 'range'
    this.volumeSlider.min = '0'
    this.volumeSlider.max = '100'
    this.volumeSlider.step = '1'
    this.volumeSlider.value = this.currentVolume.toString()
    this.volumeSlider.className = 'slider'
    this.volumeSlider.setAttribute('role', 'slider')
    this.volumeSlider.setAttribute('aria-label', 'Volume')
    this.volumeSlider.setAttribute('aria-valuemin', '0')
    this.volumeSlider.setAttribute('aria-valuemax', '100')
    this.volumeSlider.setAttribute('aria-valuenow', this.currentVolume.toString())
    this.volumeSlider.addEventListener('input', this._handleVolumeInput.bind(this))

    this.volumeValue = document.createElement('span')
    this.volumeValue.className = 'control-value'
    this.volumeValue.textContent = `${this.currentVolume}%`

    volumeContainer.appendChild(volumeLabel)
    volumeContainer.appendChild(this.volumeSlider)
    volumeContainer.appendChild(this.volumeValue)

    // Assemble panel content
    this.panelContent.appendChild(statusContainer)
    this.panelContent.appendChild(controlsContainer)
    this.panelContent.appendChild(voiceContainer)
    this.panelContent.appendChild(speedContainer)
    this.panelContent.appendChild(volumeContainer)

    // Assemble panel
    panel.appendChild(header)
    panel.appendChild(this.panelContent)

    // Add to Shadow DOM
    this.shadowRoot.appendChild(panel)
  }

  /**
   * Create control button
   * @param {string} type - Button type
   * @param {string} label - Button label
   * @param {Function} onClick - Click handler
   * @returns {HTMLButtonElement}
   * @private
   */
  _createButton(type, label, onClick) {
    const button = document.createElement('button')
    button.className = `control-button ${type}-button`
    button.setAttribute('aria-label', `${label} text-to-speech`)
    button.addEventListener('click', onClick)

    const icons = {
      play: '<path d="M8 5v14l11-7z"/>',
      pause: '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>',
      stop: '<path d="M6 6h12v12H6z"/>',
      resume: '<path d="M8 5v14l11-7z"/>'
    }

    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        ${icons[type] || icons.play}
      </svg>
    `

    return button
  }

  /**
   * Get control panel styles
   * @returns {string} CSS stylesheet
   * @private
   */
  _getStyles() {
    return `
      :host {
        all: initial;
      }

      .control-panel {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        min-width: 280px;
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
        cursor: pointer;
      }

      .panel-title {
        font-size: 14px;
        font-weight: 600;
        color: #202124;
      }

      .minimize-button {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: #5f6368;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s ease;
      }

      .minimize-button:hover {
        background: #e8eaed;
      }

      .minimize-button:focus-visible {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
      }

      .panel-content {
        padding: 16px;
        max-height: 400px;
        overflow-y: auto;
        transition: max-height 0.3s ease, opacity 0.3s ease;
      }

      .panel-content.minimized {
        max-height: 0;
        padding: 0;
        opacity: 0;
        overflow: hidden;
      }

      .status-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding: 8px 12px;
        background: #f8f9fa;
        border-radius: 6px;
      }

      .status-text {
        font-size: 13px;
        color: #5f6368;
      }

      .progress-text {
        font-size: 13px;
        font-weight: 600;
        color: #4285f4;
      }

      .controls-container {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }

      .control-button {
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease, transform 0.1s ease;
      }

      .control-button:hover {
        background: #3367d6;
        transform: translateY(-1px);
      }

      .control-button:active {
        background: #2851a3;
        transform: translateY(0);
      }

      .control-button:focus-visible {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
      }

      .control-button.pause-button {
        background: #f4b400;
      }

      .control-button.pause-button:hover {
        background: #e6a800;
      }

      .control-button.stop-button {
        background: #ea4335;
      }

      .control-button.stop-button:hover {
        background: #d33b2c;
      }

      .control-group {
        margin-bottom: 16px;
      }

      .control-group:last-child {
        margin-bottom: 0;
      }

      .control-group label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #5f6368;
        margin-bottom: 6px;
      }

      .voice-select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 14px;
        color: #202124;
        background: white;
        cursor: pointer;
        transition: border-color 0.2s ease;
      }

      .voice-select:hover {
        border-color: #4285f4;
      }

      .voice-select:focus {
        outline: none;
        border-color: #4285f4;
        box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
      }

      .slider {
        -webkit-appearance: none;
        appearance: none;
        width: calc(100% - 50px);
        height: 6px;
        border-radius: 3px;
        background: #e8eaed;
        outline: none;
        margin-right: 8px;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4285f4;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .slider::-webkit-slider-thumb:hover {
        background: #3367d6;
      }

      .slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4285f4;
        cursor: pointer;
        border: none;
        transition: background 0.2s ease;
      }

      .slider::-moz-range-thumb:hover {
        background: #3367d6;
      }

      .slider:focus::-webkit-slider-thumb {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
      }

      .slider:focus::-moz-range-thumb {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
      }

      .control-value {
        display: inline-block;
        min-width: 42px;
        font-size: 13px;
        font-weight: 600;
        color: #202124;
        text-align: right;
      }
    `
  }

  /**
   * Sanitize text to prevent XSS
   * @param {string} text - Text to sanitize
   * @returns {string}
   * @private
   */
  _sanitizeText(text) {
    if (!text) return ''
    // Convert to string and replace potentially dangerous characters
    return String(text).replace(/[<>'"&]/g, (char) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '&': '&amp;'
      }
      return entities[char] || char
    })
  }

  /**
   * Populate voice select options
   * @param {Array} voices - Voice list
   * @private
   */
  _populateVoices(voices) {
    if (!this.voiceSelect) {
      return
    }

    // Clear existing options
    this.voiceSelect.innerHTML = ''

    // Add voice options
    voices.forEach(voice => {
      const option = document.createElement('option')
      option.value = voice.id
      // Sanitize voice name and gender to prevent XSS
      const sanitizedName = this._sanitizeText(voice.name)
      const sanitizedGender = this._sanitizeText(voice.gender)
      option.textContent = `${sanitizedName} (${sanitizedGender})`
      if (voice.id === this.currentVoice) {
        option.selected = true
      }
      this.voiceSelect.appendChild(option)
    })
  }

  /**
   * Update UI state
   * @private
   */
  _updateUIState() {
    // Update voice select
    if (this.voiceSelect) {
      this.voiceSelect.value = this.currentVoice
    }

    // Update speed slider
    if (this.speedSlider) {
      this.speedSlider.value = this.currentSpeed.toString()
    }
    if (this.speedValue) {
      this.speedValue.textContent = `${this.currentSpeed}x`
    }

    // Update volume slider
    if (this.volumeSlider) {
      this.volumeSlider.value = this.currentVolume.toString()
      this.volumeSlider.setAttribute('aria-valuenow', this.currentVolume.toString())
    }
    if (this.volumeValue) {
      this.volumeValue.textContent = `${this.currentVolume}%`
    }

    // Update minimized state
    this._updateMinimizedState()
  }

  /**
   * Update minimized state
   * @private
   */
  _updateMinimizedState() {
    if (!this.panelContent || !this.minimizeButton) {
      return
    }

    if (this.isMinimized) {
      this.panelContent.classList.add('minimized')
      this.minimizeButton.setAttribute('aria-expanded', 'false')
      this.minimizeButton.setAttribute('aria-label', 'Expand control panel')
      this.minimizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3v10"/>
        </svg>
      `
    } else {
      this.panelContent.classList.remove('minimized')
      this.minimizeButton.setAttribute('aria-expanded', 'true')
      this.minimizeButton.setAttribute('aria-label', 'Minimize control panel')
      this.minimizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 8h8"/>
        </svg>
      `
    }
  }

  // Event handlers

  /**
   * Handle play button click
   * @private
   */
  _handlePlayClick() {
    if (this.onPlayClick) {
      this.onPlayClick()
    }
  }

  /**
   * Handle pause button click
   * @private
   */
  _handlePauseClick() {
    if (this.onPauseClick) {
      this.onPauseClick()
    }
  }

  /**
   * Handle stop button click
   * @private
   */
  _handleStopClick() {
    if (this.onStopClick) {
      this.onStopClick()
    }
  }

  /**
   * Handle resume button click
   * @private
   */
  _handleResumeClick() {
    if (this.onResumeClick) {
      this.onResumeClick()
    }
  }

  /**
   * Validate voice ID against known voices
   * @param {string} voiceId - Voice ID to validate
   * @returns {boolean}
   * @private
   */
  _isValidVoiceId(voiceId) {
    // Get all options from voice select
    if (!this.voiceSelect) {
      return false
    }

    const options = Array.from(this.voiceSelect.options)
    return options.some(option => option.value === voiceId)
  }

  /**
   * Handle voice selection change
   * @private
   */
  _handleVoiceChange() {
    const voiceId = this.voiceSelect.value

    // Validate voice ID before processing
    if (!this._isValidVoiceId(voiceId)) {
      console.warn(`Invalid voice ID: ${voiceId}`)
      return
    }

    this.currentVoice = voiceId
    if (this.onVoiceChange) {
      this.onVoiceChange(voiceId)
    }
  }

  /**
   * Handle speed slider input
   * @private
   */
  _handleSpeedInput() {
    const speed = parseFloat(this.speedSlider.value)
    this.currentSpeed = speed
    this.speedValue.textContent = `${speed.toFixed(1)}x`
    this.speedSlider.setAttribute('aria-valuetext', `${speed.toFixed(1)}x`)
    if (this.onSpeedChange) {
      this.onSpeedChange(speed)
    }
  }

  /**
   * Handle volume slider input
   * @private
   */
  _handleVolumeInput() {
    const volume = parseInt(this.volumeSlider.value)
    this.currentVolume = volume
    this.volumeValue.textContent = `${volume}%`
    this.volumeSlider.setAttribute('aria-valuenow', volume.toString())
    if (this.onVolumeChange) {
      this.onVolumeChange(volume)
    }
  }
}

export default ControlPanel
