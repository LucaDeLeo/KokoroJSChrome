# Section 3: Tech Stack (Risk-Aware)

## Existing Technology Stack

| Category | Current Technology | Version | Usage in Enhancement | Notes |
|----------|-------------------|---------|---------------------|--------|
| TTS Engine | Kokoro.js | 82M | Core synthesis - unchanged | Keep as-is |
| Text Processing | Phonemizer.js | Current | Phonemization - unchanged | Keep as-is |
| ML Runtime | Transformers.js | 3.x | ONNX runtime core only | Reduced bundle |
| Audio Processing | Web Audio API | Native | Complete rewrite for Offscreen | Managed lifecycle |
| Storage | localStorage | Native | Migrate to IndexedDB + chrome.storage | Split by purpose |
| UI Framework | Vanilla JS | ES6+ | Keep vanilla approach | No framework needed |
| Service Worker | Cache API | Native | Extension coordinator role | Different purpose |

## New Technology Additions (Risk-Mitigated)

| Technology | Version | Purpose | Rationale | Integration Method |
|------------|---------|---------|-----------|-------------------|
| Chrome Extension APIs | Manifest V3 | Platform integration | Required for extension | Core platform |
| Shadow DOM | Native | UI isolation | Prevent CSS conflicts | Content script UI |
| IndexedDB | Native | Model storage + text transport | 300MB model + large text handling | Persistent storage |
| chrome.storage.sync | Native | User preferences only | Cross-device sync (10KB limit) | Settings only |
| chrome.storage.local | Native | Session data cache | Recent texts, tab states (10MB) | Runtime cache |
| Readability.js | Mozilla 0.4.4 | Content extraction | Proven, reliable extraction | Bundled (80KB) |
| Offscreen API | Chrome 109+ | Managed audio processing | Bypass service worker limits | Lifecycle controlled |
| Webpack | 5.x | Build system with splitting | Code splitting, tree-shaking | Build time only |

## Risk-Driven Technology Decisions

| Risk Addressed | Technology Choice | Alternative Rejected | Reason |
|----------------|------------------|---------------------|---------|
| Bundle size rejection | Separate model loading | Bundle everything | Keeps extension <10MB |
| Memory leaks | Offscreen lifecycle management | Permanent Offscreen | Prevents gradual memory growth |
| Reader Mode doesn't exist | Readability.js | Chrome Reader API | API is mythical |
| Message size limits | IndexedDB for large texts | Direct messaging only | Handles book-length content |
| Cross-browser issues | Chrome 109+ requirement | Universal compatibility | Clear boundaries |
| Model eviction | Persistent storage API | Hope for the best | User controls persistence |
| Development complexity | Separate dev/prod configs | Single config | CSP compliance |
