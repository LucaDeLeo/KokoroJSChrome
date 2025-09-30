/**
 * QueueManager Plugin API TypeScript Definitions
 */

export type SessionStatus = 'queued' | 'playing' | 'paused' | 'stopped' | 'completed'

export type Priority = 'low' | 'normal' | 'high'

export interface TTSSession {
  sessionId: string
  tabId: number
  status: SessionStatus
  text: string
  textId?: string
  voiceId: string
  speed: number
  progress: number
  startTime: number
  pausedTime?: number
  resumeTime?: number
}

export interface QueueEntry {
  event: any
  priority: Priority
  timestamp: number
}

export interface QueueConfig {
  maxQueueSize?: number
  stopPrevious?: boolean
  sessionTimeout?: number
  persistState?: boolean
}

export interface QueueState {
  currentSession: TTSSession | null
  queueLength: number
  totalProcessed: number
  lastActivity: number
}

export default class QueueManagerPlugin {
  id: string
  name: string
  version: string
  stage: string
  config: QueueConfig

  constructor(config?: QueueConfig)

  /**
   * Initialize plugin with event bus and PAL
   */
  init(eventBus: any, pal: any): Promise<boolean>

  /**
   * Enqueue a TTS request
   */
  enqueue(event: any, priority?: Priority): Promise<void>

  /**
   * Dequeue next TTS request
   */
  dequeue(): any | null

  /**
   * Clear entire queue
   */
  clear(): void

  /**
   * Stop current session
   */
  stopCurrent(): Promise<void>

  /**
   * Pause current session
   */
  pauseCurrent(): Promise<void>

  /**
   * Resume current session
   */
  resumeCurrent(): Promise<void>

  /**
   * Get current session
   */
  getCurrentSession(): TTSSession | null

  /**
   * Get queue length
   */
  getQueueLength(): number

  /**
   * Get queue state
   */
  getQueueState(): QueueState

  /**
   * Cleanup plugin resources
   */
  cleanup(): Promise<void>

  /**
   * Health check
   */
  healthCheck(): Promise<any>
}
