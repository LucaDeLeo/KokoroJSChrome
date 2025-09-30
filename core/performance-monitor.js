/**
 * @module PerformanceMonitor
 * @description Performance monitoring and metrics collection
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.thresholds = {
      eventProcessing: 10,
      pipelineStage: 50,
      endToEnd: 100,
      memoryPerPlugin: 100 * 1024 * 1024
    }
    this.startTimes = new Map()
    this.memoryBaseline = null
  }

  setThreshold(name, value) {
    this.thresholds[name] = value
  }

  startTimer(name) {
    this.startTimes.set(name, performance.now())
  }

  endTimer(name) {
    const startTime = this.startTimes.get(name)
    if (!startTime) {
      console.warn(`No start time found for timer: ${name}`)
      return null
    }

    const duration = performance.now() - startTime
    this.startTimes.delete(name)

    this.recordMetric(name, { duration })
    return duration
  }

  recordMetric(category, data) {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, [])
    }

    const metric = {
      ...data,
      timestamp: Date.now(),
      performance: performance.now()
    }

    if (data.duration !== undefined) {
      metric.threshold = this._getThresholdForCategory(category)
      metric.exceedsThreshold = metric.threshold ? data.duration > metric.threshold : false
    }

    const categoryMetrics = this.metrics.get(category)
    categoryMetrics.push(metric)

    if (categoryMetrics.length > 1000) {
      categoryMetrics.shift()
    }

    if (metric.exceedsThreshold) {
      this._handleThresholdExceeded(category, metric)
    }

    return metric
  }

  _getThresholdForCategory(category) {
    if (category.includes('event')) {
      return this.thresholds.eventProcessing
    } else if (category.includes('pipeline') || category.includes('stage')) {
      return this.thresholds.pipelineStage
    } else if (category.includes('endToEnd') || category.includes('total')) {
      return this.thresholds.endToEnd
    }
    return null
  }

  _handleThresholdExceeded(category, metric) {
    console.warn(`Performance threshold exceeded for ${category}:`, {
      duration: metric.duration,
      threshold: metric.threshold,
      data: metric
    })
  }

  getMetrics(category = null, options = {}) {
    if (category) {
      const metrics = this.metrics.get(category) || []
      return this._filterMetrics(metrics, options)
    }

    const allMetrics = {}
    for (const [cat, metrics] of this.metrics.entries()) {
      allMetrics[cat] = this._filterMetrics(metrics, options)
    }
    return allMetrics
  }

  _filterMetrics(metrics, options) {
    let filtered = [...metrics]

    if (options.since) {
      filtered = filtered.filter(m => m.timestamp >= options.since)
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit)
    }

    return filtered
  }

  getStatistics(category, options = {}) {
    const metrics = this.getMetrics(category, options)
    if (!metrics || metrics.length === 0) {
      return null
    }

    const durations = metrics
      .filter(m => m.duration !== undefined)
      .map(m => m.duration)

    if (durations.length === 0) {
      return null
    }

    durations.sort((a, b) => a - b)

    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    }
  }

  getBottlenecks(options = {}) {
    const bottlenecks = []
    const threshold = options.threshold || this.thresholds.pipelineStage
    const limit = options.limit || 10

    for (const [category, metrics] of this.metrics.entries()) {
      const recent = metrics.slice(-100)
      const slow = recent.filter(m => m.duration && m.duration > threshold)

      if (slow.length > 0) {
        const stats = this.getStatistics(category, { limit: 100 })
        bottlenecks.push({
          category,
          occurrences: slow.length,
          percentage: (slow.length / recent.length) * 100,
          stats,
          worstCase: Math.max(...slow.map(m => m.duration))
        })
      }
    }

    bottlenecks.sort((a, b) => b.worstCase - a.worstCase)

    return bottlenecks.slice(0, limit)
  }

  measureMemory(label = 'default') {
    if (!performance.memory) {
      return null
    }

    const memory = {
      label,
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    }

    if (this.memoryBaseline) {
      memory.delta = memory.usedJSHeapSize - this.memoryBaseline.usedJSHeapSize
    }

    this.recordMetric('memory', memory)

    if (memory.usedJSHeapSize > this.thresholds.memoryPerPlugin) {
      console.warn(`Memory usage exceeds threshold for ${label}:`, {
        used: memory.usedJSHeapSize,
        threshold: this.thresholds.memoryPerPlugin
      })
    }

    return memory
  }

  setMemoryBaseline() {
    if (!performance.memory) {
      return null
    }

    this.memoryBaseline = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      timestamp: Date.now()
    }

    return this.memoryBaseline
  }

  createReport() {
    const report = {
      timestamp: Date.now(),
      summary: {},
      categories: {},
      bottlenecks: this.getBottlenecks(),
      memory: null
    }

    for (const [category, metrics] of this.metrics.entries()) {
      if (category !== 'memory') {
        const stats = this.getStatistics(category)
        if (stats) {
          report.categories[category] = stats
        }
      }
    }

    const memoryMetrics = this.metrics.get('memory')
    if (memoryMetrics && memoryMetrics.length > 0) {
      const latest = memoryMetrics[memoryMetrics.length - 1]
      report.memory = {
        current: latest.usedJSHeapSize,
        total: latest.totalJSHeapSize,
        limit: latest.jsHeapSizeLimit,
        baseline: this.memoryBaseline
      }
    }

    report.summary = {
      totalCategories: Object.keys(report.categories).length,
      totalMetrics: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.length, 0),
      bottleneckCount: report.bottlenecks.length,
      thresholds: { ...this.thresholds }
    }

    return report
  }

  clear() {
    this.metrics.clear()
    this.startTimes.clear()
    this.memoryBaseline = null
  }

  reset(category = null) {
    if (category) {
      this.metrics.delete(category)
    } else {
      this.metrics.clear()
    }
  }
}

export { PerformanceMonitor }