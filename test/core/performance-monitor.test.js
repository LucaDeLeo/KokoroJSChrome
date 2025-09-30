/**
 * @module PerformanceMonitor Test Suite
 */

import { PerformanceMonitor } from '../../core/performance-monitor.js'

describe('PerformanceMonitor', () => {
  let monitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  describe('metric collection accuracy', () => {
    it('should record metrics with correct structure', () => {
      const metric = monitor.recordMetric('test-category', {
        duration: 25,
        customField: 'value'
      })

      expect(metric).toHaveProperty('timestamp')
      expect(metric).toHaveProperty('performance')
      expect(metric.duration).toBe(25)
      expect(metric.customField).toBe('value')
      expect(metric.threshold).toBe(null)
      expect(metric.exceedsThreshold).toBe(false)
    })

    it('should store metrics by category', () => {
      monitor.recordMetric('category1', { duration: 10 })
      monitor.recordMetric('category1', { duration: 20 })
      monitor.recordMetric('category2', { duration: 30 })

      const cat1Metrics = monitor.getMetrics('category1')
      const cat2Metrics = monitor.getMetrics('category2')

      expect(cat1Metrics).toHaveLength(2)
      expect(cat2Metrics).toHaveLength(1)
    })

    it('should limit stored metrics to 1000 per category', () => {
      for (let i = 0; i < 1005; i++) {
        monitor.recordMetric('test', { duration: i })
      }

      const metrics = monitor.getMetrics('test')
      expect(metrics).toHaveLength(1000)
      expect(metrics[0].duration).toBe(5)
      expect(metrics[999].duration).toBe(1004)
    })

    it('should handle timer measurements', () => {
      const mockDelay = 50
      jest.spyOn(performance, 'now').mockReturnValueOnce(mockDelay).mockReturnValueOnce(mockDelay + 50)

      monitor.startTimer('operation')

      const duration = monitor.endTimer('operation')

      expect(duration).toBeCloseTo(mockDelay, 0)
      const metrics = monitor.getMetrics('operation')
      expect(metrics[0].duration).toBeCloseTo(mockDelay, 0)
    })

    it('should warn for unknown timer', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const duration = monitor.endTimer('unknown')

      expect(duration).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('No start time found for timer: unknown')
      consoleSpy.mockRestore()
    })
  })

  describe('threshold detection', () => {
    it('should detect eventProcessing threshold violations', () => {
      const metric = monitor.recordMetric('event.process', { duration: 15 })

      expect(metric.threshold).toBe(10)
      expect(metric.exceedsThreshold).toBe(true)
    })

    it('should detect pipelineStage threshold violations', () => {
      const metric = monitor.recordMetric('pipeline.stage', { duration: 55 })

      expect(metric.threshold).toBe(50)
      expect(metric.exceedsThreshold).toBe(true)
    })

    it('should detect endToEnd threshold violations', () => {
      const metric = monitor.recordMetric('endToEnd', { duration: 150 })

      expect(metric.threshold).toBe(100)
      expect(metric.exceedsThreshold).toBe(true)
    })

    it('should warn when threshold exceeded', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      monitor.recordMetric('pipeline.stage', { duration: 75 })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Performance threshold exceeded for pipeline.stage:',
        expect.objectContaining({
          duration: 75,
          threshold: 50
        })
      )
      consoleSpy.mockRestore()
    })

    it('should allow custom threshold configuration', () => {
      monitor.setThreshold('pipelineStage', 25)

      const metric = monitor.recordMetric('pipeline.test', { duration: 30 })

      expect(metric.threshold).toBe(25)
      expect(metric.exceedsThreshold).toBe(true)
    })
  })

  describe('memory usage tracking', () => {
    it('should measure memory usage', () => {
      const mockMemory = {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      })

      const memory = monitor.measureMemory('test-plugin')

      expect(memory.label).toBe('test-plugin')
      expect(memory.usedJSHeapSize).toBe(50 * 1024 * 1024)
      expect(memory.timestamp).toBeDefined()

      delete performance.memory
    })

    it('should track memory delta from baseline', () => {
      const mockMemory = {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      })

      monitor.setMemoryBaseline()

      mockMemory.usedJSHeapSize = 75 * 1024 * 1024
      const memory = monitor.measureMemory('after-operation')

      expect(memory.delta).toBe(25 * 1024 * 1024)

      delete performance.memory
    })

    it('should warn when memory exceeds threshold', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const mockMemory = {
        usedJSHeapSize: 150 * 1024 * 1024,
        totalJSHeapSize: 200 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      })

      monitor.measureMemory('heavy-plugin')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Memory usage exceeds threshold for heavy-plugin:',
        expect.objectContaining({
          used: 150 * 1024 * 1024,
          threshold: 100 * 1024 * 1024
        })
      )

      consoleSpy.mockRestore()
      delete performance.memory
    })

    it('should handle missing performance.memory API', () => {
      const memory = monitor.measureMemory()
      expect(memory).toBeNull()

      const baseline = monitor.setMemoryBaseline()
      expect(baseline).toBeNull()
    })
  })

  describe('bottleneck identification', () => {
    it('should identify performance bottlenecks', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric('slow-operation', { duration: 60 })
      }
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric('fast-operation', { duration: 10 })
      }

      const bottlenecks = monitor.getBottlenecks()

      expect(bottlenecks).toHaveLength(1)
      expect(bottlenecks[0].category).toBe('slow-operation')
      expect(bottlenecks[0].occurrences).toBe(10)
      expect(bottlenecks[0].worstCase).toBe(60)
    })

    it('should sort bottlenecks by worst case', () => {
      monitor.recordMetric('operation1', { duration: 100 })
      monitor.recordMetric('operation2', { duration: 200 })
      monitor.recordMetric('operation3', { duration: 150 })

      const bottlenecks = monitor.getBottlenecks()

      expect(bottlenecks[0].worstCase).toBe(200)
      expect(bottlenecks[1].worstCase).toBe(150)
      expect(bottlenecks[2].worstCase).toBe(100)
    })

    it('should respect limit option', () => {
      for (let i = 1; i <= 5; i++) {
        monitor.recordMetric(`operation${i}`, { duration: 60 })
      }

      const bottlenecks = monitor.getBottlenecks({ limit: 3 })

      expect(bottlenecks).toHaveLength(3)
    })

    it('should use custom threshold for bottleneck detection', () => {
      monitor.recordMetric('operation1', { duration: 30 })
      monitor.recordMetric('operation2', { duration: 20 })

      const bottlenecks = monitor.getBottlenecks({ threshold: 25 })

      expect(bottlenecks).toHaveLength(1)
      expect(bottlenecks[0].category).toBe('operation1')
    })
  })

  describe('statistics calculation', () => {
    it('should calculate statistics for category', () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      durations.forEach(d => monitor.recordMetric('test', { duration: d }))

      const stats = monitor.getStatistics('test')

      expect(stats.count).toBe(10)
      expect(stats.min).toBe(10)
      expect(stats.max).toBe(100)
      expect(stats.mean).toBe(55)
      expect(stats.median).toBe(60)
      expect(stats.p95).toBe(100)
      expect(stats.p99).toBe(100)
    })

    it('should handle empty category', () => {
      const stats = monitor.getStatistics('nonexistent')
      expect(stats).toBeNull()
    })

    it('should handle metrics without duration', () => {
      monitor.recordMetric('test', { other: 'data' })
      const stats = monitor.getStatistics('test')
      expect(stats).toBeNull()
    })

    it('should respect options when calculating statistics', () => {
      for (let i = 0; i < 20; i++) {
        monitor.recordMetric('test', { duration: i * 10 })
      }

      const stats = monitor.getStatistics('test', { limit: 5 })

      expect(stats.count).toBe(5)
      expect(stats.min).toBe(150)
      expect(stats.max).toBe(190)
    })
  })

  describe('metric filtering', () => {
    it('should filter metrics by time', () => {
      const now = Date.now()

      monitor.recordMetric('test', { duration: 10 })

      jest.spyOn(Date, 'now').mockReturnValue(now + 1000)
      monitor.recordMetric('test', { duration: 20 })
      monitor.recordMetric('test', { duration: 30 })

      const metrics = monitor.getMetrics('test', { since: now + 500 })

      expect(metrics).toHaveLength(2)
      expect(metrics[0].duration).toBe(20)
      expect(metrics[1].duration).toBe(30)
    })

    it('should limit returned metrics', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric('test', { duration: i })
      }

      const metrics = monitor.getMetrics('test', { limit: 3 })

      expect(metrics).toHaveLength(3)
      expect(metrics[0].duration).toBe(7)
      expect(metrics[2].duration).toBe(9)
    })

    it('should return all metrics when no category specified', () => {
      monitor.recordMetric('category1', { duration: 10 })
      monitor.recordMetric('category2', { duration: 20 })

      const allMetrics = monitor.getMetrics()

      expect(allMetrics.category1).toHaveLength(1)
      expect(allMetrics.category2).toHaveLength(1)
    })
  })

  describe('reporting', () => {
    it('should create comprehensive report', () => {
      monitor.recordMetric('operation1', { duration: 45 })
      monitor.recordMetric('operation2', { duration: 75 })

      const mockMemory = {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      })

      monitor.measureMemory()

      const report = monitor.createReport()

      expect(report).toHaveProperty('timestamp')
      expect(report.summary.totalCategories).toBe(2)
      expect(report.summary.totalMetrics).toBe(3)
      expect(report.categories.operation1).toBeDefined()
      expect(report.categories.operation2).toBeDefined()
      expect(report.bottlenecks).toHaveLength(1)
      expect(report.memory.current).toBe(50 * 1024 * 1024)

      delete performance.memory
    })
  })

  describe('cleanup operations', () => {
    it('should clear all metrics', () => {
      monitor.recordMetric('test', { duration: 10 })
      monitor.startTimer('timer')

      monitor.clear()

      expect(monitor.getMetrics('test')).toHaveLength(0)
      expect(monitor.endTimer('timer')).toBeNull()
    })

    it('should reset specific category', () => {
      monitor.recordMetric('category1', { duration: 10 })
      monitor.recordMetric('category2', { duration: 20 })

      monitor.reset('category1')

      expect(monitor.getMetrics('category1')).toHaveLength(0)
      expect(monitor.getMetrics('category2')).toHaveLength(1)
    })

    it('should reset all categories', () => {
      monitor.recordMetric('category1', { duration: 10 })
      monitor.recordMetric('category2', { duration: 20 })

      monitor.reset()

      expect(monitor.getMetrics()).toEqual({})
    })
  })
})