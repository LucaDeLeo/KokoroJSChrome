# Epic 1: Chrome Extension TTS Transformation (Plugin Architecture)

**Epic Goal**: Build a modular Chrome Extension using plugin architecture that WRAPS and PRESERVES the existing KokoroJS code while adding webpage integration capabilities through an event-driven pipeline.

**Integration Requirements**:
- PRESERVE all working code from the web app by wrapping in plugins
- Build clean plugin interfaces without modifying core TTS logic
- Maintain ability to test each plugin independently
- Use event-driven architecture with performance monitoring
- Measure first, optimize second based on real metrics

## Story Breakdown

### Story 1.1: Build Core Infrastructure and Platform Abstraction
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

### Story 1.2: Create KokoroEngine Plugin
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

### Story 1.3: Create OffscreenAudio Plugin
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

### Story 1.4: Wire Basic End-to-End Pipeline
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

### Story 1.5: Create ContentExtractor Plugin
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

### Story 1.6: Add UI and Control Plugins
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

### Story 1.7: Add Storage and Settings Plugins
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

### Story 1.8: Add Error Handling and Telemetry
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
