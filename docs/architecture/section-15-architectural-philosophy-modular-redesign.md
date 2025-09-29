# Section 1.5: Architectural Philosophy & Modular Redesign

## Core Philosophy: Primitives vs Structure

Following the modular architecture philosophy, this system has been redesigned around clear separation of concerns, plugin-based extensibility, and future-proof abstractions.

### The Primitive: TTS Request/Response Events

**What We're Really Manipulating:** TTS operations as discrete events flowing through a processing pipeline, maintaining clear separation between request data and processing state.

```javascript
// Simplified, concrete primitive
class TTSEvent {
  constructor() {
    this.id = uuid();           // Unique event identifier
    this.timestamp = Date.now(); // Event creation time

    // Clear input/output separation
    this.request = {
      text: string,             // The actual text to synthesize
      source: 'selection|page|manual',
      voiceId: string,          // Selected voice
      speed: number,            // Playback rate
      options: object           // Additional settings
    };

    this.response = {
      audio: ArrayBuffer,       // Generated audio
      duration: number,         // Audio duration
      chunks: Array,            // For streaming
      cached: boolean           // Whether from cache
    };

    this.metadata = {
      tabId: number,            // Chrome tab ID
      url: string,              // Source page
      timing: {                 // Performance metrics
        queued: number,
        started: number,
        completed: number
      }
    };

    this.state = {
      phase: 'pending|queued|processing|complete|error',
      progress: number,         // 0-100
      error: Error | null
    };
  }
}
```

### The Structure: Pipeline Architecture

The system is organized as a **pipeline of pluggable stages**, each operating on the synthesis event stream:

```
Input → Extraction → Queue → Synthesis → Playback → Output
  ↓         ↓          ↓         ↓           ↓          ↓
Plugin   Plugin     Plugin    Plugin      Plugin     Plugin
```

## Modular Design Principles

### 1. Minimal Core, Maximum Plugins

The core contains only essential orchestration logic - **Event Bus** and **Pipeline Manager**. Everything else is a plugin. Core size should be "right-sized" for robustness, not artificially constrained.

```javascript
// Core focuses on orchestration, not line count
class TTSCore {
  constructor() {
    this.eventBus = new EventBus();
    this.pipeline = new Pipeline();
    this.plugins = new Map();
    this.metrics = new PerformanceMetrics(); // Monitor real performance
  }

  registerPlugin(plugin) {
    plugin.init(this.eventBus);
    this.plugins.set(plugin.id, plugin);
    this.instrumentPlugin(plugin); // Add performance monitoring
  }

  async process(event) {
    const start = performance.now();
    const result = await this.pipeline.execute(event);
    this.metrics.record(event.id, performance.now() - start);
    return result;
  }

  // Add robustness features as needed
  handleError(error, context) { /* ... */ }
  retry(event, attempts) { /* ... */ }
  healthCheck() { /* ... */ }
}
```

### 2. Plugin Architecture

Each feature is a self-contained plugin with a stable API:

| Plugin | Responsibility | Owner | API Version |
|--------|---------------|-------|------------|
| ContentExtractor | Extract text from pages | Dev 1 | 1.0 |
| UIRenderer | Render UI components | Dev 2 | 1.0 |
| KokoroEngine | Kokoro TTS synthesis | Dev 3 | 1.0 |
| OffscreenAudio | Audio playback management | Dev 4 | 1.0 |
| StorageProvider | Manage all storage | Dev 5 | 1.0 |
| QueueManager | Request prioritization | Dev 6 | 1.0 |
| ErrorHandler | Error recovery & reporting | Dev 7 | 1.0 |
| Telemetry | Analytics & monitoring | Dev 8 | 1.0 |

### 3. Comprehensive Platform Abstraction Layer (PAL)

**Risk Mitigation:** ALL external dependencies are wrapped, not just Chrome APIs. This includes browser APIs, runtime environments, and third-party libraries:

```javascript
// Comprehensive PAL - abstracts ALL external dependencies
class PlatformAbstractionLayer {
  constructor() {
    // Chrome Extension APIs
    this.chrome = new ChromeAdapter();

    // Browser APIs
    this.audio = new WebAudioAdapter();
    this.storage = new StorageAdapter(); // IndexedDB, localStorage, chrome.storage
    this.dom = new DOMAdapter(); // Shadow DOM, Custom Elements

    // Runtime dependencies
    this.ml = new MLRuntimeAdapter(); // ONNX, Transformers.js
    this.workers = new WorkerAdapter(); // Web Workers, Service Workers

    // External libraries
    this.readability = new ReadabilityAdapter();
  }

  // Unified interface regardless of underlying implementation
  async synthesize(text, options) {
    return this.ml.runInference(text, options);
  }

  // Performance monitoring built-in
  async measureOperation(name, fn) {
    const start = performance.now();
    const result = await fn();
    this.metrics.record(name, performance.now() - start);
    return result;
  }
}

// Any external API change only affects the specific adapter
```

### 4. Stable, Future-Proof APIs

Each module exposes an API designed for the future:

```javascript
// SynthesisEngine API - supports features not yet implemented
interface SynthesisEngine {
  synthesize(options: {
    text: string,
    voice: string,
    language: string,
    speed?: number,
    pitch?: number,
    emotion?: string,       // Future: emotional synthesis
    style?: string,         // Future: speaking styles
    ssml?: boolean,         // Future: SSML support
    streaming?: boolean,    // Future: streaming synthesis
    format?: AudioFormat,   // Future: multiple formats
    cache?: boolean         // Future: caching
  }): Promise<AudioResult>;

  listVoices(): Voice[];
  preloadVoice(id: string): Promise<void>;
  getCapabilities(): Capabilities;
}
```

## Module Organization for Single Developer

While developed by one person, modules serve as **cognitive boundaries** - separating concerns for maintainability and mental clarity:

```
Core/                        [Focus: Orchestration]
├── event-bus/               # Event routing and subscription
├── pipeline/                # Stage management
├── plugin-loader/           # Dynamic plugin loading
└── performance-monitor/     # Real-time metrics

Platform/                    [Focus: External Dependencies]
├── chrome-adapter/          # Chrome Extension APIs
├── web-adapter/            # Browser APIs
├── ml-adapter/             # ONNX/Transformers.js
└── library-adapter/        # Third-party libraries

Plugins/                     [Focus: Features]
├── content-extractor/       # Text extraction (simple)
├── kokoro-engine/          # TTS synthesis (complex subsystem)
├── offscreen-audio/        # Audio playback
├── ui-renderer/            # UI components
├── queue-manager/          # Request handling (simple)
├── storage-provider/       # Data persistence
├── error-handler/          # Error recovery
└── telemetry/              # Analytics

Note: Some plugins are naturally larger (kokoro-engine with ONNX model management)
while others are simple (queue-manager). This is expected and acceptable.
```

**Development Strategy for Single Developer:**
1. Build incrementally - Core → Platform → Essential Plugins → Enhancement Plugins
2. Use plugin boundaries to context-switch cleanly between different concerns
3. Each plugin should be developable in 1-3 day sprints
4. Larger plugins (kokoro-engine) can be built over multiple sprints

## Performance Monitoring Strategy

**Principle: Measure First, Optimize Second**

Don't prematurely optimize. The event-driven architecture provides excellent observability. Use it to identify REAL bottlenecks:

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      eventProcessing: 10,    // ms - warn if event takes >10ms
      pipelineStage: 50,      // ms - warn if any stage >50ms
      endToEnd: 100,          // ms - warn if total >100ms
      memoryUsage: 100 * 1024 * 1024  // 100MB per plugin
    };
  }

  recordMetric(plugin, operation, duration, memory) {
    const metric = {
      plugin,
      operation,
      duration,
      memory,
      timestamp: Date.now()
    };

    this.metrics.set(`${plugin}:${operation}`, metric);

    // Alert if threshold exceeded
    if (duration > this.thresholds.pipelineStage) {
      console.warn(`Performance warning: ${plugin}.${operation} took ${duration}ms`);
    }
  }

  getBottlenecks() {
    return Array.from(this.metrics.values())
      .filter(m => m.duration > this.thresholds.pipelineStage)
      .sort((a, b) => b.duration - a.duration);
  }

  // Only optimize based on real data
  suggestOptimizations() {
    const bottlenecks = this.getBottlenecks();
    if (bottlenecks.length === 0) {
      return "No optimization needed - all operations within thresholds";
    }
    // Suggest specific optimizations based on data
  }
}
```

**When to Consider Direct Coupling:**
- Only if metrics show consistent >50ms overhead from event routing
- Only for critical path operations (text → audio)
- Document why and maintain plugin contract

## Essential Tooling Ecosystem

Critical development and debugging tools:

```javascript
// 1. Event Recorder - Records all events for replay
class EventRecorder {
  constructor(core) {
    core.eventBus.subscribe('*', this.record.bind(this));
  }
  record(event) { /* saves to file */ }
  replay(recording) { /* replays events */ }
}

// 2. Event Simulator - Inject test events
class EventSimulator {
  inject(type, data) {
    const event = new SynthesisEvent();
    event.source.type = 'simulator';
    return core.process(event);
  }
}

// 3. Pipeline Visualizer - Real-time flow visualization
class PipelineVisualizer {
  render() {
    // Shows events flowing through pipeline stages
    // Highlights bottlenecks and failures
  }
}

// 4. Performance Profiler
class PerformanceProfiler {
  measure(event) {
    // Tracks latency at each pipeline stage
    // Identifies performance bottlenecks
  }
}

// 5. Debug Logger
class DebugLogger {
  constructor(core) {
    core.eventBus.subscribe('*', this.log.bind(this));
  }
  log(event) {
    // Structured logging with filtering
  }
}

// 6. Scripting Bridge
class ScriptingBridge {
  expose() {
    // Exposes core API to Python/JS for automation
    window.ttsCore = {
      synthesize: (text) => core.process(new SynthesisEvent(text)),
      getQueue: () => core.plugins.get('queue').getState()
    };
  }
}
```

## Risk Profile & Mitigation

| Risk | Mitigation Strategy | Implementation |
|------|-------------------|----------------|
| Chrome API changes | Platform Abstraction Layer | All Chrome APIs wrapped |
| Manifest V3 → V4 | PAL handles migration | Single point of change |
| Memory leaks | Plugin lifecycle management | Automatic cleanup hooks |
| Model size rejection | Progressive loading | Separate model downloader plugin |
| Dependency updates | Adapter plugins | Wrap all external libs |
| Team scaling | Module ownership | One person per module |
| Feature velocity | Plugin architecture | Add features without touching core |
| Debugging complexity | Event recording | Complete replay capability |
