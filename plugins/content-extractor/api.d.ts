/**
 * ContentExtractor Plugin API TypeScript Definitions
 */

export type ExtractionMode = 'selection' | 'article' | 'full' | 'custom'

export type ExtractorMode = 'simple' | 'advanced'

export interface ExtractedContent {
  text: string
  textId?: string
  title?: string
  excerpt?: string
  byline?: string
  length: number
  wordCount: number
  extractionMode: ExtractorMode
  url: string
  timestamp: number
}

export interface ExtractionOptions {
  mode: ExtractionMode
  selector?: string
  filters?: ExtractorFilter[]
}

export interface ExtractorFilter {
  type: 'exclude' | 'include'
  selector: string
}

export interface TTSRequest {
  text: string
  textId?: string
  voice: string
  speed: number
}

export interface TTSSource {
  type: 'selection' | 'page' | 'custom'
  tabId: number
  url: string
}

export interface ExtractorCapabilities {
  supportsReadability: boolean
  supportsShadowDOM: boolean
  maxTextSize: number
  supportedModes: ExtractionMode[]
}

export interface PluginConfig {
  debounceDelay?: number
  maxTextLength?: number
  buttonTimeout?: number
  defaultVoice?: string
  defaultSpeed?: number
}

export default class ContentExtractorPlugin {
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
   * Extract content based on options
   */
  extract(options: ExtractionOptions): Promise<ExtractedContent>

  /**
   * Extract article using Readability.js
   */
  extractArticle(document: Document): Promise<ExtractedContent>

  /**
   * Extract content from main/article elements (simple mode)
   */
  extractSimple(): Promise<ExtractedContent>

  /**
   * Get plugin capabilities
   */
  getCapabilities(): ExtractorCapabilities

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>

  /**
   * Health check
   */
  healthCheck(): Promise<any>
}