/**
 * @module Plugin Integration Test Suite
 */

const { TTSCore } = require('../../core/tts-core.js')
const { TTSEvent } = require('../../core/tts-event.js')
const TestPlugin = require('../../plugins/test-plugin/index.js')

describe('Plugin Integration', () => {
  let ttsCore
  let testPlugin

  beforeEach(() => {
    ttsCore = new TTSCore({
      enableDebugLogging: false,
      enablePerformanceMonitoring: true
    })
    testPlugin = new TestPlugin({
      addTestData: true
    })
  })

  afterEach(async () => {
    if (ttsCore.initialized) {
      await ttsCore.cleanup()
    }
  })

  describe('plugin loading and initialization', () => {
    it('should load and initialize test plugin', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)

      expect(testPlugin.eventBus).toBe(ttsCore.eventBus)
      expect(testPlugin.pal).toBe(ttsCore.pal)
    })

    it('should register plugin with core', () => {
      const pluginId = ttsCore.registerPlugin(testPlugin)

      expect(pluginId).toBeDefined()
      const stages = ttsCore.getPipelineStages()
      expect(stages.some(s => s.name === testPlugin.id)).toBe(true)
    })

    it('should handle plugin event subscriptions', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)

      const response = await ttsCore.eventBus.publish('test:ping', {})

      expect(response.handled).toBeGreaterThan(0)
    })
  })

  describe('event flow through pipeline', () => {
    it('should process event through test plugin', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)
      ttsCore.registerPlugin(testPlugin)

      const event = new TTSEvent({ text: 'Test text' })
      const result = await ttsCore.pipeline.execute(event, {})

      expect(result.metadata.processedBy).toContain('test-plugin')
      expect(result.metadata.testData).toBeDefined()
      expect(result.metadata.testData.pluginId).toBe('test-plugin')
    })

    it('should track plugin processing count', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)
      ttsCore.registerPlugin(testPlugin)

      const event1 = new TTSEvent({ text: 'Test 1' })
      const event2 = new TTSEvent({ text: 'Test 2' })

      await ttsCore.pipeline.execute(event1, {})
      await ttsCore.pipeline.execute(event2, {})

      expect(testPlugin.processedCount).toBe(2)
    })

    it('should handle optional plugin failures', async () => {
      const errorPlugin = new TestPlugin({
        optional: true,
        simulateError: true,
        errorRate: 1.0
      })

      await errorPlugin.init(ttsCore.eventBus, ttsCore.pal)
      ttsCore.registerPlugin(errorPlugin)

      const event = new TTSEvent({ text: 'Test' })

      await expect(ttsCore.pipeline.execute(event, {})).resolves.toBeDefined()
    })
  })

  describe('plugin lifecycle', () => {
    it('should cleanup plugin properly', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)
      ttsCore.registerPlugin(testPlugin)

      const event = new TTSEvent({ text: 'Test' })
      await ttsCore.pipeline.execute(event, {})

      expect(testPlugin.processedCount).toBe(1)

      await testPlugin.cleanup()

      expect(testPlugin.processedCount).toBe(0)
      expect(testPlugin.eventBus).toBeNull()
      expect(testPlugin.pal).toBeNull()
    })

    it('should report health status', async () => {
      await testPlugin.init(ttsCore.eventBus, ttsCore.pal)

      const health = await testPlugin.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.initialized).toBe(true)
      expect(health.processedCount).toBe(0)
    })
  })

  describe('performance monitoring', () => {
    it('should track plugin performance', async () => {
      const slowPlugin = new TestPlugin({
        simulateDelay: 30
      })

      await slowPlugin.init(ttsCore.eventBus, ttsCore.pal)
      ttsCore.registerPlugin(slowPlugin)

      const event = new TTSEvent({ text: 'Test' })
      const startTime = performance.now()

      await ttsCore.pipeline.execute(event, {
        performanceMonitor: ttsCore.performanceMonitor
      })

      const duration = performance.now() - startTime

      expect(duration).toBeGreaterThan(30)
      expect(duration).toBeLessThan(100)
    })
  })
})