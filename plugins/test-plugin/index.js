/**
 * @module TestPlugin
 * @description Simple test plugin for verification
 */

class TestPlugin {
  constructor(config = {}) {
    this.id = 'test-plugin'
    this.name = 'Test Plugin'
    this.version = '1.0.0'
    this.config = config
    this.eventBus = null
    this.pal = null
    this.processedCount = 0
    this.optional = config.optional || false
    this.priority = config.priority || 0
  }

  async init(eventBus, pal) {
    this.eventBus = eventBus
    this.pal = pal

    this.eventBus.subscribe('test:ping', () => {
      return { pong: true, timestamp: Date.now() }
    })

    console.log(`${this.name} initialized with config:`, this.config)
    return true
  }

  async process(event, context) {
    this.processedCount++

    event.metadata.processedBy = event.metadata.processedBy || []
    event.metadata.processedBy.push(this.id)

    if (this.config.addTestData) {
      event.metadata.testData = {
        pluginId: this.id,
        processedAt: Date.now(),
        count: this.processedCount
      }
    }

    if (this.config.simulateDelay) {
      await this._delay(this.config.simulateDelay)
    }

    if (this.config.simulateError && Math.random() < this.config.errorRate) {
      throw new Error(`Simulated error from ${this.id}`)
    }

    return event
  }

  async cleanup() {
    console.log(`${this.name} cleaning up. Processed ${this.processedCount} events`)
    this.processedCount = 0
    this.eventBus = null
    this.pal = null
  }

  async healthCheck() {
    return {
      healthy: true,
      processedCount: this.processedCount,
      initialized: this.eventBus !== null && this.pal !== null
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = TestPlugin