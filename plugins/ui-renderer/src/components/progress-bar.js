/**
 * @module ProgressBar
 * @description Shadow DOM progress bar component for TTS synthesis and playback progress
 */

class ProgressBar {
  constructor(config = {}) {
    this.config = config

    // Configuration
    this.autoHideDelay = config.autoHideDelay || 1500
    this.fadeInDuration = config.fadeInDuration || 300
    this.fadeOutDuration = config.fadeOutDuration || 500
    this.enableAnimations = config.enableAnimations !== false
    this.showPercentage = config.showPercentage !== false
    this.showTime = config.showTime || false
    this.style = config.style || 'bar'

    // State
    this.container = null
    this.shadowRoot = null
    this.progressBar = null
    this.progressStatus = null
    this.progressLabel = null
    this.liveRegion = null
    this.isVisible = false
    this.currentProgress = 0
    this.currentMessage = ''
    this.hideTimer = null
  }

  /**
   * Render progress bar component
   * @param {Object} options - Render options
   * @param {number} options.value - Progress value (0-100)
   * @param {string} [options.message] - Status message
   * @param {boolean} [options.showPercentage] - Show percentage
   * @param {boolean} [options.showTime] - Show time remaining
   * @param {string} [options.style] - Progress style
   */
  async render(options = {}) {
    try {
      // Create container if not exists
      if (!this.container) {
        this._createContainer()
      }

      // Update configuration
      if (options.showPercentage !== undefined) {
        this.showPercentage = options.showPercentage
      }
      if (options.showTime !== undefined) {
        this.showTime = options.showTime
      }
      if (options.style) {
        this.style = options.style
      }

      // Update progress
      const value = options.value || 0
      const message = options.message || 'Processing...'
      this.update(value, message)

      // Show progress bar
      this.show()
    } catch (error) {
      console.error('Error rendering progress bar:', error)
      throw error
    }
  }

  /**
   * Update progress value and message
   * @param {number} value - Progress value (0-100)
   * @param {string} message - Status message
   */
  update(value, message) {
    try {
      // Clamp value to 0-100
      value = Math.max(0, Math.min(100, value))

      // Update state
      this.currentProgress = value
      this.currentMessage = message || ''

      // Update UI
      this._updateProgressBar(value)
      this._updateMessage(message)

      // Announce to screen readers
      this._announceProgress(value, message)

      // Handle completion
      if (value >= 100) {
        this._handleCompletion()
      }
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  /**
   * Show progress bar
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
        // Trigger reflow to make transition work
        void this.container.offsetWidth

        requestAnimationFrame(() => {
          this.container.style.opacity = '1'
        })
      } else {
        this.container.style.opacity = '1'
      }

      this.isVisible = true
    } catch (error) {
      console.error('Error showing progress bar:', error)
    }
  }

  /**
   * Hide progress bar
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

        // Reset progress
        this._resetProgress()
      }, delay)

      // Clear auto-hide timer
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
    } catch (error) {
      console.error('Error hiding progress bar:', error)
    }
  }

  /**
   * Cleanup progress bar resources
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
      this.progressBar = null
      this.progressStatus = null
      this.progressLabel = null
      this.liveRegion = null
      this.isVisible = false
    } catch (error) {
      console.error('Error cleaning up progress bar:', error)
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
    this.container.id = 'kokoro-tts-progress-bar'
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: none;
      opacity: 0;
      transition: opacity ${this.fadeInDuration}ms ease-in-out;
      pointer-events: none;
    `

    // Create Shadow DOM (closed mode for security and CSS isolation)
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' })

    // Create progress bar UI
    this._createProgressBarUI()

    // Add to document
    document.body.appendChild(this.container)
  }

  /**
   * Create progress bar UI in Shadow DOM
   * @private
   */
  _createProgressBarUI() {
    // Create adopted stylesheet
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(this._getStyles())
    this.shadowRoot.adoptedStyleSheets = [sheet]

    // Create progress container
    const progressContainer = document.createElement('div')
    progressContainer.className = 'progress-container'

    // Create progress wrapper (for aria role)
    const progressWrapper = document.createElement('div')
    progressWrapper.className = 'progress-wrapper'
    progressWrapper.setAttribute('role', 'progressbar')
    progressWrapper.setAttribute('aria-valuemin', '0')
    progressWrapper.setAttribute('aria-valuemax', '100')
    progressWrapper.setAttribute('aria-valuenow', '0')
    progressWrapper.setAttribute('aria-label', 'Text-to-speech progress')

    // Create progress track
    const progressTrack = document.createElement('div')
    progressTrack.className = 'progress-track'

    // Create progress bar (the filled part)
    this.progressBar = document.createElement('div')
    this.progressBar.className = 'progress-bar'
    this.progressBar.style.width = '0%'

    progressTrack.appendChild(this.progressBar)
    progressWrapper.appendChild(progressTrack)

    // Create status display
    const statusDisplay = document.createElement('div')
    statusDisplay.className = 'status-display'

    // Create progress label (message)
    this.progressLabel = document.createElement('div')
    this.progressLabel.className = 'progress-label'
    this.progressLabel.textContent = 'Initializing...'

    // Create progress status (percentage)
    this.progressStatus = document.createElement('div')
    this.progressStatus.className = 'progress-status'
    this.progressStatus.textContent = '0%'

    statusDisplay.appendChild(this.progressLabel)
    statusDisplay.appendChild(this.progressStatus)

    // Create aria-live region for screen reader announcements
    this.liveRegion = document.createElement('div')
    this.liveRegion.className = 'sr-only'
    this.liveRegion.setAttribute('aria-live', 'polite')
    this.liveRegion.setAttribute('aria-atomic', 'true')

    // Assemble components
    progressContainer.appendChild(statusDisplay)
    progressContainer.appendChild(progressWrapper)
    progressContainer.appendChild(this.liveRegion)

    // Add to Shadow DOM
    this.shadowRoot.appendChild(progressContainer)

    // Store reference to wrapper for aria updates
    this.progressWrapper = progressWrapper
  }

  /**
   * Get progress bar styles
   * @returns {string} CSS stylesheet
   * @private
   */
  _getStyles() {
    return `
      :host {
        all: initial;
      }

      .progress-container {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 16px;
        min-width: 300px;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .status-display {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .progress-label {
        font-size: 14px;
        font-weight: 500;
        color: #202124;
        transition: transform 0.2s ease;
      }

      .progress-status {
        font-size: 14px;
        font-weight: 600;
        color: #4285f4;
      }

      .progress-wrapper {
        position: relative;
      }

      .progress-track {
        width: 100%;
        height: 8px;
        background: #e8eaed;
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4285f4 0%, #34a853 100%);
        border-radius: 4px;
        transition: width 0.3s ease, background 0.3s ease;
      }

      .progress-bar.success {
        background: #34a853;
      }

      .progress-bar.error {
        background: #ea4335;
      }

      /* Screen reader only content */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      /* Pulse animation for loading state */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .progress-bar.loading {
        animation: pulse 1.5s ease-in-out infinite;
      }
    `
  }

  /**
   * Update progress bar width
   * @param {number} value - Progress value (0-100)
   * @private
   */
  _updateProgressBar(value) {
    if (!this.progressBar || !this.progressWrapper) {
      return
    }

    // Update progress bar width
    this.progressBar.style.width = `${value}%`

    // Update ARIA attribute
    this.progressWrapper.setAttribute('aria-valuenow', Math.round(value))

    // Update status text
    if (this.showPercentage) {
      const roundedPercent = Math.round(value)
      this.progressStatus.textContent = `${roundedPercent}%`
    }
  }

  /**
   * Update status message
   * @param {string} message - Status message
   * @private
   */
  _updateMessage(message) {
    if (!this.progressLabel || !message) {
      return
    }

    // Update label text
    this.progressLabel.textContent = message

    // Add subtle animation to indicate change
    if (this.enableAnimations) {
      this.progressLabel.style.transform = 'translateY(-2px)'
      setTimeout(() => {
        this.progressLabel.style.transform = 'translateY(0)'
      }, 200)
    }
  }

  /**
   * Announce progress to screen readers
   * @param {number} value - Progress value
   * @param {string} message - Status message
   * @private
   */
  _announceProgress(value, message) {
    if (!this.liveRegion) {
      return
    }

    // Only announce at significant milestones to avoid spam
    const roundedValue = Math.round(value)
    if (roundedValue % 25 === 0 || roundedValue === 100) {
      const announcement = `${message}. ${roundedValue} percent complete.`
      this.liveRegion.textContent = announcement
    }
  }

  /**
   * Handle progress completion
   * @private
   */
  _handleCompletion() {
    try {
      // Update status text
      if (this.progressStatus) {
        this.progressStatus.textContent = 'Complete'
      }

      // Add success class to progress bar
      if (this.progressBar) {
        this.progressBar.classList.add('success')
      }

      // Announce completion
      if (this.liveRegion) {
        this.liveRegion.textContent = 'Text-to-speech complete.'
      }

      // Auto-hide after delay
      this.hideTimer = setTimeout(() => {
        this.hide()
      }, this.autoHideDelay)
    } catch (error) {
      console.error('Error handling completion:', error)
    }
  }

  /**
   * Reset progress to initial state
   * @private
   */
  _resetProgress() {
    try {
      // Reset progress bar
      if (this.progressBar) {
        this.progressBar.style.width = '0%'
        this.progressBar.classList.remove('success', 'error')
      }

      // Reset ARIA
      if (this.progressWrapper) {
        this.progressWrapper.setAttribute('aria-valuenow', '0')
      }

      // Reset text
      if (this.progressStatus) {
        this.progressStatus.textContent = '0%'
      }
      if (this.progressLabel) {
        this.progressLabel.textContent = 'Initializing...'
      }
      if (this.liveRegion) {
        this.liveRegion.textContent = ''
      }

      // Reset state
      this.currentProgress = 0
      this.currentMessage = ''
    } catch (error) {
      console.error('Error resetting progress:', error)
    }
  }
}

export default ProgressBar
