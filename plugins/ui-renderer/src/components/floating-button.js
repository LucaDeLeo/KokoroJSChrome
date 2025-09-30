/**
 * @module FloatingButton
 * @description Shadow DOM floating button for TTS playback control with state management
 */

class FloatingButton {
  // Button dimension constants
  static BUTTON_WIDTH = 150
  static BUTTON_HEIGHT = 48
  static BUTTON_WIDTH_APPROXIMATE = 100  // For positioning calculations
  static BUTTON_HEIGHT_APPROXIMATE = 40  // For positioning calculations

  constructor(config = {}) {
    this.config = config

    // Configuration
    this.timeout = config.timeout || 10000
    this.fadeInDuration = config.fadeInDuration || 200
    this.fadeOutDuration = config.fadeOutDuration || 500
    this.offsetX = config.offsetX || 10
    this.offsetY = config.offsetY || 10
    this.theme = config.theme || 'default'
    this.size = config.size || 'medium'
    this.enableAnimations = config.enableAnimations !== false

    // State
    this.container = null
    this.shadowRoot = null
    this.button = null
    this.isVisible = false
    this.hideTimer = null
    this.currentState = 'play' // 'play' | 'pause' | 'stop' | 'loading'

    // Callbacks
    this.onClick = null
  }

  /**
   * Render floating button
   * @param {Object} options - Render options
   * @param {Object} options.position - Button position {x, y}
   * @param {string} [options.theme] - Theme
   * @param {string} [options.size] - Size
   * @param {boolean} [options.autoHide] - Auto-hide enabled
   * @param {number} [options.autoHideDelay] - Auto-hide delay in ms
   */
  async render(options = {}) {
    try {
      const startTime = performance.now()

      // Create container if not exists
      if (!this.container) {
        this._createContainer()
      }

      // Update configuration
      if (options.theme) {
        this.theme = options.theme
      }
      if (options.size) {
        this.size = options.size
      }
      if (options.autoHideDelay) {
        this.timeout = options.autoHideDelay
      }

      // Position button
      if (options.position) {
        this._positionButton(options.position)
      }

      // Show button
      this.show()

      // Set up auto-hide if enabled
      if (options.autoHide !== false) {
        this._setupAutoHide()
      }

      const endTime = performance.now()
      const renderTime = endTime - startTime

      if (renderTime > 200) {
        console.warn(`FloatingButton render took ${renderTime}ms (target: <200ms)`)
      }

      return renderTime
    } catch (error) {
      console.error('Error rendering floating button:', error)
      throw error
    }
  }

  /**
   * Show floating button
   */
  show() {
    try {
      if (this.isVisible) {
        return
      }

      // Show container
      this.container.style.display = 'block'

      // Trigger fade-in animation
      if (this.enableAnimations) {
        requestAnimationFrame(() => {
          this.container.style.opacity = '1'
        })
      } else {
        this.container.style.opacity = '1'
      }

      this.isVisible = true
    } catch (error) {
      console.error('Error showing floating button:', error)
    }
  }

  /**
   * Hide floating button
   */
  hide() {
    try {
      if (!this.isVisible) {
        return
      }

      // Fade out
      this.container.style.opacity = '0'

      // Hide after fade
      const delay = this.enableAnimations ? this.fadeOutDuration : 0
      setTimeout(() => {
        this.container.style.display = 'none'
        this.isVisible = false
      }, delay)

      // Clear auto-hide timer
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
    } catch (error) {
      console.error('Error hiding floating button:', error)
    }
  }

  /**
   * Set button state
   * @param {'play'|'pause'|'stop'|'loading'} state - Button state
   */
  setState(state) {
    try {
      if (!['play', 'pause', 'stop', 'loading'].includes(state)) {
        console.warn(`Invalid button state: ${state}`)
        return
      }

      this.currentState = state
      this._updateButtonUI()
    } catch (error) {
      console.error('Error setting button state:', error)
    }
  }

  /**
   * Cleanup button resources
   */
  async cleanup() {
    try {
      // Clear timer
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }

      // Remove from DOM
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container)
      }

      this.container = null
      this.shadowRoot = null
      this.button = null
      this.isVisible = false
      this.onClick = null
    } catch (error) {
      console.error('Error cleaning up floating button:', error)
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
    this.container.id = 'kokoro-tts-floating-button'
    this.container.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      display: none;
      opacity: 0;
      transition: opacity ${this.fadeInDuration}ms ease-in-out;
      pointer-events: auto;
    `

    // Create Shadow DOM (closed mode for security and CSS isolation)
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' })

    // Create button UI
    this._createButtonUI()

    // Add to document
    document.body.appendChild(this.container)
  }

  /**
   * Create button UI in Shadow DOM
   * @private
   */
  _createButtonUI() {
    // Create adopted stylesheet
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(this._getStyles())
    this.shadowRoot.adoptedStyleSheets = [sheet]

    // Create button
    this.button = document.createElement('button')
    this.button.className = `tts-button ${this.size} ${this.theme}`
    this.button.setAttribute('role', 'button')
    this.button.setAttribute('type', 'button')

    // Add click handler
    this.button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.onClick) {
        this.onClick(this.currentState)
      }
    })

    // Add to Shadow DOM
    this.shadowRoot.appendChild(this.button)

    // Set initial state
    this._updateButtonUI()
  }

  /**
   * Get button styles
   * @returns {string} CSS stylesheet
   * @private
   */
  _getStyles() {
    return `
      :host {
        all: initial;
      }

      .tts-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.2s ease, transform 0.1s ease;
        outline: none;
      }

      .tts-button:hover {
        background: #3367d6;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .tts-button:active {
        background: #2851a3;
        transform: translateY(0);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .tts-button:focus-visible {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
      }

      .tts-button.loading {
        background: #9e9e9e;
        cursor: wait;
        pointer-events: none;
      }

      .tts-button.pause {
        background: #f4b400;
      }

      .tts-button.pause:hover {
        background: #e6a800;
      }

      .tts-button.stop {
        background: #ea4335;
      }

      .tts-button.stop:hover {
        background: #d33b2c;
      }

      /* Size variants */
      .tts-button.small {
        padding: 8px 12px;
        font-size: 12px;
      }

      .tts-button.medium {
        padding: 12px 16px;
        font-size: 14px;
      }

      .tts-button.large {
        padding: 16px 20px;
        font-size: 16px;
      }

      /* Theme variants */
      .tts-button.dark {
        background: #202124;
        color: white;
      }

      .tts-button.dark:hover {
        background: #303134;
      }

      .tts-button.light {
        background: #ffffff;
        color: #202124;
        border: 1px solid #dadce0;
      }

      .tts-button.light:hover {
        background: #f8f9fa;
      }

      .tts-button.minimal {
        background: transparent;
        color: #4285f4;
        box-shadow: none;
        padding: 8px 12px;
      }

      .tts-button.minimal:hover {
        background: rgba(66, 133, 244, 0.1);
      }

      .icon {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }

      .label {
        display: inline-block;
      }

      /* Loading spinner */
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .spinner {
        animation: spin 1s linear infinite;
      }
    `
  }

  /**
   * Update button UI based on current state
   * @private
   */
  _updateButtonUI() {
    if (!this.button) {
      return
    }

    // Remove all state classes
    this.button.classList.remove('play', 'pause', 'stop', 'loading')

    // Add current state class
    this.button.classList.add(this.currentState)

    // Update button content based on state
    const stateConfig = this._getStateConfig(this.currentState)

    this.button.innerHTML = `
      <svg class="icon ${stateConfig.spinnerClass}" viewBox="0 0 24 24" fill="currentColor">
        ${stateConfig.icon}
      </svg>
      <span class="label">${stateConfig.label}</span>
    `

    // Update ARIA attributes
    this.button.setAttribute('aria-label', stateConfig.ariaLabel)
    if (this.currentState === 'pause') {
      this.button.setAttribute('aria-pressed', 'true')
    } else {
      this.button.setAttribute('aria-pressed', 'false')
    }

    // Disable button during loading
    if (this.currentState === 'loading') {
      this.button.disabled = true
      this.button.setAttribute('aria-busy', 'true')
    } else {
      this.button.disabled = false
      this.button.removeAttribute('aria-busy')
    }
  }

  /**
   * Get state configuration
   * @param {string} state - Button state
   * @returns {Object} State configuration
   * @private
   */
  _getStateConfig(state) {
    const configs = {
      play: {
        icon: '<path d="M8 5v14l11-7z"/>',
        label: 'Play',
        ariaLabel: 'Play text-to-speech',
        spinnerClass: ''
      },
      pause: {
        icon: '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>',
        label: 'Pause',
        ariaLabel: 'Pause text-to-speech',
        spinnerClass: ''
      },
      stop: {
        icon: '<path d="M6 6h12v12H6z"/>',
        label: 'Stop',
        ariaLabel: 'Stop text-to-speech',
        spinnerClass: ''
      },
      loading: {
        icon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/><path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" fill="none"/>',
        label: 'Loading...',
        ariaLabel: 'Loading text-to-speech',
        spinnerClass: 'spinner'
      }
    }

    return configs[state] || configs.play
  }

  /**
   * Position button at specified coordinates
   * @param {Object} position - Position {x, y, relativeTo}
   * @private
   */
  _positionButton(position) {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    // Use class constants for button dimensions
    const buttonWidth = FloatingButton.BUTTON_WIDTH
    const buttonHeight = FloatingButton.BUTTON_HEIGHT

    // Calculate position
    let left = position.x
    let top = position.y

    // Handle edge cases - viewport boundaries

    // Too far right
    if (left + buttonWidth > viewportWidth + scrollX) {
      left = viewportWidth + scrollX - buttonWidth - this.offsetX
    }

    // Too far left
    if (left < scrollX) {
      left = scrollX + this.offsetX
    }

    // Too far down
    if (top + buttonHeight > viewportHeight + scrollY) {
      top = viewportHeight + scrollY - buttonHeight - this.offsetY
    }

    // Too far up
    if (top < scrollY) {
      top = scrollY + this.offsetY
    }

    // Apply position
    this.container.style.left = `${left}px`
    this.container.style.top = `${top}px`
  }

  /**
   * Set up auto-hide timer
   * @private
   */
  _setupAutoHide() {
    // Clear existing timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
    }

    // Set new timer
    this.hideTimer = setTimeout(() => {
      this.hide()
    }, this.timeout)
  }
}

export default FloatingButton
