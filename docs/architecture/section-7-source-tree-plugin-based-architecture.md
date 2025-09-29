# Section 7: Source Tree (Plugin-Based Architecture)

## Existing Project Structure (Preserved Core Only)
```plaintext
KokoroJSChrome/                    # Current web app structure
├── kokoro.js                      # TTS engine (PRESERVE in plugin)
├── phonemize.js                   # Text processing (PRESERVE in plugin)
├── voices.js                      # Voice definitions (PRESERVE in plugin)
└── semantic-split.js              # Text chunking (PRESERVE in plugin)
```

## New Plugin-Based File Organization
```plaintext
KokoroJSChrome/
├── manifest.json                  # Extension manifest V3
├── package.json                   # Build dependencies
├── plugin-manifest.json           # Plugin registry
├── webpack.config.js              # Build configuration
├── .gitignore                     # Ignore built files, models
│
├── core/                          # Minimal core (right-sized for robustness)
│   ├── tts-core.js               # Main orchestrator
│   ├── event-bus.js              # Event system with error handling
│   ├── pipeline.js               # Pipeline manager
│   ├── plugin-loader.js          # Plugin loading and lifecycle
│   └── performance-monitor.js    # Metrics collection
│
├── platform/                      # Platform Abstraction Layer
│   ├── pal.js                    # Main PAL interface
│   ├── storage-adapter.js        # Chrome storage wrapper
│   ├── messaging-adapter.js      # Chrome messaging wrapper
│   ├── audio-adapter.js          # Offscreen API wrapper
│   ├── ui-adapter.js             # Shadow DOM wrapper
│   └── manifest-adapter.js       # Manifest version adapter
│
├── plugins/                       # All features as plugins
│   ├── content-extractor/        # [Owner: Dev1]
│   │   ├── package.json          # Plugin metadata
│   │   ├── index.js              # Plugin entry
│   │   ├── api.d.ts              # TypeScript definitions
│   │   ├── README.md             # Plugin documentation
│   │   ├── src/
│   │   │   ├── extractor.js      # Main logic
│   │   │   ├── readability-wrapper.js
│   │   │   └── selection-handler.js
│   │   ├── test/
│   │   └── lib/
│   │       └── readability.min.js
│   │
│   ├── kokoro-engine/            # [Owner: Dev2]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── engine.js         # Plugin wrapper
│   │   │   ├── kokoro.js         # PRESERVED from original
│   │   │   ├── phonemize.js      # PRESERVED from original
│   │   │   ├── voices.js         # PRESERVED from original
│   │   │   └── semantic-split.js # PRESERVED from original
│   │   └── test/
│   │
│   ├── offscreen-audio/          # [Owner: Dev3]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── audio-manager.js
│   │   │   ├── offscreen.html
│   │   │   └── stream-handler.js
│   │   └── test/
│   │
│   ├── ui-renderer/              # [Owner: Dev4]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── renderer.js
│   │   │   ├── components/
│   │   │   └── themes/
│   │   └── test/
│   │
│   ├── queue-manager/            # [Owner: Dev5]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── queue.js
│   │   │   ├── priority-queue.js
│   │   │   └── rate-limiter.js
│   │   └── test/
│   │
│   ├── storage-provider/         # [Owner: Dev6]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── storage.js
│   │   │   ├── indexeddb-wrapper.js
│   │   │   └── cache-manager.js
│   │   └── test/
│   │
│   ├── error-handler/            # [Owner: Dev7]
│   │   ├── package.json
│   │   ├── index.js
│   │   ├── api.d.ts
│   │   ├── src/
│   │   │   ├── handler.js
│   │   │   ├── recovery.js
│   │   │   └── circuit-breaker.js
│   │   └── test/
│   │
│   └── telemetry/                # [Owner: Dev8]
│       ├── package.json
│       ├── index.js
│       ├── api.d.ts
│       ├── src/
│       │   ├── telemetry.js
│       │   └── metrics.js
│       └── test/
│
├── tools/                         # Development tools
│   ├── event-recorder/           # Record/replay events
│   │   ├── recorder.js
│   │   └── player.js
│   ├── event-simulator/          # Inject test events
│   │   └── simulator.js
│   ├── pipeline-visualizer/      # Visual debugger
│   │   ├── visualizer.html
│   │   └── visualizer.js
│   ├── performance-profiler/     # Performance analysis
│   │   └── profiler.js
│   └── debug-logger/             # Structured logging
│       └── logger.js
│
├── entry-points/                  # Chrome extension entry points
│   ├── content.js                # Content script loader
│   ├── background.js             # Service worker loader
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   └── options/
│       ├── options.html
│       └── options.js
│
├── dist/                          # Built extension (git-ignored)
│   └── [bundled files]
│
├── models/                        # Model files (git-ignored)
│   └── kokoro-82M.onnx
│
├── test/                          # Integration tests
│   ├── core/                      # Core tests
│   ├── platform/                  # PAL tests
│   ├── integration/               # Cross-plugin tests
│   └── e2e/                       # End-to-end tests
│
├── docs/
│   ├── architecture.md           # This document
│   ├── plugin-development.md     # Plugin dev guide
│   ├── api-reference.md          # API documentation
│   └── plugins/                   # Per-plugin docs
│       └── [plugin-name].md
│
└── scripts/
    ├── create-plugin.js           # Scaffold new plugin
    ├── build-plugin.js            # Build individual plugin
    ├── test-plugin.js             # Test individual plugin
    └── package-extension.js       # Bundle for Chrome Web Store
```

## Integration Guidelines

- **File Naming:** Use kebab-case for all files (existing pattern)
- **Folder Organization:** Context-based separation (content/background/offscreen)
- **Import/Export Patterns:** ES6 modules with explicit exports
