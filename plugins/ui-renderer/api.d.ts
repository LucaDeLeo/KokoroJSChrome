/**
 * UIRenderer Plugin API TypeScript Definitions
 */

export type Position = {
  x: number
  y: number
  relativeTo?: 'selection' | 'viewport' | 'element'
}

export type Theme = 'default' | 'dark' | 'light' | 'minimal'

export type Size = 'small' | 'medium' | 'large'

export type Animation = {
  fadeIn?: boolean
  duration?: number
  easing?: string
}

export type ProgressStyle = 'bar' | 'circle' | 'minimal'

export type ButtonState = 'play' | 'pause' | 'stop' | 'loading'

export interface Voice {
  id: string
  name: string
  language: string
  gender: string
}

export interface ComponentOptions {
  position?: Position
  theme?: Theme
  size?: Size
  animation?: Animation
}

export interface ButtonOptions extends ComponentOptions {
  state?: ButtonState
  autoHide?: boolean
  autoHideDelay?: number
}

export interface ProgressOptions {
  value: number
  style?: ProgressStyle
  showTime?: boolean
  showPercentage?: boolean
  message?: string
}

export interface ControlPanelOptions extends ComponentOptions {
  voices: Voice[]
  currentVoice: string
  currentSpeed: number
  currentVolume: number
  minimized?: boolean
}

export interface PluginConfig {
  defaultTheme?: Theme
  defaultSize?: Size
  buttonAutoHideDelay?: number
  progressAutoHideDelay?: number
  enableAnimations?: boolean
}

export default class UIRendererPlugin {
  id: string
  name: string
  version: string
  stage: string
  config: PluginConfig

  constructor(config?: PluginConfig)

  /**
   * Initialize plugin with event bus and PAL
   */
  init(eventBus: any, pal: any): Promise<boolean>

  /**
   * Render floating button component
   */
  renderButton(options: ButtonOptions): void

  /**
   * Update progress bar
   */
  renderProgress(options: ProgressOptions): void

  /**
   * Render control panel
   */
  renderControlPanel(options: ControlPanelOptions): void

  /**
   * Show a specific component
   */
  showComponent(componentId: string): void

  /**
   * Hide a specific component
   */
  hideComponent(componentId: string): void

  /**
   * Update progress value and message
   */
  updateProgress(value: number, message: string): void

  /**
   * Set button state
   */
  setButtonState(state: ButtonState): void

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>

  /**
   * Health check
   */
  healthCheck(): Promise<any>
}
