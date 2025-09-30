/**
 * @module DebugLogger
 * @description Structured logging for debugging
 */

class DebugLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false
    this.level = options.level || 'info'
    this.prefix = options.prefix || '[KokoroJS]'
    this.includeTimestamp = options.includeTimestamp !== false
    this.includeStack = options.includeStack || false
    this.maxLogSize = options.maxLogSize || 1000
    this.logs = []
    this.filters = []

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    }

    this.colors = {
      error: 'color: red; font-weight: bold',
      warn: 'color: orange; font-weight: bold',
      info: 'color: blue',
      debug: 'color: gray',
      trace: 'color: lightgray'
    }
  }

  setLevel(level) {
    if (!this.levels.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}`)
    }
    this.level = level
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  addFilter(filter) {
    this.filters.push(filter)
  }

  removeFilter(filter) {
    const index = this.filters.indexOf(filter)
    if (index > -1) {
      this.filters.splice(index, 1)
    }
  }

  error(message, ...args) {
    this._log('error', message, ...args)
  }

  warn(message, ...args) {
    this._log('warn', message, ...args)
  }

  info(message, ...args) {
    this._log('info', message, ...args)
  }

  debug(message, ...args) {
    this._log('debug', message, ...args)
  }

  trace(message, ...args) {
    this._log('trace', message, ...args)
  }

  group(label) {
    if (this.enabled && console.group) {
      console.group(`${this.prefix} ${label}`)
    }
  }

  groupEnd() {
    if (this.enabled && console.groupEnd) {
      console.groupEnd()
    }
  }

  time(label) {
    if (this.enabled && console.time) {
      console.time(`${this.prefix} ${label}`)
    }
  }

  timeEnd(label) {
    if (this.enabled && console.timeEnd) {
      console.timeEnd(`${this.prefix} ${label}`)
    }
  }

  table(data, columns) {
    if (this.enabled && console.table) {
      console.table(data, columns)
    }
  }

  _log(level, message, ...args) {
    if (!this.enabled) {
      return
    }

    if (this.levels[level] > this.levels[this.level]) {
      return
    }

    if (!this._shouldLog(level, message, args)) {
      return
    }

    const logEntry = this._createLogEntry(level, message, args)
    this._storeLog(logEntry)

    const formattedMessage = this._formatMessage(logEntry)
    const consoleMethod = console[level] || console.log

    if (typeof window !== 'undefined' && this.colors[level]) {
      consoleMethod(`%c${formattedMessage}`, this.colors[level], ...args)
    } else {
      consoleMethod(formattedMessage, ...args)
    }

    if (this.includeStack && level === 'error') {
      console.trace()
    }
  }

  _shouldLog(level, message, args) {
    if (this.filters.length === 0) {
      return true
    }

    return this.filters.every(filter => {
      if (typeof filter === 'function') {
        return filter(level, message, args)
      } else if (filter instanceof RegExp) {
        return filter.test(message)
      } else if (typeof filter === 'string') {
        return message.includes(filter)
      }
      return true
    })
  }

  _createLogEntry(level, message, args) {
    return {
      timestamp: Date.now(),
      level,
      message,
      args,
      stack: this.includeStack ? new Error().stack : null
    }
  }

  _storeLog(logEntry) {
    this.logs.push(logEntry)

    if (this.logs.length > this.maxLogSize) {
      this.logs.shift()
    }
  }

  _formatMessage(logEntry) {
    const parts = []

    if (this.includeTimestamp) {
      const date = new Date(logEntry.timestamp)
      parts.push(`[${date.toISOString()}]`)
    }

    parts.push(this.prefix)
    parts.push(`[${logEntry.level.toUpperCase()}]`)
    parts.push(logEntry.message)

    return parts.join(' ')
  }

  getLogs(filter = null) {
    if (!filter) {
      return [...this.logs]
    }

    return this.logs.filter(log => {
      if (typeof filter === 'object') {
        if (filter.level && log.level !== filter.level) {
          return false
        }
        if (filter.since && log.timestamp < filter.since) {
          return false
        }
        if (filter.until && log.timestamp > filter.until) {
          return false
        }
        if (filter.message && !log.message.includes(filter.message)) {
          return false
        }
        return true
      } else if (typeof filter === 'function') {
        return filter(log)
      }
      return false
    })
  }

  clearLogs() {
    this.logs = []
  }

  export(format = 'json') {
    const logs = this.getLogs()

    if (format === 'json') {
      return JSON.stringify(logs, null, 2)
    } else if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'args']
      const rows = logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.message,
        JSON.stringify(log.args)
      ])
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    } else if (format === 'text') {
      return logs.map(log => this._formatMessage(log)).join('\n')
    }
  }

  createChildLogger(name, options = {}) {
    return new DebugLogger({
      ...options,
      prefix: `${this.prefix} [${name}]`,
      enabled: this.enabled,
      level: options.level || this.level
    })
  }

  benchmark(label, fn) {
    const start = performance.now()
    const result = fn()

    if (result instanceof Promise) {
      return result.then(value => {
        const duration = performance.now() - start
        this.debug(`${label} took ${duration.toFixed(2)}ms`)
        return value
      })
    } else {
      const duration = performance.now() - start
      this.debug(`${label} took ${duration.toFixed(2)}ms`)
      return result
    }
  }
}

export { DebugLogger }