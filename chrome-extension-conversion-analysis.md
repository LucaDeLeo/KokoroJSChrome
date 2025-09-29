# Chrome Extension Conversion Analysis for StreamingKokoroJS

## Executive Summary

Converting StreamingKokoroJS into a Chrome extension is a moderate complexity project requiring approximately **5-7 days** of development work. The core TTS functionality can be reused, but significant architectural changes are needed to comply with Chrome's extension framework and security model.

## Current Architecture Overview

### Project Size & Components
- **JavaScript Libraries**: ~2.1MB total
  - transformers.min.js: 820KB
  - phonemizer.min.js: 1.3MB
  - Core application code: ~35KB
- **ML Model**: 300MB Kokoro-82M ONNX model (downloaded on first use)
- **Audio Processing**: 24kHz sample rate, streaming chunks
- **Performance**: WebGPU acceleration with WASM fallback

### Key Technical Components
1. **worker.js**: Runs TTS model in Web Worker for non-blocking processing
2. **AudioPlayer.js**: Manages audio streaming with AudioContext
3. **AudioDiskSaver.js**: Handles audio file downloads
4. **kokoro.js**: TTS model wrapper and voice synthesis
5. **phonemize.js**: Text-to-phoneme conversion
6. **semantic-split.js**: Intelligent text chunking

## Chrome Extension Requirements

### Manifest V3 Considerations
Chrome extensions now require Manifest V3, which introduces several constraints:
- Service workers replace background pages
- No remote code execution
- Stricter Content Security Policy
- Limited DOM access from service workers

### Required Permissions
```json
{
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "offscreen"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

## Technical Challenges & Solutions

### Challenge 1: Module Architecture
**Problem**: ES6 modules don't work directly in Chrome extensions
**Solution**:
- Use webpack or rollup to bundle modules
- Convert dynamic imports to static
- Bundle third-party libraries

### Challenge 2: Web Worker in Extensions
**Problem**: Regular Web Workers don't work in extension service workers
**Solutions**:
1. Use Chrome's offscreen API (Chrome 109+)
2. Convert to service worker with message passing
3. Use chrome.runtime messaging for communication

### Challenge 3: Model Storage (300MB)
**Problem**: Chrome sync storage limited to 100KB, local storage to 10MB
**Solutions**:
- Use IndexedDB for model storage (no size limit)
- Implement chunked download with progress
- Cache model after first download
- Consider compression strategies

### Challenge 4: Audio Playback
**Problem**: Service workers can't use AudioContext
**Solution**:
- Create offscreen document for audio playback
- Pass audio buffers via message passing
- Alternative: Inject audio player into active tab

### Challenge 5: Cross-Origin Restrictions
**Problem**: Extensions have strict CORS policies
**Solutions**:
- Bundle model or host on extension-friendly CDN
- Use fetch with extension privileges
- Implement proper error handling for network issues

## Implementation Architecture

### Proposed File Structure
```
chrome-extension/
├── manifest.json
├── service-worker.js         # Background processing
├── content/
│   ├── content-script.js    # Text selection detection
│   └── floating-ui.js       # Selection UI overlay
├── offscreen/
│   ├── offscreen.html       # Hidden document for audio
│   └── audio-player.js      # AudioContext implementation
├── popup/
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Settings & controls
│   └── popup.css
├── options/
│   ├── options.html         # Full settings page
│   └── options.js
├── lib/
│   ├── transformers.min.js  # Bundled
│   ├── phonemizer.min.js    # Bundled
│   └── kokoro-bundle.js     # Bundled TTS code
└── models/                   # Model storage location
```

### Component Communication Flow
```
User selects text on webpage
    ↓
Content Script detects selection
    ↓
Sends text to Service Worker
    ↓
Service Worker processes with TTS model
    ↓
Sends audio chunks to Offscreen Document
    ↓
Offscreen Document plays audio
```

## Feature Implementation Details

### 1. Text Selection Detection
```javascript
// content-script.js
let selectionButton = null;

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text.length > 0) {
    showSelectionButton(e.pageX, e.pageY, text);
  } else {
    hideSelectionButton();
  }
});

function showSelectionButton(x, y, text) {
  if (!selectionButton) {
    selectionButton = createFloatingButton();
  }

  selectionButton.style.left = `${x}px`;
  selectionButton.style.top = `${y + 20}px`;
  selectionButton.style.display = 'block';

  selectionButton.onclick = () => {
    chrome.runtime.sendMessage({
      type: 'TTS_REQUEST',
      text: text,
      voice: localStorage.getItem('preferredVoice')
    });
  };
}
```

### 2. Playback Speed Control
```javascript
// audio-player.js modifications
class ExtensionAudioPlayer extends AudioPlayer {
  constructor(worker) {
    super(worker);
    this.playbackSpeed = 1.0;
  }

  async queueAudio(audioData) {
    const audioData2 = new Float32Array(audioData);
    const audioBuffer = this.audioContext.createBuffer(1, audioData2.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(audioData2);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = this.playbackSpeed; // Speed control
    source.connect(this.audioContext.destination);

    // ... rest of implementation
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
  }
}
```

### 3. Service Worker Implementation
```javascript
// service-worker.js
import { KokoroTTS } from './lib/kokoro-bundle.js';

let ttsModel = null;
let offscreenDocument = null;

// Initialize model on installation
chrome.runtime.onInstalled.addListener(async () => {
  await initializeModel();
  await createOffscreenDocument();
});

async function initializeModel() {
  // Load from IndexedDB or download
  ttsModel = await loadOrDownloadModel();
}

// Handle TTS requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TTS_REQUEST') {
    processTTS(request.text, request.voice)
      .then(sendResponse)
      .catch(console.error);
    return true; // Async response
  }
});

async function processTTS(text, voice) {
  const chunks = splitTextSmart(text);

  for (const chunk of chunks) {
    const audio = await ttsModel.generate(chunk, voice);

    // Send to offscreen document for playback
    await chrome.runtime.sendMessage({
      type: 'PLAY_AUDIO',
      target: 'offscreen',
      audio: audio
    });
  }
}
```

### 4. Offscreen Document
```javascript
// offscreen/audio-player.js
let audioContext = new AudioContext();
let audioQueue = [];

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'PLAY_AUDIO' && request.target === 'offscreen') {
    queueAndPlayAudio(request.audio);
  }
});

async function queueAndPlayAudio(audioData) {
  const audioBuffer = audioContext.createBuffer(
    1,
    audioData.length,
    24000
  );
  audioBuffer.getChannelData(0).set(audioData);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}
```

## Performance Considerations

### Memory Management
- Service workers have memory limits (~30-50MB active)
- Model needs to be loaded/unloaded efficiently
- Consider using chrome.storage.session for temporary data

### WebGPU in Extensions
- WebGPU support in extensions is limited
- Will likely default to WASM implementation
- Performance impact: ~2-3x slower than WebGPU

### Audio Latency
- Message passing adds ~10-50ms latency
- Chunk size optimization needed
- Consider prebuffering strategy

## Development Timeline

### Phase 1: Setup & Infrastructure (Day 1)
- [ ] Create manifest.json with permissions
- [ ] Set up webpack configuration
- [ ] Create basic file structure
- [ ] Implement service worker skeleton

### Phase 2: Core Functionality (Days 2-3)
- [ ] Port worker.js to service worker
- [ ] Bundle libraries and dependencies
- [ ] Implement model loading from IndexedDB
- [ ] Create offscreen document for audio

### Phase 3: User Interface (Day 4)
- [ ] Implement content script
- [ ] Create text selection detection
- [ ] Build popup interface
- [ ] Add context menu integration

### Phase 4: Advanced Features (Day 5)
- [ ] Implement playback speed control
- [ ] Add voice selection in popup
- [ ] Create options page
- [ ] Implement keyboard shortcuts

### Phase 5: Testing & Optimization (Days 6-7)
- [ ] Test on various websites
- [ ] Handle edge cases (iframes, shadow DOM)
- [ ] Optimize performance
- [ ] Add comprehensive error handling
- [ ] Create user documentation

## Risk Assessment

### High Risk Issues
1. **Model Size**: 300MB might hit storage quotas
   - Mitigation: Implement compression, chunked storage

2. **Memory Usage**: Service worker throttling
   - Mitigation: Lazy loading, garbage collection strategies

3. **Audio Playback**: Offscreen API is relatively new
   - Mitigation: Fallback to tab injection method

### Medium Risk Issues
1. **WebGPU Support**: Limited in extensions
   - Mitigation: Already have WASM fallback

2. **Cross-Origin Model Loading**: CORS restrictions
   - Mitigation: Bundle model or use proper headers

3. **Performance**: Slower than native app
   - Mitigation: Optimize chunk sizes, use caching

### Low Risk Issues
1. **UI Complexity**: Simple selection interface
2. **Browser Compatibility**: Chrome/Edge only initially
3. **Voice Selection**: Already implemented

## Alternative Approaches

### Option 1: Simplified MVP
- Start with context menu only (no floating button)
- Single voice option
- No speed control initially
- Fixed chunk size
- Timeline: 3-4 days

### Option 2: Hybrid Approach
- Use extension for UI only
- Keep processing in separate tab
- Communication via extension messaging
- Timeline: 2-3 days

### Option 3: Native Messaging
- Use native host application
- Extension as thin client
- Better performance
- Timeline: 7-10 days

## Recommendations

1. **Start with MVP**: Implement core functionality first
2. **Use IndexedDB**: For model storage from the beginning
3. **Bundle Aggressively**: Minimize network requests
4. **Test Early**: Chrome's extension review process is strict
5. **Consider Firefox**: Plan for cross-browser support
6. **User Feedback**: Add telemetry for performance monitoring

## Conclusion

Converting StreamingKokoroJS to a Chrome extension is technically feasible with moderate complexity. The main challenges revolve around Chrome's extension architecture constraints rather than the TTS functionality itself. With proper planning and architecture, the conversion can be completed in 5-7 days by an experienced developer.

The resulting extension would provide:
- One-click TTS for any selected text
- Multiple voice options
- Adjustable playback speed
- Fully offline operation after initial model download
- Privacy-preserving local processing

The project is well-suited for extension conversion given its client-side nature and would provide significant value as a browser extension compared to the current standalone web application.