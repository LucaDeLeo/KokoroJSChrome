# Summary

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