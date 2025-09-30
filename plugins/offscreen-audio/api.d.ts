/**
 * OffscreenAudio Plugin API TypeScript Definitions
 */

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'stopped'

export interface PlaybackState {
  status: PlaybackStatus
  currentPlaybackId: string | null
  position: number
  duration: number
}

export interface PlaybackOptions {
  volume?: number
  speed?: number
  playbackId?: string
}

export interface AudioChunk {
  data: Float32Array
  sampleRate: number
  timestamp: number
  isLast?: boolean
}

export interface PluginConfig {
  volume?: number
  speed?: number
}

export interface HealthCheckResult {
  healthy: boolean
  offscreenCreated: boolean
  sessionCount: number
  playbackCount: number
  lastPlaybackTime: number
  currentPlaybackId: string | null
  memoryUsageMB: number
  initialized: boolean
}

export default class OffscreenAudioPlugin {
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
   * Process TTSEvent through the plugin
   */
  process(event: any, context: any): Promise<any>

  /**
   * Play audio through offscreen document
   */
  play(audioBuffer: AudioBuffer, options?: PlaybackOptions): Promise<void>

  /**
   * Pause current playback
   */
  pause(): void

  /**
   * Resume paused playback
   */
  resume(): void

  /**
   * Stop current playback
   */
  stop(): void

  /**
   * Stream audio chunk
   */
  streamChunk(chunk: AudioChunk): Promise<void>

  /**
   * Flush remaining stream data
   */
  flushStream(): Promise<void>

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void

  /**
   * Set playback speed (0.5-2.0)
   */
  setSpeed(speed: number): void

  /**
   * Recycle offscreen document
   */
  recycle(): Promise<void>

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>

  /**
   * Health check
   */
  healthCheck(): Promise<HealthCheckResult>
}