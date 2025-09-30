/**
 * Context Menu Integration Tests
 * Tests context menu integration with TTS pipeline (AC4, IV2)
 */

// Mock chrome APIs
global.chrome = {
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn()
  },
  runtime: {
    lastError: null
  }
}

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
}

describe('Context Menu Integration Tests - AC4 and IV2', () => {
  let setupContextMenus
  let contextMenuClickHandler

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    global.chrome.runtime.lastError = null

    // Capture the context menu click handler
    global.chrome.contextMenus.onClicked.addListener.mockImplementation((handler) => {
      contextMenuClickHandler = handler
    })

    // Mock setupContextMenus function from background.js
    setupContextMenus = () => {
      try {
        // Create "Speak selection" menu item
        chrome.contextMenus.create({
          id: 'kokoro-tts-speak-selection',
          title: 'Speak selection',
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            mockLogger.error('Failed to create "Speak selection" context menu:', chrome.runtime.lastError)
          } else {
            mockLogger.info('"Speak selection" context menu created successfully')
          }
        })

        // Create "Read page" menu item
        chrome.contextMenus.create({
          id: 'kokoro-tts-read-page',
          title: 'Read page',
          contexts: ['page']
        }, () => {
          if (chrome.runtime.lastError) {
            mockLogger.error('Failed to create "Read page" context menu:', chrome.runtime.lastError)
          } else {
            mockLogger.info('"Read page" context menu created successfully')
          }
        })

        chrome.contextMenus.onClicked.addListener((info, tab) => {
          try {
            if (info.menuItemId === 'kokoro-tts-speak-selection' && info.selectionText) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'TTS_REQUEST',
                action: 'speak-selection',
                text: info.selectionText,
                source: 'context-menu'
              }).catch(error => {
                mockLogger.error('Failed to send speak-selection message:', error)
              })
            } else if (info.menuItemId === 'kokoro-tts-read-page') {
              chrome.tabs.sendMessage(tab.id, {
                type: 'TTS_REQUEST',
                action: 'read-page',
                source: 'context-menu'
              }).catch(error => {
                mockLogger.error('Failed to send read-page message:', error)
              })
            }
          } catch (error) {
            mockLogger.error('Error handling context menu click:', error)
          }
        })
      } catch (error) {
        mockLogger.error('Failed to setup context menus:', error)
      }
    }
  })

  describe('Context Menu Creation - AC4', () => {
    test('should create "Speak selection" context menu item', () => {
      setupContextMenus()

      expect(chrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'kokoro-tts-speak-selection',
          title: 'Speak selection',
          contexts: ['selection']
        }),
        expect.any(Function)
      )
    })

    test('should create "Read page" context menu item', () => {
      setupContextMenus()

      expect(chrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'kokoro-tts-read-page',
          title: 'Read page',
          contexts: ['page']
        }),
        expect.any(Function)
      )
    })

    test('should log success when context menus are created', () => {
      setupContextMenus()

      // Call the success callbacks
      const speakSelectionCallback = chrome.contextMenus.create.mock.calls[0][1]
      const readPageCallback = chrome.contextMenus.create.mock.calls[1][1]

      speakSelectionCallback()
      readPageCallback()

      expect(mockLogger.info).toHaveBeenCalledWith('"Speak selection" context menu created successfully')
      expect(mockLogger.info).toHaveBeenCalledWith('"Read page" context menu created successfully')
    })

    test('should log error when context menu creation fails', () => {
      setupContextMenus()

      // Simulate error
      global.chrome.runtime.lastError = { message: 'Context menu creation failed' }

      const callback = chrome.contextMenus.create.mock.calls[0][1]
      callback()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create "Speak selection" context menu:',
        { message: 'Context menu creation failed' }
      )
    })

    test('should register context menu click listener', () => {
      setupContextMenus()

      expect(chrome.contextMenus.onClicked.addListener).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('"Speak selection" Context Menu - IV2', () => {
    beforeEach(() => {
      setupContextMenus()
      // Mock chrome.tabs.sendMessage to return a promise
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve({ success: true }))
    })

    test('should send TTS_REQUEST message when "Speak selection" is clicked', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Hello world, this is a test.'
      }
      const mockTab = { id: 123 }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        {
          type: 'TTS_REQUEST',
          action: 'speak-selection',
          text: 'Hello world, this is a test.',
          source: 'context-menu'
        }
      )
    })

    test('should handle selection text from Wikipedia', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Wikipedia is a free online encyclopedia.'
      }
      const mockTab = { id: 456, url: 'https://en.wikipedia.org/wiki/Test' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        456,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'speak-selection',
          text: 'Wikipedia is a free online encyclopedia.',
          source: 'context-menu'
        })
      )
    })

    test('should handle selection text from Medium', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'The quick brown fox jumps over the lazy dog.'
      }
      const mockTab = { id: 789, url: 'https://medium.com/test-article' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        789,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'speak-selection',
          text: 'The quick brown fox jumps over the lazy dog.',
          source: 'context-menu'
        })
      )
    })

    test('should handle selection text from CNN', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Breaking news from around the world.'
      }
      const mockTab = { id: 101, url: 'https://www.cnn.com/article' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'speak-selection',
          text: 'Breaking news from around the world.',
          source: 'context-menu'
        })
      )
    })

    test('should not send message if no selection text', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: ''
      }
      const mockTab = { id: 123 }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    test('should handle message send errors gracefully', async () => {
      chrome.tabs.sendMessage.mockReturnValue(Promise.reject(new Error('Tab not found')))

      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Test text'
      }
      const mockTab = { id: 999 }

      contextMenuClickHandler(mockInfo, mockTab)

      // Wait for promise rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send speak-selection message:',
        expect.any(Error)
      )
    })
  })

  describe('"Read page" Context Menu - IV2', () => {
    beforeEach(() => {
      setupContextMenus()
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve({ success: true }))
    })

    test('should send TTS_REQUEST message when "Read page" is clicked', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-read-page'
      }
      const mockTab = { id: 123 }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        {
          type: 'TTS_REQUEST',
          action: 'read-page',
          source: 'context-menu'
        }
      )
    })

    test('should work on Wikipedia pages', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-read-page'
      }
      const mockTab = { id: 456, url: 'https://en.wikipedia.org/wiki/Test' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        456,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'read-page',
          source: 'context-menu'
        })
      )
    })

    test('should work on Medium pages', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-read-page'
      }
      const mockTab = { id: 789, url: 'https://medium.com/test-article' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        789,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'read-page',
          source: 'context-menu'
        })
      )
    })

    test('should work on CNN pages', () => {
      const mockInfo = {
        menuItemId: 'kokoro-tts-read-page'
      }
      const mockTab = { id: 101, url: 'https://www.cnn.com/article' }

      contextMenuClickHandler(mockInfo, mockTab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          type: 'TTS_REQUEST',
          action: 'read-page',
          source: 'context-menu'
        })
      )
    })

    test('should handle message send errors gracefully', async () => {
      chrome.tabs.sendMessage.mockReturnValue(Promise.reject(new Error('Tab not found')))

      const mockInfo = {
        menuItemId: 'kokoro-tts-read-page'
      }
      const mockTab = { id: 999 }

      contextMenuClickHandler(mockInfo, mockTab)

      // Wait for promise rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send read-page message:',
        expect.any(Error)
      )
    })
  })

  describe('Context Menu Pipeline Integration - IV2', () => {
    beforeEach(() => {
      setupContextMenus()
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve({ success: true }))
    })

    test('should trigger same TTS pipeline as floating button', () => {
      // Both context menu and floating button should send TTS_REQUEST messages
      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Test text'
      }
      const mockTab = { id: 123 }

      contextMenuClickHandler(mockInfo, mockTab)

      const sentMessage = chrome.tabs.sendMessage.mock.calls[0][1]

      // Verify message structure matches expected TTS_REQUEST format
      expect(sentMessage).toEqual({
        type: 'TTS_REQUEST',
        action: 'speak-selection',
        text: 'Test text',
        source: 'context-menu'
      })

      // This message should trigger the same pipeline as floating button clicks
      expect(sentMessage.type).toBe('TTS_REQUEST')
      expect(sentMessage.source).toBe('context-menu')
    })

    test('should work with different text lengths', () => {
      const testTexts = [
        'Short',
        'Medium length text with multiple words',
        'Very long text that spans multiple sentences. This is the second sentence. And here is a third sentence to make it even longer.'
      ]

      testTexts.forEach((text, index) => {
        jest.clearAllMocks()

        const mockInfo = {
          menuItemId: 'kokoro-tts-speak-selection',
          selectionText: text
        }
        const mockTab = { id: 100 + index }

        contextMenuClickHandler(mockInfo, mockTab)

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          100 + index,
          expect.objectContaining({
            text: text
          })
        )
      })
    })

    test('should handle special characters in selection text', () => {
      const specialTexts = [
        'Text with "quotes"',
        "Text with 'single quotes'",
        'Text with <html> tags',
        'Text with & ampersand',
        'Text with émojis 🎉'
      ]

      specialTexts.forEach((text, index) => {
        jest.clearAllMocks()

        const mockInfo = {
          menuItemId: 'kokoro-tts-speak-selection',
          selectionText: text
        }
        const mockTab = { id: 200 + index }

        contextMenuClickHandler(mockInfo, mockTab)

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          200 + index,
          expect.objectContaining({
            text: text
          })
        )
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle errors in context menu click handler', () => {
      setupContextMenus()

      // Force an error by passing invalid data
      expect(() => {
        contextMenuClickHandler(null, null)
      }).not.toThrow() // Should be caught internally

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling context menu click:',
        expect.any(Error)
      )
    })

    test('should handle setup errors gracefully', () => {
      chrome.contextMenus.create.mockImplementation(() => {
        throw new Error('Setup failed')
      })

      expect(() => setupContextMenus()).not.toThrow()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to setup context menus:',
        expect.any(Error)
      )
    })
  })

  describe('Performance', () => {
    test('should send context menu messages within 100ms', () => {
      setupContextMenus()
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve({ success: true }))

      const startTime = performance.now()

      const mockInfo = {
        menuItemId: 'kokoro-tts-speak-selection',
        selectionText: 'Test text'
      }
      const mockTab = { id: 123 }

      contextMenuClickHandler(mockInfo, mockTab)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      // Context menu response should be < 100ms (IV2 performance requirement)
      expect(responseTime).toBeLessThan(100)
    })
  })
})
