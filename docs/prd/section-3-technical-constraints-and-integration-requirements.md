# Section 3: Technical Constraints and Integration Requirements

## Existing Technology Stack & Migration Reality

**Current Implementation**:
- Standalone web app with index.html entry point
- Service Worker (service-worker.js) for CDN resource caching
- Web Worker (worker.js) for TTS processing
- Direct DOM manipulation via main.js
- Hugging Face Transformers.js loaded from CDN

**Critical Migration Challenges**:
- **Manifest V3 Constraint**: ALL code must be bundled - no CDN loading allowed
- **Service Worker Limitation**: 30-second execution limit before termination
- **Worker.js Adaptation**: Must migrate from Web Worker to Offscreen Document
- **CDN Dependencies**: Must bundle transformers.min.js and phonemizer.min.js (increases extension size)

## Integration Approach

**Storage Reality Check**:
- IndexedDB: 300MB model storage (may hit quota on devices with <10GB free)
- chrome.storage.local: 10MB limit - sufficient for settings and recent selections
- chrome.storage.sync: 100KB limit - voice preference only, no content caching
- **Risk**: Browser may evict IndexedDB data under storage pressure

**Chrome Extension API Integration**:
- Required permissions: "activeTab", "contextMenus", "storage", "offscreen"
- **Cannot use**: "tabs" (privacy concern), "webNavigation" (not needed)
- Content scripts injected via manifest, not programmatically (CSP compliance)
- Message passing required between content script and service worker

**Architecture Transformation**:
```
Current:                          Target:
index.html → main.js              Content Script → Shadow DOM UI
worker.js → TTS processing        Offscreen Document → TTS processing
service-worker.js → caching       Service Worker → Extension lifecycle
Direct audio playback             Offscreen → Audio element
```

## Code Organization and Existing Code Adaptation

**Modular Extraction Required**:
- `kokoro.js` - Can be used as-is in offscreen document
- `phonemize.js` - Must be bundled, no CDN loading
- `semantic-split.js` - Adapt for content script context
- `AudioPlayer.js` - Major refactoring for offscreen audio
- `worker.js` - Complete rewrite as offscreen document handler
- `updateProgress.js` - Split between content script (UI) and offscreen (processing)

**New Components Needed**:
- `content-script.js` - Text selection, UI injection, message relay
- `offscreen.js` - Audio processing host, TTS engine wrapper
- `background.js` - Service worker for extension lifecycle, model management
- `readability-wrapper.js` - Content extraction with fallback strategies

## Deployment and Operations

**Build Process**:
- Webpack with multiple entry points (content, background, offscreen, popup)
- Bundle size concern: ~5MB JavaScript after bundling dependencies
- Dead code elimination critical to stay under Chrome Web Store limits

**Distribution Reality**:
- Chrome Web Store has no phased rollout for new extensions
- Initial launch is all-or-nothing
- Updates can be delayed 24-48 hours for propagation
- No control over when users receive updates

**Debugging Challenges**:
- Service worker DevTools disconnect after 30 seconds
- Content script errors only visible in page console
- Offscreen document has no direct DevTools access
- Must implement custom logging bridge between contexts

## Risk Assessment and Mitigation

**Critical Project-Killing Risks**:

1. **Model Hosting & CORS Crisis**
   - **Risk**: Hugging Face CDN doesn't serve CORS headers for extension origin
   - **Mitigation**: Platform Abstraction Layer (PAL) handles this with ModelLoader adapter that can switch between local file, proxy, or CDN based on environment

2. **Offscreen API Singleton Behavior**
   - **Risk**: Only ONE Offscreen document exists for ALL tabs
   - **Mitigation**: Simple solution - new TTS request stops previous playback (no queue needed)

3. **Memory Limit Extension Termination**
   - **Risk**: 300MB model + JS overhead = 600MB+ RAM usage
   - **Impact**: Chrome kills extension on 4GB RAM devices
   - **Mitigation**: Accept limitation, document minimum requirements

**Manifest V3 Hard Constraints**:
- **Risk**: Service worker terminates mid-synthesis
- **Mitigation**: ALL synthesis in offscreen document, service worker only coordinates

**Content Security Policy Blockers**:
- **Risk**: Many sites block inline styles/scripts via CSP
- **Mitigation**: Shadow DOM with adopted stylesheets, no inline event handlers

**Performance Edge Cases**:
- **Risk**: User selects entire page (Ctrl+A) with 500KB of text
- **Mitigation**: Implement hard limits with clear user messaging
