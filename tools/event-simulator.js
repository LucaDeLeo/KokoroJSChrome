/**
 * @module EventSimulator
 * @description Simulate events for testing
 */

import { TTSEvent } from '../core/tts-event.js'

class EventSimulator {
  constructor(eventBus) {
    this.eventBus = eventBus
    this.scenarios = new Map()
    this.running = false
  }

  defineScenario(name, scenario) {
    this.scenarios.set(name, scenario)
  }

  async runScenario(name, options = {}) {
    const scenario = this.scenarios.get(name)
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`)
    }

    this.running = true
    console.log(`Running scenario: ${name}`)

    try {
      if (scenario.setup) {
        await scenario.setup()
      }

      const events = scenario.events || []
      for (const event of events) {
        await this._simulateEvent(event, options)
      }

      if (scenario.teardown) {
        await scenario.teardown()
      }

      console.log(`Scenario '${name}' completed`)
      return true
    } catch (error) {
      console.error(`Scenario '${name}' failed:`, error)
      throw error
    } finally {
      this.running = false
    }
  }

  async _simulateEvent(eventConfig, options) {
    const delay = eventConfig.delay || options.defaultDelay || 100

    await this._delay(delay)

    if (eventConfig.type === 'tts-request') {
      return this._simulateTTSRequest(eventConfig)
    } else if (eventConfig.type === 'custom') {
      return this.eventBus.publish(eventConfig.eventType, eventConfig.data)
    } else if (eventConfig.type === 'batch') {
      return this._simulateBatch(eventConfig)
    } else if (eventConfig.type === 'stress') {
      return this._simulateStress(eventConfig)
    }
  }

  async _simulateTTSRequest(config) {
    const event = new TTSEvent({
      text: config.text || this._generateText(config.textLength || 100),
      source: config.source || 'simulator',
      voiceId: config.voiceId || 'default',
      speed: config.speed || 1.0,
      tabId: config.tabId || Math.floor(Math.random() * 1000),
      url: config.url || 'https://simulator.test'
    })

    return this.eventBus.publish('tts:request:new', event)
  }

  async _simulateBatch(config) {
    const count = config.count || 10
    const events = []

    for (let i = 0; i < count; i++) {
      const event = new TTSEvent({
        text: `Batch event ${i + 1}`,
        source: 'batch-simulator'
      })
      events.push(this.eventBus.publish('tts:request:new', event))

      if (config.batchDelay) {
        await this._delay(config.batchDelay)
      }
    }

    return Promise.all(events)
  }

  async _simulateStress(config) {
    const duration = config.duration || 5000
    const rate = config.rate || 10
    const interval = 1000 / rate
    const startTime = Date.now()
    let count = 0

    while (Date.now() - startTime < duration) {
      this._simulateTTSRequest({
        text: `Stress test event ${++count}`,
        source: 'stress-simulator'
      })

      await this._delay(interval)
    }

    return count
  }

  _generateText(length) {
    const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit']
    let text = ''

    while (text.length < length) {
      text += words[Math.floor(Math.random() * words.length)] + ' '
    }

    return text.substring(0, length).trim()
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  createBuiltInScenarios() {
    this.defineScenario('basic-flow', {
      events: [
        { type: 'tts-request', text: 'Hello world', delay: 100 },
        { type: 'tts-request', text: 'This is a test', delay: 200 },
        { type: 'custom', eventType: 'test:complete', data: { success: true }, delay: 100 }
      ]
    })

    this.defineScenario('error-handling', {
      events: [
        { type: 'tts-request', text: 'Normal request', delay: 100 },
        { type: 'custom', eventType: 'error:simulated', data: { error: 'Test error' }, delay: 100 },
        { type: 'tts-request', text: 'Recovery request', delay: 200 }
      ]
    })

    this.defineScenario('performance-test', {
      events: [
        { type: 'batch', count: 5, batchDelay: 50 },
        { type: 'stress', duration: 2000, rate: 20 }
      ]
    })

    this.defineScenario('long-text', {
      events: [
        { type: 'tts-request', textLength: 500, delay: 100 },
        { type: 'tts-request', textLength: 1000, delay: 200 },
        { type: 'tts-request', textLength: 5000, delay: 300 }
      ]
    })

    this.defineScenario('multi-tab', {
      events: [
        { type: 'tts-request', text: 'Tab 1', tabId: 1, delay: 100 },
        { type: 'tts-request', text: 'Tab 2', tabId: 2, delay: 100 },
        { type: 'tts-request', text: 'Tab 3', tabId: 3, delay: 100 },
        { type: 'tts-request', text: 'Tab 1 again', tabId: 1, delay: 200 }
      ]
    })
  }

  listScenarios() {
    return Array.from(this.scenarios.keys())
  }

  clearScenarios() {
    this.scenarios.clear()
  }
}

export { EventSimulator }