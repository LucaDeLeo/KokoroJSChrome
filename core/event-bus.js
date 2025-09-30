/**
 * @module EventBus
 * @description Event system with subscribe/publish pattern and error handling
 */

class EventBus {
  constructor() {
    this.subscribers = new Map()
    this.errorHandlers = []
    this.eventHistory = []
    this.maxHistorySize = 100
  }

  subscribe(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function')
    }

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }

    this.subscribers.get(eventType).add(handler)

    return () => {
      const handlers = this.subscribers.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.subscribers.delete(eventType)
        }
      }
    }
  }

  unsubscribe(eventType, handler) {
    const handlers = this.subscribers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscribers.delete(eventType)
      }
    }
  }

  async publish(eventType, data) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now()
    }

    this._addToHistory(event)

    const handlers = this._getHandlers(eventType)
    const errors = []

    for (const handler of handlers) {
      try {
        await Promise.resolve(handler(data, eventType))
      } catch (error) {
        errors.push({ handler, error })
        this._handleError(error, event, handler)
      }
    }

    if (errors.length > 0) {
      const errorEvent = {
        type: 'event-bus:errors',
        errors,
        originalEvent: event
      }
      this._notifyErrorHandlers(errorEvent)
    }

    return {
      handled: handlers.size,
      errors: errors.length
    }
  }

  publishSync(eventType, data) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now()
    }

    this._addToHistory(event)

    const handlers = this._getHandlers(eventType)
    const errors = []

    for (const handler of handlers) {
      try {
        handler(data, eventType)
      } catch (error) {
        errors.push({ handler, error })
        this._handleError(error, event, handler)
      }
    }

    if (errors.length > 0) {
      const errorEvent = {
        type: 'event-bus:errors',
        errors,
        originalEvent: event
      }
      this._notifyErrorHandlers(errorEvent)
    }

    return {
      handled: handlers.size,
      errors: errors.length
    }
  }

  _getHandlers(eventType) {
    const handlers = new Set()

    const exactHandlers = this.subscribers.get(eventType)
    if (exactHandlers) {
      exactHandlers.forEach(handler => handlers.add(handler))
    }

    const wildcardHandlers = this.subscribers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handlers.add(handler))
    }

    const parts = eventType.split(':')
    for (let i = 1; i <= parts.length; i++) {
      const pattern = parts.slice(0, i).join(':') + ':*'
      const patternHandlers = this.subscribers.get(pattern)
      if (patternHandlers) {
        patternHandlers.forEach(handler => handlers.add(handler))
      }
    }

    return handlers
  }

  onError(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Error handler must be a function')
    }
    this.errorHandlers.push(handler)
    return () => {
      const index = this.errorHandlers.indexOf(handler)
      if (index > -1) {
        this.errorHandlers.splice(index, 1)
      }
    }
  }

  _handleError(error, event, handler) {
    console.error('EventBus handler error:', {
      error,
      event: event.type,
      handler: handler.name || 'anonymous'
    })
  }

  _notifyErrorHandlers(errorEvent) {
    for (const handler of this.errorHandlers) {
      try {
        handler(errorEvent)
      } catch (error) {
        console.error('Error handler failed:', error)
      }
    }
  }

  _addToHistory(event) {
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }

  getHistory(eventType = null) {
    if (eventType) {
      return this.eventHistory.filter(event => event.type === eventType)
    }
    return [...this.eventHistory]
  }

  clear() {
    this.subscribers.clear()
    this.errorHandlers = []
    this.eventHistory = []
  }

  getSubscriberCount(eventType = null) {
    if (eventType) {
      const handlers = this.subscribers.get(eventType)
      return handlers ? handlers.size : 0
    }

    let total = 0
    for (const handlers of this.subscribers.values()) {
      total += handlers.size
    }
    return total
  }

  getEventTypes() {
    return Array.from(this.subscribers.keys())
  }
}

export { EventBus }