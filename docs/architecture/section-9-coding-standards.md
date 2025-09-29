# Section 9: Coding Standards

## Existing Standards Compliance
**Code Style:** ES6+ JavaScript, no semicolons (existing pattern), 2-space indentation
**Linting Rules:** ESLint with Chrome extension specific rules
**Testing Patterns:** Jest for unit tests, Puppeteer for E2E
**Documentation Style:** JSDoc comments for public APIs

## Enhancement-Specific Standards

- **Chrome Extension Context Isolation:** Never pass functions across context boundaries, only serializable data
- **Memory Management:** Explicit cleanup in all components, especially Offscreen
- **Message Contract Enforcement:** TypeScript-style JSDoc for all message interfaces
- **Shadow DOM Encapsulation:** All injected UI must use Shadow DOM with adopted stylesheets

## Critical Integration Rules

- **Existing API Compatibility:** Core TTS functions (kokoro.js) signatures unchanged
- **Database Integration:** All IndexedDB operations wrapped in try-catch with fallback
- **Error Handling:** Every chrome API call must handle both success and rejection
- **Logging Consistency:** Unified logging through shared logger with context prefix

## Code Organization Standards

```javascript
/**
 * File Structure Template
 * Each module follows this structure
 */

// 1. JSDoc module description
/**
 * @module ContentController
 * @description Manages in-page TTS interactions and UI
 */

// 2. Imports (grouped and ordered)
// External dependencies
import { Readability } from '@mozilla/readability'

// Internal dependencies - absolute paths from src/
import { MESSAGE_TYPES } from '/shared/message-types.js'
import { Logger } from '/shared/logger.js'

// 3. Constants
const SELECTION_DELAY = 500
const MAX_TEXT_LENGTH = 100000

// 4. Class/Function definitions
class ContentController {
  constructor() {
    this.logger = new Logger('ContentController')
    this.cleanup = this.cleanup.bind(this)
  }

  // Public methods first
  async init() {
    try {
      await this.attachListeners()
    } catch (error) {
      this.logger.error('Init failed', error)
      throw error
    }
  }

  // Private methods prefixed with underscore
  _handleSelection(event) {
    // Implementation
  }

  // Cleanup method required
  cleanup() {
    this.removeListeners()
    this.logger.debug('Cleaned up')
  }
}

// 5. Exports at bottom
export { ContentController }
```
