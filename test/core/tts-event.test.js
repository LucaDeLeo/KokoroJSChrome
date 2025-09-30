/**
 * @module TTSEvent Test Suite
 */

import { TTSEvent } from '../../core/tts-event.js'

describe('TTSEvent', () => {
  describe('constructor', () => {
    it('should create event with default values', () => {
      const event = new TTSEvent()

      expect(event.id).toMatch(/^tts-\d+-[a-z0-9]+$/)
      expect(event.timestamp).toBeGreaterThan(0)
      expect(event.request.text).toBe('')
      expect(event.request.source).toBe('unknown')
      expect(event.request.voiceId).toBe('default')
      expect(event.request.speed).toBe(1.0)
      expect(event.request.options).toEqual({})
      expect(event.response.audio).toBeNull()
      expect(event.response.duration).toBe(0)
      expect(event.response.chunks).toEqual([])
      expect(event.response.cached).toBe(false)
      expect(event.state.phase).toBe('created')
      expect(event.state.progress).toBe(0)
      expect(event.state.error).toBeNull()
    })

    it('should create event with provided request data', () => {
      const request = {
        text: 'Hello world',
        source: 'selection',
        voiceId: 'kokoro-v1',
        speed: 1.5,
        options: { pitch: 1.2 },
        tabId: 123,
        url: 'https://example.com'
      }

      const event = new TTSEvent(request)

      expect(event.request.text).toBe('Hello world')
      expect(event.request.source).toBe('selection')
      expect(event.request.voiceId).toBe('kokoro-v1')
      expect(event.request.speed).toBe(1.5)
      expect(event.request.options).toEqual({ pitch: 1.2 })
      expect(event.metadata.tabId).toBe(123)
      expect(event.metadata.url).toBe('https://example.com')
    })

    it('should generate unique IDs for different events', () => {
      const event1 = new TTSEvent()
      const event2 = new TTSEvent()

      expect(event1.id).not.toBe(event2.id)
    })
  })

  describe('setPhase', () => {
    it('should set valid phase', () => {
      const event = new TTSEvent()

      event.setPhase('queued')
      expect(event.state.phase).toBe('queued')

      event.setPhase('processing')
      expect(event.state.phase).toBe('processing')
      expect(event.metadata.timing.started).toBeGreaterThan(0)
    })

    it('should throw error for invalid phase', () => {
      const event = new TTSEvent()

      expect(() => event.setPhase('invalid')).toThrow('Invalid phase: invalid')
    })

    it('should set timing on phase transitions', () => {
      const event = new TTSEvent()

      event.setPhase('processing')
      const started = event.metadata.timing.started
      expect(started).toBeGreaterThan(0)

      event.setPhase('completed')
      expect(event.metadata.timing.completed).toBeGreaterThanOrEqual(started)
    })
  })

  describe('setProgress', () => {
    it('should set valid progress values', () => {
      const event = new TTSEvent()

      event.setProgress(0)
      expect(event.state.progress).toBe(0)

      event.setProgress(50)
      expect(event.state.progress).toBe(50)

      event.setProgress(100)
      expect(event.state.progress).toBe(100)
    })

    it('should throw error for invalid progress values', () => {
      const event = new TTSEvent()

      expect(() => event.setProgress(-1)).toThrow('Progress must be between 0 and 100')
      expect(() => event.setProgress(101)).toThrow('Progress must be between 0 and 100')
    })
  })

  describe('setError', () => {
    it('should set error and update phase to failed', () => {
      const event = new TTSEvent()
      const error = new Error('Test error')

      event.setError(error)
      expect(event.state.error).toBe(error)
      expect(event.state.phase).toBe('failed')
    })
  })

  describe('addStageTime', () => {
    it('should record stage timing', () => {
      const event = new TTSEvent()

      event.addStageTime('extraction', 10)
      event.addStageTime('synthesis', 50)

      expect(event.metadata.timing.stages.extraction).toBe(10)
      expect(event.metadata.timing.stages.synthesis).toBe(50)
    })
  })

  describe('getElapsedTime', () => {
    it('should return 0 when not started', () => {
      const event = new TTSEvent()
      expect(event.getElapsedTime()).toBe(0)
    })

    it('should calculate elapsed time', async () => {
      const event = new TTSEvent()

      event.setPhase('processing')
      const started = event.metadata.timing.started

      await new Promise(resolve => setTimeout(resolve, 10))

      const elapsed = event.getElapsedTime()
      expect(elapsed).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(100)
    })

    it('should use completed time when available', () => {
      const event = new TTSEvent()

      event.setPhase('processing')
      event.setPhase('completed')

      const elapsed = event.getElapsedTime()
      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBe(event.metadata.timing.completed - event.metadata.timing.started)
    })
  })

  describe('setResponse', () => {
    it('should set response data', () => {
      const event = new TTSEvent()
      const responseData = {
        audio: new ArrayBuffer(100),
        duration: 5.5,
        chunks: ['chunk1', 'chunk2'],
        cached: true
      }

      event.setResponse(responseData)

      expect(event.response.audio).toBe(responseData.audio)
      expect(event.response.duration).toBe(5.5)
      expect(event.response.chunks).toEqual(['chunk1', 'chunk2'])
      expect(event.response.cached).toBe(true)
    })

    it('should set partial response data', () => {
      const event = new TTSEvent()

      event.setResponse({ duration: 3.2 })
      expect(event.response.duration).toBe(3.2)
      expect(event.response.audio).toBeNull()
    })
  })

  describe('toJSON', () => {
    it('should serialize event to JSON', () => {
      const event = new TTSEvent({ text: 'Test text' })
      event.setPhase('processing')
      event.setProgress(50)

      const json = event.toJSON()

      expect(json.id).toBe(event.id)
      expect(json.timestamp).toBe(event.timestamp)
      expect(json.request.text).toBe('Test text')
      expect(json.state.phase).toBe('processing')
      expect(json.state.progress).toBe(50)
    })
  })

  describe('clone', () => {
    it('should create deep copy of event', () => {
      const event = new TTSEvent({ text: 'Original' })
      event.setPhase('processing')
      event.setProgress(75)
      event.addStageTime('test', 25)

      const cloned = event.clone()

      expect(cloned.id).toBe(event.id)
      expect(cloned.request.text).toBe('Original')
      expect(cloned.state.phase).toBe('processing')
      expect(cloned.state.progress).toBe(75)
      expect(cloned.metadata.timing.stages.test).toBe(25)

      cloned.request.text = 'Modified'
      cloned.state.progress = 100
      expect(event.request.text).toBe('Original')
      expect(event.state.progress).toBe(75)
    })
  })
})