/**
 * KokoroEngine Plugin API TypeScript Definitions
 */

export interface KokoroVoice {
  id: string
  name: string
  language: string
  gender: string
  traits?: string
}

export interface AudioResult {
  buffer: Float32Array
  sampleRate: number
  duration: number
  metadata?: {
    voice: string
    speed: number
    synthesisTime: number
    textLength: number
  }
}

export type ModelStatus = 'unloaded' | 'loading' | 'loaded' | 'error'

export type Quality = 'draft' | 'normal' | 'high'

export interface SynthesisOptions {
  text: string
  voice?: string
  speed?: number
}

export interface PluginConfig {
  defaultVoice?: string
  quality?: Quality
  batchSize?: number
  speed?: number
  modelId?: string
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16'
  device?: 'wasm' | 'webgpu' | 'cpu' | null
}

export interface HealthCheckResult {
  healthy: boolean
  modelStatus: ModelStatus
  synthesisCount: number
  lastSynthesisTime: number
  currentVoice: string
  initialized: boolean
}

export default class KokoroEnginePlugin {
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
   * Synthesize text to audio
   */
  synthesize(options: SynthesisOptions): Promise<AudioResult>

  /**
   * List available voices
   */
  listVoices(): KokoroVoice[]

  /**
   * Set current voice
   */
  setVoice(voiceId: string): void

  /**
   * Load ONNX model
   */
  loadModel(): Promise<void>

  /**
   * Unload model and cleanup resources
   */
  unloadModel(): void

  /**
   * Get current model status
   */
  getModelStatus(): ModelStatus

  /**
   * Set synthesis quality
   */
  setQuality(quality: Quality): void

  /**
   * Set batch processing size
   */
  setBatchSize(size: number): void

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>

  /**
   * Health check
   */
  healthCheck(): Promise<HealthCheckResult>
}