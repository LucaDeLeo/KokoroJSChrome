# Section 10: Testing Strategy

## Integration-First Testing Approach

**Philosophy:** Test the user experience, not the implementation. Integration tests catch real bugs; unit tests provide confidence.

## Testing Pyramid (Inverted for Chrome Extensions)

```
        Integration Tests (60%)
       /                      \
      /   User scenarios       \
     /    End-to-end flows      \
    /                            \
   ────────────────────────────────
         Unit Tests (30%)
        /              \
       /  Critical logic \
      /   Complex algos   \
     ───────────────────────
       Manual Tests (10%)
         UI polish
```

## Integration Test Strategy

```javascript
// Test real user flows, not individual plugins
class IntegrationTestHarness {
  async testCompleteFlow() {
    // 1. Simulate text selection
    const event = new TTSEvent();
    event.request.text = "Test text";

    // 2. Process through entire pipeline
    const result = await core.process(event);

    // 3. Verify audio output
    expect(result.response.audio).toBeDefined();
    expect(result.metadata.timing.completed - result.metadata.timing.started).toBeLessThan(100);
  }

  async testWithPerformanceMonitoring() {
    // Run test while collecting metrics
    const metrics = await performanceMonitor.profile(async () => {
      await this.testCompleteFlow();
    });

    // Verify no stage exceeds threshold
    metrics.forEach(metric => {
      expect(metric.duration).toBeLessThan(50);
    });
  }
}
```

## What to Test

### Integration Tests (Priority 1)
- Complete text-to-audio flow
- Multi-tab request handling
- Large text processing (>100KB)
- Error recovery scenarios
- Memory pressure handling

```javascript
// Example: test/unit/background/offscreen-manager.test.js
describe('OffscreenManager', () => {
  test('should create offscreen document on first request', async () => {
    await manager.ensureOffscreen()

    expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'TTS audio synthesis and playback'
    })
  })
})
```

### Integration Tests
- **Scope:** Cross-context message passing, storage operations
- **Existing System Verification:** Core TTS functions work in extension context
- **New Feature Testing:** End-to-end TTS flow from selection to audio

### Regression Testing
- **Existing Feature Verification:** Core TTS quality unchanged
- **Automated Regression Suite:** GitHub Actions on every PR
- **Manual Testing Requirements:** Chrome Web Store pre-submission checklist

## Test Automation

```yaml