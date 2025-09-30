/**
 * @module UIRendererPlugin
 * @description UI rendering plugin for Shadow DOM components (floating button, progress bar, control panel)
 */

import FloatingButton from './components/floating-button.js'
import ProgressBar from './components/progress-bar.js'
import ControlPanel from './components/control-panel.js'

/**
 * @typedef {Object} Position
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {'selection'|'viewport'|'element'} [relativeTo] - Position reference
 */

/**
 * @typedef {Object} ButtonOptions
 * @property {Position} position - Button position
 * @property {'default'|'dark'|'light'|'minimal'} [theme] - UI theme
 * @property {'small'|'medium'|'large'} [size] - Button size
 * @property {boolean} [autoHide] - Auto-hide after timeout
 * @property {number} [autoHideDelay] - Auto-hide delay in ms
 */

/**
 * @typedef {Object} ProgressOptions
 * @property {number} value - Progress value (0-100)
 * @property {'bar'|'circle'|'minimal'} [style] - Progress style
 * @property {boolean} [showTime] - Show time remaining
 * @property {boolean} [showPercentage] - Show percentage
 * @property {string} [message] - Status message
 */

/**
 * @typedef {Object} ControlPanelOptions
 * @property {Position} position - Panel position
 * @property {Array} voices - Available voices
 * @property {string} currentVoice - Current voice ID
 * @property {number} currentSpeed - Current playback speed
 * @property {number} currentVolume - Current volume (0-100)
 * @property {boolean} [minimized] - Panel minimized state
 */

class UIRendererPlugin {
  constructor(config = {}) {
    this.id = 'ui-renderer'
    this.name = 'UIRenderer'
    this.version = '1.0.0'
    this.stage = 'ui'
    this.config = config

    // Plugin dependencies
    this.eventBus = null
    this.pal = null

    // UI components
    this.floatingButton = null
    this.progressBar = null
    this.controlPanel = null

    // Component tracking
    this.components = new Map()
    this.activeComponents = new Set()

    // Configuration
    this.defaultTheme = config.defaultTheme || 'default'
    this.defaultSize = config.defaultSize || 'medium'
    this.buttonAutoHideDelay = config.buttonAutoHideDelay || 10000
    this.progressAutoHideDelay = config.progressAutoHideDelay || 2000
    this.enableAnimations = config.enableAnimations !== false

    // State tracking
    this.currentButtonState = 'play'
    this.currentProgress = 0
    this.currentProgressMessage = ''
    this.panelVisible = false
  }

  /**
   * Initialize plugin with event bus and platform abstraction layer
   * @param {Object} eventBus - Event bus instance
   * @param {Object} pal - Platform abstraction layer
   * @returns {Promise<boolean>}
   */
  async init(eventBus, pal) {
    try {
      if (!eventBus) {
        throw new Error('EventBus is required for plugin initialization')
      }
      if (!pal) {
        throw new Error('PAL is required for plugin initialization')
      }

      this.eventBus = eventBus
      this.pal = pal

      // Initialize UI components
      this.floatingButton = new FloatingButton({
        timeout: this.buttonAutoHideDelay,
        theme: this.defaultTheme,
        size: this.defaultSize,
        enableAnimations: this.enableAnimations
      })

      this.progressBar = new ProgressBar({
        autoHideDelay: this.progressAutoHideDelay,
        enableAnimations: this.enableAnimations
      })

      this.controlPanel = new ControlPanel({
        theme: this.defaultTheme,
        enableAnimations: this.enableAnimations
      })

      // Set up component event handlers
      this._setupComponentHandlers()

      // Subscribe to event bus events
      this.eventBus.subscribe('selection:detected', this._handleSelectionDetected.bind(this))
      this.eventBus.subscribe('tts:progress', this._handleProgress.bind(this))
      this.eventBus.subscribe('tts:started', this._handleStarted.bind(this))
      this.eventBus.subscribe('tts:completed', this._handleCompleted.bind(this))
      this.eventBus.subscribe('tts:error', this._handleError.bind(this))

      // Subscribe to UI control events
      this.eventBus.subscribe('ui:button-click', this._handleButtonClick.bind(this))
      this.eventBus.subscribe('ui:voice-change', this._handleVoiceChange.bind(this))
      this.eventBus.subscribe('ui:speed-change', this._handleSpeedChange.bind(this))
      this.eventBus.subscribe('ui:volume-change', this._handleVolumeChange.bind(this))

      console.log(`${this.name} v${this.version} initialized at stage: ${this.stage}`)
      return true
    } catch (error) {
      console.error(`Failed to initialize ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Set up component event handlers
   * @private
   */
  _setupComponentHandlers() {
    // Floating button click handler
    this.floatingButton.onClick = (action) => {
      this.eventBus.emit('ui:button-click', { action, source: 'floating-button' })
    }

    // Control panel handlers
    this.controlPanel.onPlayClick = () => {
      this.eventBus.emit('ui:play', { source: 'control-panel' })
    }

    this.controlPanel.onPauseClick = () => {
      this.eventBus.emit('ui:pause', { source: 'control-panel' })
    }

    this.controlPanel.onStopClick = () => {
      this.eventBus.emit('ui:stop', { source: 'control-panel' })
    }

    this.controlPanel.onResumeClick = () => {
      this.eventBus.emit('ui:resume', { source: 'control-panel' })
    }

    this.controlPanel.onVoiceChange = (voiceId) => {
      this.eventBus.emit('ui:voice-change', { voiceId, source: 'control-panel' })
    }

    this.controlPanel.onSpeedChange = (speed) => {
      this.eventBus.emit('ui:speed-change', { speed, source: 'control-panel' })
    }

    this.controlPanel.onVolumeChange = (volume) => {
      this.eventBus.emit('ui:volume-change', { volume, source: 'control-panel' })
    }
  }

  /**
   * Handle selection detected event
   * @param {Object} event - Selection event
   * @private
   */
  async _handleSelectionDetected(event) {
    try {
      // Render floating button near selection
      const position = this._calculateButtonPosition(event.selection)
      await this.renderButton({
        position,
        theme: this.defaultTheme,
        size: this.defaultSize,
        autoHide: true,
        autoHideDelay: this.buttonAutoHideDelay
      })
    } catch (error) {
      console.error('Error handling selection detected:', error)
    }
  }

  /**
   * Handle TTS progress event
   * @param {Object} event - Progress event
   * @private
   */
  async _handleProgress(event) {
    try {
      const progress = event.progress || 0
      const message = event.progressMessage || event.message || 'Processing...'

      this.currentProgress = progress
      this.currentProgressMessage = message

      await this.updateProgress(progress, message)
    } catch (error) {
      console.error('Error handling progress:', error)
    }
  }

  /**
   * Handle TTS started event
   * @param {Object} event - Started event
   * @private
   */
  async _handleStarted(event) {
    try {
      // Show control panel
      this.showComponent('control-panel')
      this.panelVisible = true

      // Update button state to playing
      this.setButtonState('pause')
    } catch (error) {
      console.error('Error handling started:', error)
    }
  }

  /**
   * Handle TTS completed event
   * @param {Object} event - Completed event
   * @private
   */
  async _handleCompleted(event) {
    try {
      // Hide control panel
      this.hideComponent('control-panel')
      this.panelVisible = false

      // Update button state to play
      this.setButtonState('play')

      // Show completion message
      await this.updateProgress(100, 'Complete')

      // Auto-hide progress bar
      setTimeout(() => {
        this.hideComponent('progress-bar')
      }, this.progressAutoHideDelay)
    } catch (error) {
      console.error('Error handling completed:', error)
    }
  }

  /**
   * Handle TTS error event
   * @param {Object} event - Error event
   * @private
   */
  async _handleError(event) {
    try {
      const message = event.error?.message || 'An error occurred'

      // Show error in progress bar
      await this.updateProgress(0, `Error: ${message}`)

      // Reset button state
      this.setButtonState('play')

      // Auto-hide after delay
      setTimeout(() => {
        this.hideComponent('progress-bar')
      }, this.progressAutoHideDelay * 2)
    } catch (error) {
      console.error('Error handling error:', error)
    }
  }

  /**
   * Handle button click events
   * @param {Object} event - Button click event
   * @private
   */
  async _handleButtonClick(event) {
    // Button clicks will be handled by the pipeline
    // This method exists for future extensibility
  }

  /**
   * Handle voice change events
   * @param {Object} event - Voice change event
   * @private
   */
  async _handleVoiceChange(event) {
    // Voice changes will be handled by the synthesis plugin
    // This method exists for future extensibility
  }

  /**
   * Handle speed change events
   * @param {Object} event - Speed change event
   * @private
   */
  async _handleSpeedChange(event) {
    // Speed changes will be handled by the synthesis plugin
    // This method exists for future extensibility
  }

  /**
   * Handle volume change events
   * @param {Object} event - Volume change event
   * @private
   */
  async _handleVolumeChange(event) {
    // Volume changes will be handled by the audio plugin
    // This method exists for future extensibility
  }

  /**
   * Calculate button position relative to selection
   * @param {Object} selection - Selection object
   * @returns {Position}
   * @private
   */
  _calculateButtonPosition(selection) {
    if (!selection || !selection.rect) {
      return { x: window.innerWidth / 2, y: 100, relativeTo: 'viewport' }
    }

    const rect = selection.rect
    // Import FloatingButton to access dimension constants
    const buttonWidth = 100 // Approximate button width for positioning
    const buttonHeight = 40 // Approximate button height for positioning
    const padding = 10

    // Calculate position below selection
    let x = rect.left + (rect.width / 2) - (buttonWidth / 2)
    let y = rect.bottom + padding

    // Adjust for viewport boundaries
    if (x < padding) {
      x = padding
    } else if (x + buttonWidth > window.innerWidth - padding) {
      x = window.innerWidth - buttonWidth - padding
    }

    if (y + buttonHeight > window.innerHeight - padding) {
      // Position above selection if no room below
      y = rect.top - buttonHeight - padding
    }

    return { x, y, relativeTo: 'viewport' }
  }

  /**
   * Render floating button component
   * @param {ButtonOptions} options - Button options
   * @returns {Promise<void>}
   */
  async renderButton(options) {
    try {
      await this.floatingButton.render(options)
      this.components.set('floating-button', this.floatingButton)
      this.activeComponents.add('floating-button')
    } catch (error) {
      console.error('Error rendering button:', error)
      throw error
    }
  }

  /**
   * Render progress bar component
   * @param {ProgressOptions} options - Progress options
   * @returns {Promise<void>}
   */
  async renderProgress(options) {
    try {
      await this.progressBar.render(options)
      this.components.set('progress-bar', this.progressBar)
      this.activeComponents.add('progress-bar')
    } catch (error) {
      console.error('Error rendering progress:', error)
      throw error
    }
  }

  /**
   * Render control panel component
   * @param {ControlPanelOptions} options - Control panel options
   * @returns {Promise<void>}
   */
  async renderControlPanel(options) {
    try {
      await this.controlPanel.render(options)
      this.components.set('control-panel', this.controlPanel)
      this.activeComponents.add('control-panel')
    } catch (error) {
      console.error('Error rendering control panel:', error)
      throw error
    }
  }

  /**
   * Show a specific component
   * @param {string} componentId - Component ID
   */
  showComponent(componentId) {
    const component = this.components.get(componentId)
    if (component && component.show) {
      component.show()
      this.activeComponents.add(componentId)
    }
  }

  /**
   * Hide a specific component
   * @param {string} componentId - Component ID
   */
  hideComponent(componentId) {
    const component = this.components.get(componentId)
    if (component && component.hide) {
      component.hide()
      this.activeComponents.delete(componentId)
    }
  }

  /**
   * Update progress value and message
   * @param {number} value - Progress value (0-100)
   * @param {string} message - Status message
   */
  async updateProgress(value, message) {
    try {
      if (!this.components.has('progress-bar')) {
        // Render progress bar if not already visible
        await this.renderProgress({
          value,
          message,
          showPercentage: true
        })
      } else {
        // Update existing progress bar
        this.progressBar.update(value, message)
      }
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  /**
   * Set button state
   * @param {'play'|'pause'|'stop'|'loading'} state - Button state
   */
  setButtonState(state) {
    this.currentButtonState = state
    if (this.floatingButton) {
      this.floatingButton.setState(state)
    }
  }

  /**
   * Get plugin capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      supportsShadowDOM: true,
      supportsAnimations: this.enableAnimations,
      components: ['floating-button', 'progress-bar', 'control-panel'],
      themes: ['default', 'dark', 'light', 'minimal'],
      sizes: ['small', 'medium', 'large']
    }
  }

  /**
   * Cleanup plugin resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Clean up all components
      for (const [componentId, component] of this.components) {
        if (component && component.cleanup) {
          await component.cleanup()
        }
      }

      // Clear tracking
      this.components.clear()
      this.activeComponents.clear()

      console.log(`${this.name} cleaned up`)
    } catch (error) {
      console.error(`Error cleaning up ${this.name}:`, error)
      throw error
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      stage: this.stage,
      status: 'healthy',
      activeComponents: Array.from(this.activeComponents),
      componentCount: this.components.size
    }
  }
}

export default UIRendererPlugin
