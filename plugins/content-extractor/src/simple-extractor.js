/**
 * @module SimpleExtractor
 * @description Simple content extraction using semantic HTML selectors
 */

/**
 * @typedef {Object} ExtractedContent
 * @property {string} text - Extracted text content
 * @property {number} length - Text length in characters
 * @property {number} wordCount - Word count
 * @property {'simple'} extractionMode - Extraction mode
 * @property {string} url - Source URL
 * @property {number} timestamp - Extraction time
 */

class SimpleExtractor {
  constructor() {
    // Selectors for main content areas
    this.mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#main',
      '#content',
      '.main-content',
      '.article-content',
      '.post-content'
    ]

    // Selectors to exclude (navigation, ads, etc.)
    this.excludeSelectors = [
      'nav',
      'header',
      'footer',
      'aside',
      '.nav',
      '.navigation',
      '.menu',
      '.sidebar',
      '.ad',
      '.advertisement',
      '.promo',
      '.comments',
      '.related',
      '.share',
      '[role="navigation"]',
      '[role="complementary"]',
      '[role="banner"]',
      '[role="contentinfo"]'
    ]
  }

  /**
   * Extract text from main/article elements
   * @param {Document} doc - Document to extract from
   * @returns {ExtractedContent}
   */
  extract(doc) {
    try {
      // Find main content element
      const mainElement = this._findMainElement(doc)

      if (!mainElement) {
        throw new Error('No main/article element found')
      }

      // Extract paragraphs from main element
      const paragraphs = this._extractParagraphs(mainElement)

      if (paragraphs.length === 0) {
        throw new Error('No content found in main/article element')
      }

      // Combine paragraphs
      const text = paragraphs.join('\n\n')

      return {
        text,
        length: text.length,
        wordCount: this._countWords(text),
        extractionMode: 'simple',
        url: doc.location?.href || '',
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Simple extraction error:', error)
      throw error
    }
  }

  /**
   * Extract all text from document (full mode)
   * @param {Document} doc - Document to extract from
   * @returns {ExtractedContent}
   */
  extractAll(doc) {
    try {
      // Get all paragraphs from the entire document
      const allParagraphs = Array.from(doc.querySelectorAll('p'))
        .filter(p => !this._shouldExclude(p))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 0)

      if (allParagraphs.length === 0) {
        throw new Error('No content found in document')
      }

      const text = allParagraphs.join('\n\n')

      return {
        text,
        length: text.length,
        wordCount: this._countWords(text),
        extractionMode: 'simple',
        url: doc.location?.href || '',
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Full extraction error:', error)
      throw error
    }
  }

  /**
   * Extract text from custom selector
   * @param {Document} doc - Document to extract from
   * @param {string} selector - CSS selector
   * @param {Array} [filters] - Additional filters
   * @returns {ExtractedContent}
   */
  extractCustom(doc, selector, filters = []) {
    try {
      if (!selector) {
        throw new Error('Selector is required for custom extraction')
      }

      const element = doc.querySelector(selector)

      if (!element) {
        throw new Error(`Element not found for selector: ${selector}`)
      }

      // Extract paragraphs from custom element
      const paragraphs = this._extractParagraphs(element, filters)

      if (paragraphs.length === 0) {
        throw new Error('No content found in custom element')
      }

      const text = paragraphs.join('\n\n')

      return {
        text,
        length: text.length,
        wordCount: this._countWords(text),
        extractionMode: 'simple',
        url: doc.location?.href || '',
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Custom extraction error:', error)
      throw error
    }
  }

  // Private methods

  /**
   * Find main content element
   * @param {Document} doc - Document to search
   * @returns {Element|null}
   */
  _findMainElement(doc) {
    for (const selector of this.mainSelectors) {
      const element = doc.querySelector(selector)
      if (element) {
        return element
      }
    }
    return null
  }

  /**
   * Extract paragraphs from element
   * @param {Element} element - Element to extract from
   * @param {Array} [additionalFilters] - Additional filters
   * @returns {string[]}
   */
  _extractParagraphs(element, additionalFilters = []) {
    const paragraphs = Array.from(element.querySelectorAll('p'))
      .filter(p => !this._shouldExclude(p, additionalFilters))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 0)

    return paragraphs
  }

  /**
   * Check if element should be excluded
   * @param {Element} element - Element to check
   * @param {Array} [additionalFilters] - Additional filters
   * @returns {boolean}
   */
  _shouldExclude(element, additionalFilters = []) {
    // Check if element or any ancestor matches exclude selectors
    for (const selector of this.excludeSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return true
      }
    }

    // Check additional filters
    for (const filter of additionalFilters) {
      if (filter.type === 'exclude' && element.matches(filter.selector)) {
        return true
      }
    }

    return false
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number}
   */
  _countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }
}

export default SimpleExtractor