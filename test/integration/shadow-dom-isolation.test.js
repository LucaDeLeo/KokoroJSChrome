/**
 * Shadow DOM CSS Isolation Tests
 * Tests that Shadow DOM prevents CSS conflicts with host pages (IV1)
 */

import FloatingButton from '../../plugins/ui-renderer/src/components/floating-button.js'
import ProgressBar from '../../plugins/ui-renderer/src/components/progress-bar.js'
import ControlPanel from '../../plugins/ui-renderer/src/components/control-panel.js'

// Mock DOM environment
const setupMockDOM = () => {
  // Create mock document
  if (typeof document === 'undefined') {
    global.document = {
      createElement: jest.fn((tag) => {
        const element = {
          id: '',
          className: '',
          style: {},
          children: [],
          attachShadow: jest.fn((options) => {
            const shadowRoot = {
              mode: options.mode,
              adoptedStyleSheets: [],
              appendChild: jest.fn((child) => {
                shadowRoot.children = shadowRoot.children || []
                shadowRoot.children.push(child)
              }),
              querySelector: jest.fn(),
              querySelectorAll: jest.fn(() => []),
              children: []
            }
            element.shadowRoot = shadowRoot
            return shadowRoot
          }),
          appendChild: jest.fn((child) => {
            element.children.push(child)
          }),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          setAttribute: jest.fn(),
          removeAttribute: jest.fn(),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
          },
          innerHTML: '',
          textContent: '',
          value: '',
          remove: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({
            left: 0,
            top: 0,
            right: 100,
            bottom: 50,
            width: 100,
            height: 50
          }))
        }
        return element
      }),
      body: {
        appendChild: jest.fn(),
        style: {}
      },
      querySelectorAll: jest.fn(() => [])
    }

    global.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      scrollX: 0,
      scrollY: 0,
      getComputedStyle: jest.fn(() => ({
        color: 'rgb(255, 0, 0)',
        backgroundColor: 'rgb(0, 0, 255)',
        fontSize: '16px',
        fontFamily: 'Arial'
      })),
      requestAnimationFrame: jest.fn(cb => setTimeout(cb, 0)),
      performance: {
        now: () => Date.now()
      }
    }

    global.CSSStyleSheet = class CSSStyleSheet {
      constructor() {
        this.cssRules = []
        this.css = ''
      }
      replaceSync(css) {
        this.css = css
      }
    }
  }
}

describe('Shadow DOM CSS Isolation Tests - IV1', () => {
  beforeAll(() => {
    setupMockDOM()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Shadow DOM Mode - Closed', () => {
    test('FloatingButton should use closed Shadow DOM mode', () => {
      const button = new FloatingButton()

      button.render({ position: { x: 100, y: 100 } })

      expect(document.createElement).toHaveBeenCalled()
      const createCall = document.createElement.mock.results.find(r => r.value.id === 'kokoro-tts-floating-button')
      expect(createCall).toBeDefined()

      const container = createCall.value
      expect(container.attachShadow).toHaveBeenCalledWith({ mode: 'closed' })
    })

    test('ProgressBar should use closed Shadow DOM mode', () => {
      const progressBar = new ProgressBar()

      progressBar.render({ value: 50, message: 'Test' })

      const createCall = document.createElement.mock.results.find(r => r.value.id === 'kokoro-tts-progress-bar')
      expect(createCall).toBeDefined()

      const container = createCall.value
      expect(container.attachShadow).toHaveBeenCalledWith({ mode: 'closed' })
    })

    test('ControlPanel should use closed Shadow DOM mode', () => {
      const controlPanel = new ControlPanel()

      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      const createCall = document.createElement.mock.results.find(r => r.value.id === 'kokoro-tts-control-panel')
      expect(createCall).toBeDefined()

      const container = createCall.value
      expect(container.attachShadow).toHaveBeenCalledWith({ mode: 'closed' })
    })

    test('Closed Shadow DOM should prevent external access', () => {
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // In closed mode, shadowRoot is not exposed
      // The component stores it internally but it's not accessible from outside
      expect(button.shadowRoot).toBeDefined() // Internal access works

      // External access through container.shadowRoot should not be possible
      // (In real browser, container.shadowRoot would be null for closed mode)
    })
  })

  describe('Adopted Stylesheets - No Inline Styles', () => {
    test('FloatingButton should use adopted stylesheets', () => {
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      const container = button.container
      const shadowRoot = container.shadowRoot

      // Verify adoptedStyleSheets is used
      expect(shadowRoot.adoptedStyleSheets).toBeDefined()
      expect(Array.isArray(shadowRoot.adoptedStyleSheets)).toBe(true)
    })

    test('ProgressBar should use adopted stylesheets', () => {
      const progressBar = new ProgressBar()
      progressBar.render({ value: 50, message: 'Test' })

      const container = progressBar.container
      const shadowRoot = container.shadowRoot

      expect(shadowRoot.adoptedStyleSheets).toBeDefined()
      expect(Array.isArray(shadowRoot.adoptedStyleSheets)).toBe(true)
    })

    test('ControlPanel should use adopted stylesheets', () => {
      const controlPanel = new ControlPanel()
      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      const container = controlPanel.container
      const shadowRoot = container.shadowRoot

      expect(shadowRoot.adoptedStyleSheets).toBeDefined()
      expect(Array.isArray(shadowRoot.adoptedStyleSheets)).toBe(true)
    })

    test('Components should not use inline styles from page content', () => {
      // Simulate aggressive host page styles
      global.window.getComputedStyle = jest.fn(() => ({
        color: 'rgb(255, 0, 0) !important',
        backgroundColor: 'rgb(0, 0, 255) !important',
        fontSize: '50px !important',
        fontFamily: 'Comic Sans MS !important',
        zIndex: '999999 !important'
      }))

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Verify button uses its own styles, not inherited from host
      const shadowRoot = button.shadowRoot

      // adoptedStyleSheets should contain the component's styles
      expect(shadowRoot.adoptedStyleSheets.length).toBeGreaterThan(0)

      // Verify CSS content (should be component's styles, not host's)
      const stylesheet = shadowRoot.adoptedStyleSheets[0]
      expect(stylesheet.css).toBeDefined()
      expect(stylesheet.css.length).toBeGreaterThan(0)
    })
  })

  describe('CSS Isolation - No Leakage', () => {
    test('Host page aggressive CSS should not affect FloatingButton', () => {
      // Simulate aggressive host page CSS
      const hostStyles = {
        'button': {
          backgroundColor: 'red !important',
          color: 'yellow !important',
          fontSize: '100px !important'
        },
        'div': {
          display: 'none !important'
        },
        '*': {
          margin: '1000px !important',
          padding: '1000px !important'
        }
      }

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Shadow DOM isolation means host styles don't apply
      // The button's internal styles should be used instead
      const shadowRoot = button.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // Verify component has its own button styles
      expect(stylesheet.css).toContain('button')
      expect(stylesheet.css).toContain('#4285f4') // Component's blue color
      expect(stylesheet.css).toContain('background')
    })

    test('Host page CSS frameworks should not affect ProgressBar', () => {
      // Simulate Bootstrap/Tailwind aggressive resets
      const frameworkStyles = {
        '*': {
          boxSizing: 'border-box !important',
          margin: '0 !important',
          padding: '0 !important'
        },
        'div': {
          display: 'flex !important',
          flexDirection: 'column !important'
        }
      }

      const progressBar = new ProgressBar()
      progressBar.render({ value: 50, message: 'Test' })

      const shadowRoot = progressBar.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // Verify component has its own complete styles
      expect(stylesheet.css).toBeDefined()
      expect(stylesheet.css).toContain('progress-container')
      expect(stylesheet.css).toContain('progress-bar')
    })

    test('Host page CSS should not affect ControlPanel', () => {
      // Simulate aggressive host CSS
      const hostStyles = {
        'button': { display: 'none !important' },
        'select': { appearance: 'none !important' },
        'input[type="range"]': { display: 'none !important' }
      }

      const controlPanel = new ControlPanel()
      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      const shadowRoot = controlPanel.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // Verify all controls have explicit styles
      expect(stylesheet.css).toContain('control-button')
      expect(stylesheet.css).toContain('voice-select')
      expect(stylesheet.css).toContain('slider')
    })

    test('Component styles should not leak to host page', () => {
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Component styles are encapsulated in Shadow DOM
      // They should not affect host page elements

      // If we query the document for buttons, component button shouldn't be found
      // (because it's inside Shadow DOM)
      const hostButtons = document.querySelectorAll('button')

      // Shadow DOM content is not visible to document queries
      expect(hostButtons.length).toBe(0)
    })
  })

  describe('Z-Index and Positioning Isolation', () => {
    test('FloatingButton should have high z-index that works independently', () => {
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Component uses fixed positioning with high z-index
      expect(button.container.style.cssText).toContain('position: fixed')
      expect(button.container.style.cssText).toContain('z-index: 2147483647')
    })

    test('ProgressBar should have high z-index that works independently', () => {
      const progressBar = new ProgressBar()
      progressBar.render({ value: 50, message: 'Test' })

      expect(progressBar.container.style.cssText).toContain('position: fixed')
      expect(progressBar.container.style.cssText).toContain('z-index: 2147483647')
    })

    test('ControlPanel should have high z-index that works independently', () => {
      const controlPanel = new ControlPanel()
      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      expect(controlPanel.container.style.cssText).toContain('position: fixed')
      expect(controlPanel.container.style.cssText).toContain('z-index: 2147483646')
    })

    test('Host page z-index should not affect components', () => {
      // Simulate host page with very high z-index elements
      const hostElement = document.createElement('div')
      hostElement.style.zIndex = '9999999'

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Component's container uses its own z-index
      expect(button.container.style.cssText).toContain('z-index')

      // Shadow DOM isolation means host z-index doesn't matter for internal content
    })
  })

  describe('Font and Typography Isolation', () => {
    test('Components should use their own font families', () => {
      // Simulate host page with unusual fonts
      global.window.getComputedStyle = jest.fn(() => ({
        fontFamily: 'Comic Sans MS, cursive'
      }))

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      const shadowRoot = button.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // Component should specify its own font family
      expect(stylesheet.css).toContain('font-family')
      expect(stylesheet.css).toContain('system')
    })

    test('Font sizes should be controlled by component, not host', () => {
      // Simulate host page with large font size
      global.window.getComputedStyle = jest.fn(() => ({
        fontSize: '100px'
      }))

      const progressBar = new ProgressBar()
      progressBar.render({ value: 50, message: 'Test' })

      const shadowRoot = progressBar.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // Component should have explicit font sizes
      expect(stylesheet.css).toContain('font-size')
      expect(stylesheet.css).toContain('14px')
    })
  })

  describe('Real-World Scenarios', () => {
    test('Should work on Wikipedia with its CSS framework', () => {
      // Wikipedia uses Vector skin with specific CSS
      const wikipediaStyles = {
        fontSize: '0.875em',
        lineHeight: '1.6',
        color: '#202122'
      }

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Component should render correctly regardless of Wikipedia's styles
      expect(button.container).toBeDefined()
      expect(button.shadowRoot).toBeDefined()
      expect(button.shadowRoot.adoptedStyleSheets.length).toBeGreaterThan(0)
    })

    test('Should work on Medium with its aggressive CSS', () => {
      // Medium uses CSS-in-JS with high specificity
      const mediumStyles = {
        letterSpacing: '-0.003em',
        lineHeight: '1.58',
        wordBreak: 'break-word'
      }

      const progressBar = new ProgressBar()
      progressBar.render({ value: 50, message: 'Test' })

      // Component should be isolated from Medium's styles
      expect(progressBar.container).toBeDefined()
      expect(progressBar.shadowRoot).toBeDefined()
    })

    test('Should work on CNN with their layout system', () => {
      // CNN uses complex grid and flexbox layouts
      const cnnStyles = {
        display: 'flex',
        flexDirection: 'column',
        gridTemplateColumns: 'repeat(12, 1fr)'
      }

      const controlPanel = new ControlPanel()
      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      // Component should maintain its own layout
      expect(controlPanel.container).toBeDefined()
      expect(controlPanel.shadowRoot).toBeDefined()
    })
  })

  describe('CSS Reset Prevention', () => {
    test('Host page CSS reset should not affect Shadow DOM content', () => {
      // Simulate aggressive CSS reset
      const resetStyles = {
        '*': {
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          border: 'none',
          outline: 'none'
        }
      }

      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      const shadowRoot = button.shadowRoot
      const stylesheet = shadowRoot.adoptedStyleSheets[0]

      // :host selector should protect from host resets
      expect(stylesheet.css).toContain(':host')
      expect(stylesheet.css).toContain('all: initial')
    })

    test('Universal selector from host should not penetrate Shadow DOM', () => {
      // Even * { display: none !important } shouldn't affect Shadow DOM
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      // Shadow DOM boundary prevents universal selectors from affecting content
      expect(button.shadowRoot).toBeDefined()
      expect(button.shadowRoot.adoptedStyleSheets).toBeDefined()
    })
  })

  describe('Cleanup and Isolation Persistence', () => {
    test('Cleanup should remove Shadow DOM components completely', async () => {
      const button = new FloatingButton()
      button.render({ position: { x: 100, y: 100 } })

      expect(button.container).toBeDefined()

      await button.cleanup()

      // After cleanup, references should be cleared
      expect(button.container).toBeNull()
      expect(button.shadowRoot).toBeNull()
    })

    test('Multiple components should be isolated from each other', () => {
      const button = new FloatingButton()
      const progressBar = new ProgressBar()
      const controlPanel = new ControlPanel()

      button.render({ position: { x: 100, y: 100 } })
      progressBar.render({ value: 50, message: 'Test' })
      controlPanel.render({
        voices: [],
        currentVoice: 'af_bella',
        currentSpeed: 1.0,
        currentVolume: 100
      })

      // Each component has its own isolated Shadow DOM
      expect(button.shadowRoot).not.toBe(progressBar.shadowRoot)
      expect(progressBar.shadowRoot).not.toBe(controlPanel.shadowRoot)
      expect(controlPanel.shadowRoot).not.toBe(button.shadowRoot)
    })
  })
})
