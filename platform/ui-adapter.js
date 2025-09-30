/**
 * @module UIAdapter
 * @description UI wrapper for Shadow DOM operations
 */

class UIAdapter {
  constructor() {
    this.shadowRoots = new Map()
    this.styleSheets = new Map()
  }

  async initialize() {}

  async cleanup() {
    for (const [element, shadowRoot] of this.shadowRoots.entries()) {
      if (element.parentNode) {
        element.parentNode.removeChild(element)
      }
    }
    this.shadowRoots.clear()
    this.styleSheets.clear()
  }

  createShadowRoot(hostElement, options = {}) {
    if (!this.isShadowDOMAvailable()) {
      throw new Error('Shadow DOM not supported')
    }

    const mode = options.mode || 'closed'
    const shadowRoot = hostElement.attachShadow({ mode })

    this.shadowRoots.set(hostElement, shadowRoot)

    if (options.styles) {
      this.adoptStyles(shadowRoot, options.styles)
    }

    return shadowRoot
  }

  adoptStyles(shadowRoot, styles) {
    if (!shadowRoot) {
      throw new Error('Shadow root is required')
    }

    if (typeof styles === 'string') {
      const styleElement = document.createElement('style')
      styleElement.textContent = styles
      shadowRoot.appendChild(styleElement)
    } else if (styles instanceof CSSStyleSheet) {
      if (shadowRoot.adoptedStyleSheets) {
        shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, styles]
      } else {
        const styleElement = document.createElement('style')
        styleElement.textContent = styles.cssText
        shadowRoot.appendChild(styleElement)
      }
    } else if (Array.isArray(styles)) {
      styles.forEach(style => this.adoptStyles(shadowRoot, style))
    }
  }

  createElement(tagName, options = {}) {
    const element = document.createElement(tagName)

    if (options.className) {
      element.className = options.className
    }

    if (options.id) {
      element.id = options.id
    }

    if (options.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        element.setAttribute(key, value)
      }
    }

    if (options.styles) {
      Object.assign(element.style, options.styles)
    }

    if (options.content) {
      if (typeof options.content === 'string') {
        element.textContent = options.content
      } else {
        element.appendChild(options.content)
      }
    }

    if (options.events) {
      for (const [eventName, handler] of Object.entries(options.events)) {
        element.addEventListener(eventName, handler)
      }
    }

    return element
  }

  createTemplate(html) {
    const template = document.createElement('template')
    template.innerHTML = html
    return template
  }

  cloneTemplate(template) {
    return document.importNode(template.content, true)
  }

  inject(element, target = document.body, position = 'beforeend') {
    switch (position) {
      case 'beforebegin':
        target.parentNode.insertBefore(element, target)
        break
      case 'afterbegin':
        target.insertBefore(element, target.firstChild)
        break
      case 'beforeend':
        target.appendChild(element)
        break
      case 'afterend':
        target.parentNode.insertBefore(element, target.nextSibling)
        break
      default:
        target.appendChild(element)
    }
  }

  remove(element) {
    if (this.shadowRoots.has(element)) {
      this.shadowRoots.delete(element)
    }

    if (element.parentNode) {
      element.parentNode.removeChild(element)
    }
  }

  querySelector(selector, context = document) {
    return context.querySelector(selector)
  }

  querySelectorAll(selector, context = document) {
    return context.querySelectorAll(selector)
  }

  createStyleSheet(css) {
    if (typeof CSSStyleSheet !== 'undefined' && CSSStyleSheet.prototype.replaceSync) {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
      return sheet
    } else {
      return css
    }
  }

  observeChanges(element, callback, options = {}) {
    const observer = new MutationObserver(callback)
    const config = {
      attributes: options.attributes !== false,
      childList: options.childList !== false,
      subtree: options.subtree || false,
      attributeOldValue: options.attributeOldValue || false,
      characterData: options.characterData || false,
      characterDataOldValue: options.characterDataOldValue || false
    }

    observer.observe(element, config)

    return () => observer.disconnect()
  }

  measureElement(element) {
    const rect = element.getBoundingClientRect()
    const computed = window.getComputedStyle(element)

    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity
    }
  }

  animateElement(element, keyframes, options = {}) {
    if (!element.animate) {
      console.warn('Web Animations API not supported')
      return null
    }

    return element.animate(keyframes, {
      duration: options.duration || 300,
      easing: options.easing || 'ease',
      fill: options.fill || 'both',
      iterations: options.iterations || 1
    })
  }

  isShadowDOMAvailable() {
    return typeof document !== 'undefined' &&
           typeof Element !== 'undefined' &&
           Element.prototype.attachShadow
  }

  getCapabilities() {
    return {
      shadowDOM: this.isShadowDOMAvailable(),
      adoptedStyleSheets: typeof CSSStyleSheet !== 'undefined' &&
                          CSSStyleSheet.prototype.replaceSync,
      webAnimations: typeof Element !== 'undefined' &&
                     Element.prototype.animate,
      mutationObserver: typeof MutationObserver !== 'undefined'
    }
  }

  async test() {
    try {
      const testElement = this.createElement('div', {
        id: '__ui_test__',
        styles: { display: 'none' }
      })

      this.inject(testElement)

      if (this.isShadowDOMAvailable()) {
        const shadow = this.createShadowRoot(testElement)
        const content = this.createElement('span', {
          content: 'Shadow DOM Test'
        })
        shadow.appendChild(content)
      }

      this.remove(testElement)

      return {
        success: true,
        capabilities: this.getCapabilities()
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export { UIAdapter }