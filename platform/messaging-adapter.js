/**
 * @module MessagingAdapter
 * @description Messaging wrapper for chrome.runtime messaging
 */

class MessagingAdapter {
  constructor() {
    this.listeners = new Map()
    this.connectionListeners = new Map()
    this.ports = new Map()
    this.messageId = 0
    this.pendingResponses = new Map()
  }

  async initialize() {
    if (this._isMessagingAvailable()) {
      chrome.runtime.onMessage.addListener(this._handleMessage.bind(this))
      chrome.runtime.onConnect.addListener(this._handleConnect.bind(this))
    }
  }

  async cleanup() {
    for (const port of this.ports.values()) {
      port.disconnect()
    }
    this.ports.clear()
    this.listeners.clear()
    this.connectionListeners.clear()
    this.pendingResponses.clear()
  }

  async sendMessage(message, options = {}) {
    if (!this._isMessagingAvailable()) {
      throw new Error('Chrome messaging not available')
    }

    const messageId = this._generateMessageId()
    const wrappedMessage = {
      id: messageId,
      timestamp: Date.now(),
      ...message
    }

    if (options.tabId) {
      return this._sendToTab(options.tabId, wrappedMessage, options)
    } else if (options.extensionId) {
      return this._sendToExtension(options.extensionId, wrappedMessage, options)
    } else {
      return this._sendToRuntime(wrappedMessage, options)
    }
  }

  onMessage(handler) {
    const id = this._generateHandlerId()
    this.listeners.set(id, handler)
    return () => this.listeners.delete(id)
  }

  connectPort(name, options = {}) {
    if (!this._isMessagingAvailable()) {
      throw new Error('Chrome messaging not available')
    }

    let port
    if (options.tabId) {
      port = chrome.tabs.connect(options.tabId, { name })
    } else if (options.extensionId) {
      port = chrome.runtime.connect(options.extensionId, { name })
    } else {
      port = chrome.runtime.connect({ name })
    }

    this.ports.set(name, port)

    port.onMessage.addListener((message) => {
      this._notifyPortListeners(name, message)
    })

    port.onDisconnect.addListener(() => {
      this.ports.delete(name)
      this._notifyDisconnectListeners(name)
    })

    return {
      send: (message) => port.postMessage(message),
      disconnect: () => {
        port.disconnect()
        this.ports.delete(name)
      },
      onMessage: (handler) => this._addPortListener(name, handler),
      onDisconnect: (handler) => this._addDisconnectListener(name, handler)
    }
  }

  onConnect(handler) {
    const id = this._generateHandlerId()
    this.connectionListeners.set(id, handler)
    return () => this.connectionListeners.delete(id)
  }

  async broadcast(message, options = {}) {
    const results = []

    if (options.toTabs) {
      const tabs = await this._getAllTabs()
      for (const tab of tabs) {
        try {
          const result = await this.sendMessage(message, { tabId: tab.id })
          results.push({ tabId: tab.id, result })
        } catch (error) {
          results.push({ tabId: tab.id, error: error.message })
        }
      }
    }

    if (options.toBackground && !this._isBackground()) {
      try {
        const result = await this.sendMessage(message)
        results.push({ target: 'background', result })
      } catch (error) {
        results.push({ target: 'background', error: error.message })
      }
    }

    return results
  }

  isAvailable() {
    return this._isMessagingAvailable()
  }

  getCapabilities() {
    return {
      runtime: typeof chrome !== 'undefined' && chrome.runtime,
      tabs: typeof chrome !== 'undefined' && chrome.tabs,
      ports: true,
      broadcast: true
    }
  }

  async test() {
    try {
      const testMessage = { type: 'ping', timestamp: Date.now() }
      const response = await this.sendMessage(testMessage)
      return { success: true, response }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  _handleMessage(message, sender, sendResponse) {
    const asyncResponse = this._processMessage(message, sender)

    asyncResponse.then(response => {
      if (sendResponse) {
        sendResponse(response)
      }
    }).catch(error => {
      console.error('Message handler error:', error)
      if (sendResponse) {
        sendResponse({ error: error.message })
      }
    })

    return true
  }

  async _processMessage(message, sender) {
    const responses = []

    for (const handler of this.listeners.values()) {
      try {
        const response = await handler(message, sender)
        if (response !== undefined) {
          responses.push(response)
        }
      } catch (error) {
        console.error('Message handler error:', error)
      }
    }

    return responses.length === 1 ? responses[0] : responses
  }

  _handleConnect(port) {
    for (const handler of this.connectionListeners.values()) {
      try {
        handler(port)
      } catch (error) {
        console.error('Connection handler error:', error)
      }
    }
  }

  _sendToTab(tabId, message, options) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, options.frameId ? { frameId: options.frameId } : {}, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(response)
        }
      })
    })
  }

  _sendToExtension(extensionId, message, options) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(extensionId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(response)
        }
      })
    })
  }

  _sendToRuntime(message, options) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(response)
        }
      })
    })
  }

  _getAllTabs() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else {
          resolve(tabs)
        }
      })
    })
  }

  _isBackground() {
    return typeof chrome !== 'undefined' &&
           chrome.runtime &&
           chrome.runtime.getBackgroundPage
  }

  _isMessagingAvailable() {
    return typeof chrome !== 'undefined' &&
           chrome.runtime &&
           chrome.runtime.sendMessage
  }

  _generateMessageId() {
    return `msg-${++this.messageId}-${Date.now()}`
  }

  _generateHandlerId() {
    return `handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  _addPortListener(portName, handler) {
    const listeners = this.portListeners || new Map()
    if (!listeners.has(portName)) {
      listeners.set(portName, new Set())
    }
    listeners.get(portName).add(handler)
    this.portListeners = listeners
    return () => {
      const portListeners = listeners.get(portName)
      if (portListeners) {
        portListeners.delete(handler)
      }
    }
  }

  _notifyPortListeners(portName, message) {
    if (!this.portListeners) return

    const listeners = this.portListeners.get(portName)
    if (listeners) {
      for (const handler of listeners) {
        try {
          handler(message)
        } catch (error) {
          console.error('Port listener error:', error)
        }
      }
    }
  }

  _addDisconnectListener(portName, handler) {
    const listeners = this.disconnectListeners || new Map()
    if (!listeners.has(portName)) {
      listeners.set(portName, new Set())
    }
    listeners.get(portName).add(handler)
    this.disconnectListeners = listeners
    return () => {
      const portListeners = listeners.get(portName)
      if (portListeners) {
        portListeners.delete(handler)
      }
    }
  }

  _notifyDisconnectListeners(portName) {
    if (!this.disconnectListeners) return

    const listeners = this.disconnectListeners.get(portName)
    if (listeners) {
      for (const handler of listeners) {
        try {
          handler()
        } catch (error) {
          console.error('Disconnect listener error:', error)
        }
      }
    }
  }
}

export { MessagingAdapter }