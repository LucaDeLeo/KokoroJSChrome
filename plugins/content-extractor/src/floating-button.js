/**
 * @module FloatingButton
 * @description Shadow DOM floating button for TTS actions
 */

class FloatingButton {
  constructor(config = {}) {
    this.config = config

    // Configuration
    this.timeout = config.timeout || 10000
    this.fadeInDuration = config.fadeInDuration || 200
    this.offsetX = config.offsetX || 10
    this.offsetY = config.offsetY || 10

    // State
    this.container = null
    this.shadowRoot = null
    this.isVisible = false
    this.hideTimer = null

    // Callback
    this.onClick = null

    // Initialize
    this._createContainer()
  }

  /**
   * Show floating button near selection
   * @param {DOMRect} rect - Selection bounding rect
   */
  show(rect) {
    try {
      if (!rect) {
        console.error('Selection rect is required')
        return
      }

      const startTime = performance.now()

      // Position button
      this._positionButton(rect)

      // Show button
      this.container.style.display = 'block'

      // Trigger fade-in animation
      requestAnimationFrame(() => {
        this.container.style.opacity = '1'
      })

      this.isVisible = true

      // Set up auto-hide
      this._setupAutoHide()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      if (renderTime > 200) {
        console.warn(`Button render took ${renderTime}ms (target: <200ms)`)
      }
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
      setTimeout(() => {
        this.container.style.display = 'none'
        this.isVisible = false
      }, this.fadeInDuration)

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
   * Cleanup button resources
   */
  cleanup() {
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
      this.isVisible = false
      this.onClick = null
    } catch (error) {
      console.error('Error cleaning up floating button:', error)
    }
  }

  // Private methods

  /**
   * Create container with Shadow DOM
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

    // Create Shadow DOM (closed mode for security)
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' })

    // Create button UI
    this._createButtonUI()

    // Add to document
    document.body.appendChild(this.container)
  }

  /**
   * Create button UI in Shadow DOM
   */
  _createButtonUI() {
    // Create stylesheet
    const style = document.createElement('style')
    style.textContent = `
      :host {
        all: initial;
      }

      .button-container {
        display: flex;
        gap: 8px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }

      .button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.2s ease;
      }

      .button:hover {
        background: #3367d6;
      }

      .button:active {
        background: #2851a3;
      }

      .button.secondary {
        background: #f1f3f4;
        color: #202124;
      }

      .button.secondary:hover {
        background: #e8eaed;
      }

      .button.secondary:active {
        background: #dadce0;
      }

      .icon {
        width: 16px;
        height: 16px;
      }
    `

    // Create button container
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'button-container'

    // Create "Read Selection" button
    const readSelectionBtn = document.createElement('button')
    readSelectionBtn.className = 'button'
    readSelectionBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
      <span>Read Selection</span>
    `
    readSelectionBtn.addEventListener('click', () => {
      if (this.onClick) {
        this.onClick('read-selection')
      }
    })

    // Create "Read Page" button
    const readPageBtn = document.createElement('button')
    readPageBtn.className = 'button secondary'
    readPageBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <span>Read Page</span>
    `
    readPageBtn.addEventListener('click', () => {
      if (this.onClick) {
        this.onClick('read-page')
      }
    })

    // Add buttons to container
    buttonContainer.appendChild(readSelectionBtn)
    buttonContainer.appendChild(readPageBtn)

    // Add to Shadow DOM
    this.shadowRoot.appendChild(style)
    this.shadowRoot.appendChild(buttonContainer)
  }

  /**
   * Position button relative to selection rect
   * @param {DOMRect} rect - Selection bounding rect
   */
  _positionButton(rect) {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    // Calculate button dimensions (approximate)
    const buttonWidth = 300
    const buttonHeight = 60

    // Calculate initial position (below selection)
    let left = rect.left + scrollX + (rect.width / 2) - (buttonWidth / 2)
    let top = rect.bottom + scrollY + this.offsetY

    // Handle edge cases

    // Too far right
    if (left + buttonWidth > viewportWidth + scrollX) {
      left = viewportWidth + scrollX - buttonWidth - this.offsetX
    }

    // Too far left
    if (left < scrollX) {
      left = scrollX + this.offsetX
    }

    // Too far down (show above selection instead)
    if (top + buttonHeight > viewportHeight + scrollY) {
      top = rect.top + scrollY - buttonHeight - this.offsetY
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