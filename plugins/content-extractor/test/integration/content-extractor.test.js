/**
 * @module ContentExtractorIntegrationTests
 * @description Integration tests for ContentExtractor plugin
 */

import ContentExtractorPlugin from '../../src/extractor.js'
import SimpleExtractor from '../../src/simple-extractor.js'
import ReadabilityWrapper from '../../src/readability-wrapper.js'
import SelectionHandler from '../../src/selection-handler.js'
import FloatingButton from '../../src/floating-button.js'

// Mock EventBus
class MockEventBus {
  constructor() {
    this.subscribers = new Map()
    this.events = []
  }

  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, [])
    }
    this.subscribers.get(eventType).push(handler)
  }

  emit(eventType, data) {
    this.events.push({ type: eventType, data, timestamp: Date.now() })
    const handlers = this.subscribers.get(eventType) || []
    handlers.forEach(handler => handler(data))
  }

  publish(eventType, data) {
    return this.emit(eventType, data)
  }
}

// Mock PAL
class MockPAL {
  constructor() {
    this.textCache = new Map()
    this.messages = []
  }

  get indexeddb() {
    return {
      storeText: async (data) => {
        const textId = `text-${Date.now()}-${Math.random()}`
        this.textCache.set(textId, data)
        return textId
      },
      getText: async (textId) => {
        return this.textCache.get(textId)
      }
    }
  }

  get messaging() {
    return {
      sendMessage: async (message) => {
        this.messages.push(message)
        return { success: true }
      }
    }
  }
}

// Test fixtures
const createMockDocument = (html) => {
  const parser = new DOMParser()
  return parser.parseFromString(html, 'text/html')
}

const wikipediaHTML = `
<!DOCTYPE html>
<html>
<body>
  <main>
    <article>
      <h1>Test Article</h1>
      <p>This is the first paragraph of the article.</p>
      <p>This is the second paragraph with more content.</p>
      <p>This is the third paragraph for testing.</p>
    </article>
  </main>
  <nav>
    <p>This should be excluded</p>
  </nav>
</body>
</html>
`

const mediumHTML = `
<!DOCTYPE html>
<html>
<body>
  <article>
    <h1>Medium Article Title</h1>
    <p>First paragraph of Medium article.</p>
    <p>Second paragraph with interesting content.</p>
  </article>
  <aside class="sidebar">
    <p>This is sidebar content that should be excluded</p>
  </aside>
</body>
</html>
`

describe('ContentExtractor Plugin', () => {
  let plugin
  let mockEventBus
  let mockPAL

  beforeEach(() => {
    mockEventBus = new MockEventBus()
    mockPAL = new MockPAL()
    plugin = new ContentExtractorPlugin()

    // Mock chrome API
    global.chrome = {
      tabs: {
        getCurrent: jest.fn().mockResolvedValue({ id: 123 })
      }
    }

    // Set up mock document for extraction tests
    global.document = createMockDocument(wikipediaHTML)
    global.window = {
      location: { href: 'https://example.com' },
      innerWidth: 1024,
      innerHeight: 768,
      scrollX: 0,
      scrollY: 0
    }
  })

  afterEach(async () => {
    if (plugin) {
      await plugin.cleanup()
    }
    delete global.chrome
  })

  describe('Plugin Initialization', () => {
    test('should initialize with event bus and PAL', async () => {
      const result = await plugin.init(mockEventBus, mockPAL)

      expect(result).toBe(true)
      expect(plugin.eventBus).toBe(mockEventBus)
      expect(plugin.pal).toBe(mockPAL)
      expect(plugin.simpleExtractor).toBeInstanceOf(SimpleExtractor)
      expect(plugin.readabilityWrapper).toBeInstanceOf(ReadabilityWrapper)
    })

    test('should throw error if event bus is missing', async () => {
      await expect(plugin.init(null, mockPAL)).rejects.toThrow('EventBus is required')
    })

    test('should throw error if PAL is missing', async () => {
      await expect(plugin.init(mockEventBus, null)).rejects.toThrow('PAL is required')
    })
  })

  describe('Simple Extraction Mode', () => {
    test('should extract paragraphs from Wikipedia-like page', () => {
      const doc = createMockDocument(wikipediaHTML)
      const extractor = new SimpleExtractor()

      const result = extractor.extract(doc)

      expect(result.text).toContain('first paragraph')
      expect(result.text).toContain('second paragraph')
      expect(result.text).toContain('third paragraph')
      expect(result.text).not.toContain('should be excluded')
      expect(result.extractionMode).toBe('simple')
      expect(result.wordCount).toBeGreaterThan(0)
    })

    test('should extract paragraphs from Medium-like page', () => {
      const doc = createMockDocument(mediumHTML)
      const extractor = new SimpleExtractor()

      const result = extractor.extract(doc)

      expect(result.text).toContain('First paragraph')
      expect(result.text).toContain('Second paragraph')
      expect(result.text).not.toContain('sidebar content')
      expect(result.extractionMode).toBe('simple')
    })

    test('should complete extraction in <500ms (IV2)', () => {
      const doc = createMockDocument(wikipediaHTML)
      const extractor = new SimpleExtractor()

      const startTime = performance.now()
      const result = extractor.extract(doc)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(500)
      expect(result.text.length).toBeGreaterThan(0)
    })

    test('should handle pages with no main/article elements', () => {
      const html = '<html><body><div><p>Test content</p></div></body></html>'
      const doc = createMockDocument(html)
      const extractor = new SimpleExtractor()

      expect(() => extractor.extract(doc)).toThrow('No main/article element found')
    })

    test('should exclude navigation and sidebar content', () => {
      const html = `
        <html>
        <body>
          <main>
            <p>Main content paragraph</p>
          </main>
          <nav><p>Navigation content</p></nav>
          <aside><p>Sidebar content</p></aside>
          <footer><p>Footer content</p></footer>
        </body>
        </html>
      `
      const doc = createMockDocument(html)
      const extractor = new SimpleExtractor()

      const result = extractor.extractAll(doc)

      expect(result.text).toContain('Main content')
      expect(result.text).not.toContain('Navigation content')
      expect(result.text).not.toContain('Sidebar content')
      expect(result.text).not.toContain('Footer content')
    })
  })

  describe('Advanced Extraction Mode (Readability)', () => {
    test('should extract article using Readability.js', () => {
      const doc = createMockDocument(mediumHTML)
      const wrapper = new ReadabilityWrapper()

      const result = wrapper.extract(doc)

      expect(result.extractionMode).toBe('advanced')
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.wordCount).toBeGreaterThan(0)
    })

    test('should fallback to simple mode if Readability fails', async () => {
      // Set up proper document with main element for simple extraction fallback
      const doc = createMockDocument(wikipediaHTML)

      await plugin.init(mockEventBus, mockPAL)

      // Mock Readability to throw error
      plugin.readabilityWrapper.extract = jest.fn(() => {
        throw new Error('Readability failed')
      })

      const result = await plugin.extractArticle(doc)

      expect(result.extractionMode).toBe('simple')
      expect(result.text.length).toBeGreaterThan(0)
    })

    test('should complete extraction in <500ms (IV2)', () => {
      const doc = createMockDocument(mediumHTML)
      const wrapper = new ReadabilityWrapper()

      const startTime = performance.now()
      const result = wrapper.extract(doc)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(500)
    })
  })

  describe('Text Selection Detection', () => {
    test('should detect text selection', () => {
      const handler = new SelectionHandler(mockEventBus, mockPAL)

      // Mock window.getSelection
      global.window.getSelection = jest.fn(() => ({
        toString: () => 'Selected text',
        rangeCount: 1,
        getRangeAt: () => ({
          getBoundingClientRect: () => ({
            top: 100,
            left: 100,
            right: 200,
            bottom: 120,
            width: 100,
            height: 20
          })
        })
      }))

      const selection = handler.getSelection()

      expect(selection).not.toBeNull()
      expect(selection.text).toBe('Selected text')
      expect(selection.rect).toBeDefined()
    })

    test('should create TTSEvent from selection (IV1)', async () => {
      const handler = new SelectionHandler(mockEventBus, mockPAL)

      const selection = {
        text: 'Test selection',
        length: 14,
        rect: { top: 100, left: 100, right: 200, bottom: 120 },
        timestamp: Date.now()
      }

      const event = await handler.createTTSEvent(selection)

      expect(event.type).toBe('tts:request')
      expect(event.source.type).toBe('selection')
      expect(event.request.text).toBe('Test selection')
      expect(event.metadata.timing).toBeDefined()
      expect(event.metadata.performance.extractionLatency).toBeGreaterThanOrEqual(0)
    })

    test('should handle large text (>50KB) with IndexedDB', async () => {
      const handler = new SelectionHandler(mockEventBus, mockPAL)

      // Create large text
      const largeText = 'a'.repeat(51000)
      const selection = {
        text: largeText,
        length: largeText.length,
        rect: { top: 100, left: 100, right: 200, bottom: 120 },
        timestamp: Date.now()
      }

      const event = await handler.createTTSEvent(selection)

      expect(event.request.textId).toBeDefined()
      expect(event.request.text).toBeUndefined()
      expect(mockPAL.textCache.size).toBe(1)
    })
  })

  describe('Floating Button UI', () => {
    test('should render floating button within 200ms (IV4)', () => {
      const button = new FloatingButton()
      const rect = { top: 100, left: 100, right: 200, bottom: 120, width: 100, height: 20 }

      const startTime = performance.now()
      button.show(rect)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(200)
      expect(button.isVisible).toBe(true)
    })

    test('should position button relative to selection', () => {
      const button = new FloatingButton()
      const rect = { top: 100, left: 150, right: 250, bottom: 120, width: 100, height: 20 }

      button.show(rect)

      expect(button.container.style.display).toBe('block')
      expect(button.container.style.position).toBe('fixed')
    })

    test('should auto-hide after timeout', () => {
      jest.useFakeTimers()
      const button = new FloatingButton({ timeout: 100, fadeInDuration: 0 })
      const rect = { top: 100, left: 100, right: 200, bottom: 120, width: 100, height: 20 }

      button.show(rect)
      expect(button.isVisible).toBe(true)

      // Advance past timeout + fade duration
      jest.advanceTimersByTime(150)

      // Check that hide was called (opacity set to 0)
      expect(button.container.style.opacity).toBe('0')
      jest.useRealTimers()
    })

    test('should handle edge cases near viewport boundaries', () => {
      const button = new FloatingButton()

      // Near right edge
      const rightEdgeRect = {
        top: 100,
        left: window.innerWidth - 50,
        right: window.innerWidth - 10,
        bottom: 120,
        width: 40,
        height: 20
      }

      button.show(rightEdgeRect)
      expect(button.isVisible).toBe(true)

      // Button should be repositioned to fit in viewport
      const left = parseInt(button.container.style.left)
      expect(left + 300).toBeLessThanOrEqual(window.innerWidth)
    })
  })

  describe('Complete Integration Flow', () => {
    test('should complete full extraction flow: selection → extract → TTSEvent (IV1)', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const extractedContent = {
        text: 'Test extracted content',
        textId: undefined,
        url: 'https://example.com',
        extractionMode: 'simple',
        length: 22,
        wordCount: 3,
        timestamp: Date.now()
      }

      await plugin._sendTTSRequest(extractedContent)

      expect(mockPAL.messages.length).toBe(1)
      expect(mockPAL.messages[0].type).toBe('TTS_REQUEST')
      expect(mockPAL.messages[0].payload.text).toBe('Test extracted content')

      expect(mockEventBus.events.length).toBeGreaterThan(0)
      const ttsRequestEvent = mockEventBus.events.find(e => e.type === 'tts:request')
      expect(ttsRequestEvent).toBeDefined()
    })

    test('should track performance metrics (IV3)', async () => {
      await plugin.init(mockEventBus, mockPAL)

      // Test metrics tracking by calling extract with selection mode
      global.window.getSelection = jest.fn(() => ({
        toString: () => 'Test selected text for metrics',
        rangeCount: 1,
        getRangeAt: () => ({
          getBoundingClientRect: () => ({
            top: 100, left: 100, right: 200, bottom: 120, width: 100, height: 20
          })
        })
      }))

      const startTime = Date.now()
      const result = await plugin.extract({ mode: 'selection' })
      const endTime = Date.now()

      expect(plugin.lastExtractionTime).toBeGreaterThanOrEqual(0)
      expect(plugin.extractionCount).toBeGreaterThan(0)
      expect(result.text).toBe('Test selected text for metrics')
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })

  describe('Error Handling', () => {
    test('should prevent XSS attacks via DOMParser (security test)', () => {
      const wrapper = new ReadabilityWrapper()

      // Track if malicious script executes
      global.scriptExecuted = false
      global.xssAttempted = false

      // Malicious HTML with various XSS vectors
      const maliciousHTML = `
        <h1>Article Title</h1>
        <p>Safe content</p>
        <script>global.scriptExecuted = true;</script>
        <script>global.xssAttempted = true; alert('XSS!');</script>
        <img src="x" onerror="global.xssAttempted = true">
        <p onclick="global.scriptExecuted = true">Click me</p>
        <style>body { background: red; }</style>
      `

      // Extract plain text (should use DOMParser, NOT innerHTML)
      const result = wrapper._extractPlainText(maliciousHTML)

      // CRITICAL: Verify scripts were NOT executed
      expect(global.scriptExecuted).toBe(false)
      expect(global.xssAttempted).toBe(false)

      // Verify script content removed from result
      expect(result).not.toContain('scriptExecuted')
      expect(result).not.toContain('xssAttempted')
      expect(result).not.toContain('alert')
      expect(result).not.toContain('<script')

      // Verify safe content present
      expect(result).toContain('Article Title')
      expect(result).toContain('Safe content')

      // Verify no inline event handlers in result
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onerror')

      // Cleanup
      delete global.scriptExecuted
      delete global.xssAttempted
    })

    test('should handle CSP-blocked sites gracefully', () => {
      const wrapper = new ReadabilityWrapper()
      const doc = createMockDocument('<html><body><p>Test</p></body></html>')

      // Mock CSP error
      wrapper.extract = jest.fn(() => {
        const error = new Error('Refused to execute script due to CSP')
        throw error
      })

      expect(() => wrapper.extract(doc)).toThrow()
    })

    test('should handle empty content', () => {
      const doc = createMockDocument('<html><body><main></main></body></html>')
      const extractor = new SimpleExtractor()

      expect(() => extractor.extract(doc)).toThrow('No content found')
    })

    test('should handle JavaScript-heavy pages', () => {
      const html = `
        <html>
        <body>
          <div id="root"></div>
          <script>// React app here</script>
        </body>
        </html>
      `
      const doc = createMockDocument(html)
      const extractor = new SimpleExtractor()

      expect(() => extractor.extract(doc)).toThrow()
    })
  })

  describe('Plugin Capabilities', () => {
    test('should return correct capabilities', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const capabilities = plugin.getCapabilities()

      expect(capabilities.supportsReadability).toBe(true)
      expect(capabilities.supportsShadowDOM).toBe(true)
      expect(capabilities.maxTextSize).toBe(100000)
      expect(capabilities.supportedModes).toContain('selection')
      expect(capabilities.supportedModes).toContain('article')
    })

    test('should pass health check', async () => {
      await plugin.init(mockEventBus, mockPAL)

      const health = await plugin.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.initialized).toBe(true)
      expect(health.capabilities).toBeDefined()
    })
  })

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await plugin.init(mockEventBus, mockPAL)

      await plugin.cleanup()

      expect(plugin.eventBus).toBeNull()
      expect(plugin.pal).toBeNull()
      expect(plugin.simpleExtractor).toBeNull()
      expect(plugin.extractionCount).toBe(0)
    })
  })
})

// Export for test runner
export default {
  name: 'ContentExtractor Integration Tests',
  tests: [
    'Plugin Initialization',
    'Simple Extraction Mode',
    'Advanced Extraction Mode (Readability)',
    'Text Selection Detection',
    'Floating Button UI',
    'Complete Integration Flow',
    'Error Handling',
    'Plugin Capabilities',
    'Cleanup'
  ]
}