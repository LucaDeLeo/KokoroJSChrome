/**
 * @module EventRecorder
 * @description Record and replay events for debugging
 */

class EventRecorder {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.recording = false
    this.recordedEvents = []
    this.maxEvents = 1000
    this.filters = []
    this.unsubscribe = null
  }

  startRecording(options = {}) {
    if (this.recording) {
      console.warn('Already recording')
      return
    }

    this.recordedEvents = []
    this.filters = options.filters || []
    this.maxEvents = options.maxEvents || 1000

    this.unsubscribe = this.eventBus.subscribe('*', (data, eventType) => {
      if (this._shouldRecord(eventType, data)) {
        this._recordEvent(eventType, data)
      }
    })

    this.recording = true
    console.log('Event recording started')
  }

  stopRecording() {
    if (!this.recording) {
      return []
    }

    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    this.recording = false
    console.log(`Event recording stopped. Recorded ${this.recordedEvents.length} events`)

    return this.recordedEvents
  }

  _shouldRecord(eventType, data) {
    if (this.filters.length === 0) {
      return true
    }

    return this.filters.some(filter => {
      if (typeof filter === 'string') {
        return eventType.includes(filter)
      } else if (filter instanceof RegExp) {
        return filter.test(eventType)
      } else if (typeof filter === 'function') {
        return filter(eventType, data)
      }
      return false
    })
  }

  _recordEvent(eventType, data) {
    const event = {
      timestamp: Date.now(),
      type: eventType,
      data: this._serializeData(data)
    }

    this.recordedEvents.push(event)

    if (this.recordedEvents.length > this.maxEvents) {
      this.recordedEvents.shift()
    }
  }

  _serializeData(data) {
    try {
      return JSON.parse(JSON.stringify(data))
    } catch (error) {
      return {
        error: 'Failed to serialize',
        message: error.message,
        dataType: typeof data
      }
    }
  }

  async replay(events = null, options = {}) {
    const eventsToReplay = events || this.recordedEvents
    const speed = options.speed || 1
    const delayBetweenEvents = options.delay || 0

    console.log(`Replaying ${eventsToReplay.length} events at ${speed}x speed`)

    for (let i = 0; i < eventsToReplay.length; i++) {
      const event = eventsToReplay[i]
      const nextEvent = eventsToReplay[i + 1]

      await this.eventBus.publish(event.type, event.data)

      if (nextEvent && !options.immediate) {
        const timeDiff = (nextEvent.timestamp - event.timestamp) / speed
        await this._delay(Math.min(timeDiff, 5000))
      } else if (delayBetweenEvents > 0) {
        await this._delay(delayBetweenEvents)
      }
    }

    console.log('Replay completed')
  }

  save(filename = 'events.json') {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      events: this.recordedEvents
    }

    if (typeof window !== 'undefined' && window.document) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } else {
      return JSON.stringify(data, null, 2)
    }
  }

  load(data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      this.recordedEvents = parsed.events || []
      console.log(`Loaded ${this.recordedEvents.length} events`)
      return true
    } catch (error) {
      console.error('Failed to load events:', error)
      return false
    }
  }

  clear() {
    this.recordedEvents = []
    console.log('Recorded events cleared')
  }

  getEvents(filter = null) {
    if (!filter) {
      return [...this.recordedEvents]
    }

    return this.recordedEvents.filter(event => {
      if (typeof filter === 'string') {
        return event.type.includes(filter)
      } else if (filter instanceof RegExp) {
        return filter.test(event.type)
      } else if (typeof filter === 'function') {
        return filter(event)
      }
      return false
    })
  }

  getStatistics() {
    const stats = {
      totalEvents: this.recordedEvents.length,
      eventTypes: {},
      timeRange: null
    }

    if (this.recordedEvents.length > 0) {
      stats.timeRange = {
        start: this.recordedEvents[0].timestamp,
        end: this.recordedEvents[this.recordedEvents.length - 1].timestamp,
        duration: this.recordedEvents[this.recordedEvents.length - 1].timestamp - this.recordedEvents[0].timestamp
      }
    }

    for (const event of this.recordedEvents) {
      stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1
    }

    return stats
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export { EventRecorder }