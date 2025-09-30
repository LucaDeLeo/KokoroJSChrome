/**
 * @module ReadabilityWrapper
 * @description Wraps Mozilla Readability.js for article extraction
 */

import { Readability } from '@mozilla/readability'

/**
 * @typedef {Object} ExtractedContent
 * @property {string} text - Extracted text content
 * @property {string} [title] - Article title
 * @property {string} [excerpt] - Article excerpt
 * @property {string} [byline] - Author info
 * @property {number} length - Text length in characters
 * @property {number} wordCount - Word count
 * @property {'advanced'} extractionMode - Extraction mode
 * @property {string} url - Source URL
 * @property {number} timestamp - Extraction time
 */

/**
 * @typedef {Object} ReadabilityResult
 * @property {string} title - Article title
 * @property {string} content - HTML content
 * @property {string} textContent - Plain text content
 * @property {string} excerpt - Article excerpt
 * @property {string} byline - Author info
 * @property {number} length - Content length
 * @property {string} siteName - Site name
 */

class ReadabilityWrapper {
  constructor() {
    this.fallbackReasons = {
      EXCEPTION: 'readability_failed',
      NULL_RESULT: 'readability_null',
      EMPTY_CONTENT: 'readability_empty',
      CSP_BLOCKED: 'csp_blocked'
    }
  }

  /**
   * Extract article content using Readability.js
   * @param {Document} doc - Document to extract from
   * @returns {ExtractedContent}
   * @throws {Error} If extraction fails
   */
  extract(doc) {
    try {
      // Clone document to avoid modifying the original
      const documentClone = doc.cloneNode(true)

      // Create Readability instance
      const reader = new Readability(documentClone, {
        debug: false,
        maxElemsToParse: 0, // No limit
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: []
      })

      // Parse article
      const article = reader.parse()

      // Check if parsing was successful
      if (!article) {
        throw new Error(this.fallbackReasons.NULL_RESULT)
      }

      // Extract plain text from HTML content
      const text = this._extractPlainText(article.textContent || article.content)

      // Validate text content
      if (!text || text.trim().length === 0) {
        throw new Error(this.fallbackReasons.EMPTY_CONTENT)
      }

      return {
        text: text.trim(),
        title: article.title || '',
        excerpt: article.excerpt || '',
        byline: article.byline || '',
        length: text.length,
        wordCount: this._countWords(text),
        extractionMode: 'advanced',
        url: doc.location?.href || '',
        timestamp: Date.now()
      }
    } catch (error) {
      // Check for CSP errors
      if (this._isCSPError(error)) {
        const cspError = new Error(this.fallbackReasons.CSP_BLOCKED)
        cspError.originalError = error
        throw cspError
      }

      // Re-throw with fallback reason
      console.error('Readability extraction failed:', error)
      throw error
    }
  }

  /**
   * Check if Readability.js is available
   * @returns {boolean}
   */
  isAvailable() {
    try {
      return typeof Readability !== 'undefined'
    } catch (error) {
      return false
    }
  }

  // Private methods

  /**
   * Extract plain text from HTML content
   * @param {string} htmlContent - HTML content
   * @returns {string}
   */
  _extractPlainText(htmlContent) {
    try {
      // Use DOMParser to safely parse HTML without script execution
      // This prevents XSS attacks from malicious content in extracted HTML
      const parser = new DOMParser()
      const tempDoc = parser.parseFromString(htmlContent, 'text/html')

      // Remove script and style elements
      const scripts = tempDoc.querySelectorAll('script, style')
      scripts.forEach(el => el.remove())

      // Get text content
      const text = tempDoc.body.textContent || tempDoc.body.innerText || ''

      return text.trim()
    } catch (error) {
      console.error('Error extracting plain text:', error)
      return htmlContent
    }
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number}
   */
  _countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Check if error is CSP-related
   * @param {Error} error - Error to check
   * @returns {boolean}
   */
  _isCSPError(error) {
    if (!error) return false

    const errorString = error.toString().toLowerCase()
    const cspKeywords = [
      'csp',
      'content security policy',
      'blocked by csp',
      'refused to execute',
      'refused to load'
    ]

    return cspKeywords.some(keyword => errorString.includes(keyword))
  }
}

export default ReadabilityWrapper