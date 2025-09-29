# KokoroJS Chrome Extension - Brownfield Enhancement PRD

## Section 1: Intro Project Analysis and Context

### 1.1 Existing Project Overview

#### Analysis Source
- IDE-based fresh analysis
- Project Brief available at: docs/brief.md

#### Current Project State
KokoroJS is currently a standalone web application that provides high-quality text-to-speech functionality using the Kokoro-82M ONNX model. The project runs entirely client-side with no external API dependencies after initial model download, implementing privacy-first TTS with multiple natural voices and semantic text splitting capabilities.

### 1.2 Available Documentation Analysis

#### Available Documentation
✓ Project Brief (comprehensive)
✗ Tech Stack Documentation
✗ Source Tree/Architecture
✗ Coding Standards
✗ API Documentation
✗ External API Documentation
✗ UX/UI Guidelines
✗ Technical Debt Documentation

**Recommendation:** While the project brief is comprehensive, technical documentation is lacking. However, the codebase appears straightforward enough to proceed with the enhancement planning.

### 1.3 Enhancement Scope Definition

#### Enhancement Type
Based on the project brief's "Next Steps" section, this appears to be:
✓ **New Feature Addition** - Converting standalone web app to Chrome Extension
✓ **Integration with New Systems** - Chrome Extension APIs
✓ **Technology Stack Upgrade** - Manifest V3 architecture

#### Enhancement Description
Convert the existing KokoroJS web application into a fully-functional Chrome Extension that provides text-to-speech functionality for any selected text on any webpage, maintaining the privacy-first approach with complete offline operation after initial setup.

#### Impact Assessment
✓ **Major Impact (architectural changes required)** - The conversion from web app to extension requires fundamental restructuring including:
- Service Worker implementation for background processing
- Content Scripts for webpage interaction
- Offscreen API for audio handling
- Extension manifest configuration
- New UI patterns for extension interaction

### 1.4 Goals and Background Context

#### Goals
- Enable TTS functionality on any webpage through text selection
- Maintain 100% offline operation after model download
- Provide seamless integration via floating buttons and context menus
- Support 10,000+ active users within 6 months
- Achieve <3 second time-to-first-audio for average text selections
- Enable automatic reading of main page content without text selection

#### Background Context
This enhancement transforms KokoroJS from a standalone web application into a browser extension, addressing the fragmentation problem where users must copy-paste text into separate applications. The extension will leverage Chrome's Offscreen API for proper audio handling and IndexedDB for model storage, bringing studio-quality TTS directly to users' browsing experience while maintaining complete privacy.

### Change Log
| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial PRD | 2025-09-28 | 1.0 | Created Brownfield PRD for Chrome Extension conversion | John (PM) |
| Plugin Architecture Alignment | 2025-09-29 | 2.0 | Updated stories to follow modular plugin architecture from architecture.md | Winston (Architect) |

## Section 2: Requirements

### Functional Requirements

- **FR1:** The extension shall detect text selection on any webpage and display a floating TTS button within 200ms of selection
- **FR2:** The extension shall provide a toolbar button/action to automatically detect and read the main content of the current page without requiring text selection
- **FR3:** The extension shall use content extraction algorithms to identify and extract the main article/content area, filtering out navigation, ads, and sidebars
- **FR4:** The extension shall support playback controls including play, pause, stop, and skip functionality accessible via both UI and keyboard shortcuts
- **FR5:** The extension shall offer at least 3 distinct Kokoro voice options selectable through the extension settings
- **FR6:** The extension shall provide variable speed control from 0.5x to 3.0x in 0.25x increments
- **FR7:** The extension shall integrate with Chrome's context menu to provide "Speak selected text" and "Read entire page" options
- **FR8:** The extension shall automatically download and store the Kokoro-82M model (≈300MB) in IndexedDB on first use
- **FR9:** The extension shall maintain full offline functionality after initial model download with no external API calls
- **FR10:** The extension shall use semantic text splitting to process both selections and full articles into natural chunks
- **FR11:** The extension shall handle text selection across multiple DOM elements and preserve reading order
- **FR12:** The extension shall remember user's voice, speed preferences, and auto-detection preferences across sessions
- **FR13:** The extension shall provide visual indication of reading progress when reading full pages (e.g., progress bar or highlight)

### Non-Functional Requirements

- **NFR1:** Audio playback shall begin within 3 seconds of user activation for text selections under 1000 characters
- **NFR2:** Main content extraction shall complete within 1 second for standard web pages
- **NFR3:** The extension shall consume less than 500MB of RAM during active TTS synthesis
- **NFR4:** The extension shall support Chrome 109+ and Edge 109+ browsers
- **NFR5:** Model download shall complete within 5 minutes on a 10 Mbps connection with progress indication
- **NFR6:** The extension shall maintain voice quality equivalent to the current web application (no degradation)
- **NFR7:** The extension shall handle full articles up to 100,000 characters without crashing
- **NFR8:** All user text selections and extracted content shall remain on-device with zero network transmission after model download
- **NFR9:** The extension shall gracefully degrade on systems without WebGPU support by falling back to WebAssembly
- **NFR10:** Content extraction accuracy shall exceed 90% for standard article formats (blogs, news sites, documentation)

### Compatibility Requirements

- **CR1: Existing TTS Engine Compatibility:** The Kokoro.js TTS engine and phonemizer must function identically to the current web implementation
- **CR2: Audio Processing Compatibility:** AudioPlayer.js and streaming audio functionality must maintain current quality and performance characteristics
- **CR3: Voice Model Compatibility:** All 6 existing Kokoro voices must remain available with identical voice characteristics
- **CR4: Text Processing Compatibility:** Semantic-split.js chunking algorithm must produce identical output for same input text
- **CR5: Reader Mode Compatibility:** Extension shall work on pages already in Chrome's Reader Mode as well as standard web pages

## Section 3: Technical Constraints and Integration Requirements

### Existing Technology Stack & Migration Reality

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

### Integration Approach

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

### Code Organization and Existing Code Adaptation

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

### Deployment and Operations

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

### Risk Assessment and Mitigation

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

## Section 4: Epic and Story Structure

### Epic Approach

**Epic Structure Decision**: Single comprehensive epic for the Chrome Extension conversion. This is one cohesive feature transformation, not multiple unrelated enhancements. Breaking it into multiple epics would create unnecessary dependencies and complexity.

## Epic 1: Chrome Extension TTS Transformation (Plugin Architecture)

**Epic Goal**: Build a modular Chrome Extension using plugin architecture that WRAPS and PRESERVES the existing KokoroJS code while adding webpage integration capabilities through an event-driven pipeline.

**Integration Requirements**:
- PRESERVE all working code from the web app by wrapping in plugins
- Build clean plugin interfaces without modifying core TTS logic
- Maintain ability to test each plugin independently
- Use event-driven architecture with performance monitoring
- Measure first, optimize second based on real metrics

### Story Breakdown

#### Story 1.1: Build Core Infrastructure and Platform Abstraction
As a developer,
I want to create the minimal event-driven core and Platform Abstraction Layer,
so that plugins can be built on a stable foundation.

**Acceptance Criteria:**
1. Implement TTSCore with event bus and pipeline manager (right-sized, not constrained)
2. Create Platform Abstraction Layer for Chrome APIs, Web APIs, and external libraries
3. Add performance monitoring to track pipeline stage latencies
4. Implement TTSEvent structure with clear request/response separation
5. Create plugin loader with lifecycle management

**Integration Verification:**
- IV1: Core can load and initialize test plugins
- IV2: Performance metrics collected for all operations
- IV3: PAL successfully abstracts Chrome storage, messaging, and offscreen APIs
- IV4: Event flow can be traced through pipeline

---

#### Story 1.2: Create KokoroEngine Plugin
As a developer,
I want to wrap the existing kokoro.js, phonemize.js, and voices.js in a plugin,
so that TTS synthesis works through the event pipeline WITHOUT modifying the working code.

**Acceptance Criteria:**
1. Create KokoroEngine plugin that wraps existing TTS files
2. Preserve kokoro.js, phonemize.js, voices.js, semantic-split.js exactly as-is
3. Implement plugin interface: init(), process(), synthesize()
4. Bundle transformers.js and dependencies locally (no CDN)
5. Plugin responds to TTSEvent and produces audio output

**Integration Verification:**
- IV1: Original TTS code unchanged and working
- IV2: Plugin processes events through pipeline successfully
- IV3: Performance metrics show synthesis latency
- IV4: Voice quality identical to original web app

---

#### Story 1.3: Create OffscreenAudio Plugin
As a developer,
I want to implement audio playback through Chrome's Offscreen API as a plugin,
so that TTS audio works in background without keeping popup open.

**Acceptance Criteria:**
1. Create OffscreenAudio plugin with offscreen document management
2. Wrap existing AudioPlayer.js functionality in plugin interface
3. Implement "stop previous audio" behavior (no complex queuing)
4. Handle singleton Offscreen document limitation gracefully
5. Monitor memory usage and recycle after 20 sessions or 500MB

**Integration Verification:**
- IV1: Audio plays through offscreen document
- IV2: Previous audio stops when new request arrives
- IV3: Memory stays under 500MB threshold
- IV4: Performance metrics track audio latency

---

#### Story 1.4: Wire Basic End-to-End Pipeline
As a developer,
I want to connect Core, KokoroEngine, and OffscreenAudio plugins,
so that basic TTS works through the event pipeline from popup UI.

**Acceptance Criteria:**
1. Create simple popup.html with text input and play button
2. Wire popup → Core → KokoroEngine → OffscreenAudio pipeline
3. Implement model loading from IndexedDB (300MB storage)
4. Add model download with progress (reuse updateProgress.js)
5. Test complete flow: type text → synthesize → hear audio

**Integration Verification:**
- IV1: Event flows through all pipeline stages
- IV2: Performance metrics show <100ms end-to-end for short text
- IV3: Model persists in IndexedDB across sessions
- IV4: All 6 Kokoro voices available and working

---

#### Story 1.5: Create ContentExtractor Plugin
As a developer,
I want to implement text extraction from web pages as a plugin,
so that users can select text or read entire articles.

**Acceptance Criteria:**
1. Create ContentExtractor plugin with simple and advanced modes
2. Simple mode: Extract <p> tags from <main>/<article> elements
3. Advanced mode: Integrate Readability.js (wrapped in PAL)
4. Handle text selection detection with Shadow DOM UI
5. Test extraction on: Wikipedia, Medium, CNN, BBC News, MDN Docs

**Integration Verification:**
- IV1: Text selection triggers TTSEvent creation
- IV2: Extraction completes in <500ms for standard pages
- IV3: Performance metrics track extraction latency
- IV4: Floating button appears within 200ms of selection

---

#### Story 1.6: Add UI and Control Plugins
As a developer,
I want to create UIRenderer and QueueManager plugins,
so that users have full control over TTS playback.

**Acceptance Criteria:**
1. Create UIRenderer plugin for Shadow DOM components
2. Implement floating button, progress bar, control panel
3. Create QueueManager plugin with "stop previous" behavior
4. Add context menu integration ("Speak selection", "Read page")
5. Reuse existing ButtonHandler.js and updateProgress.js logic

**Integration Verification:**
- IV1: UI components isolated via Shadow DOM
- IV2: Context menu triggers same event pipeline
- IV3: Queue manager prevents concurrent audio
- IV4: Progress updates flow through event bus

---

#### Story 1.7: Add Storage and Settings Plugins
As a developer,
I want to implement StorageProvider plugin for preferences and caching,
so that user settings persist and performance improves.

**Acceptance Criteria:**
1. Create StorageProvider plugin wrapping chrome.storage APIs
2. Save voice selection, speed preferences to chrome.storage.sync
3. Cache recent synthesized audio in chrome.storage.local
4. Add keyboard shortcuts (Alt+S selection, Alt+R read page)
5. Implement model persistence check (warn if evicted)

**Integration Verification:**
- IV1: Settings persist across sessions via plugin
- IV2: Cached audio retrieved in <10ms
- IV3: Storage operations tracked in performance metrics
- IV4: Model eviction detected and user notified

---

#### Story 1.8: Add Error Handling and Telemetry
As a developer,
I want to implement ErrorHandler and Telemetry plugins,
so that failures are graceful and usage is measurable.

**Acceptance Criteria:**
1. Create ErrorHandler plugin with recovery strategies
2. Handle CSP sites (GitHub, banks) with clear messaging
3. Implement circuit breaker for failing components
4. Create Telemetry plugin for anonymous usage metrics
5. Add integration tests for edge cases (paywalls, infinite scroll)

**Integration Verification:**
- IV1: Errors don't crash extension on any site
- IV2: Circuit breaker prevents cascade failures
- IV3: Telemetry respects privacy (no text content logged)
- IV4: Performance stays optimal based on metrics

---

## Summary

This PRD outlines the transformation of KokoroJS from a standalone web application to a Chrome Extension using a **modular plugin architecture**. The approach emphasizes:

1. **Plugin-based development** - Each feature is an isolated, testable plugin
2. **Code preservation through wrapping** - Existing TTS code wrapped in plugins, not modified
3. **Event-driven pipeline** - All communication through monitored event bus
4. **Performance measurement** - "Measure first, optimize second" with built-in metrics
5. **Platform abstraction** - All external dependencies behind PAL for future-proofing

The story sequence follows the architecture's modular approach:
- **Foundation (Stories 1.1-1.3)**: Core → PAL → Essential Plugins
- **Integration (Story 1.4)**: Wire end-to-end pipeline
- **Enhancement (Stories 1.5-1.8)**: Add feature plugins incrementally

Key technical decisions maintained from original analysis:
- Use Offscreen API for uninterrupted audio (singleton limitation accepted)
- Simple "stop previous audio" instead of complex queuing
- Accept 500MB memory limitation, monitor with performance metrics
- Start with simple DOM extraction, add Readability.js if needed
- Handle CORS issues through PAL's model loading adapter

Key architectural advantages:
- Each plugin can be developed/tested independently (3-day sprints)
- Performance bottlenecks identifiable through metrics
- Platform changes only affect PAL, not plugins
- Integration tests verify event flow through pipeline

This pragmatic approach balances clean architecture with technical reality, preserving all working code while building a maintainable, measurable system.