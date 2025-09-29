# Section 6: API Design and Integration

## API Integration Strategy
**API Integration Strategy:** Chrome Extension Manifest V3 APIs with fallback patterns
**Authentication:** None required (all client-side)
**Versioning:** Target Chrome 109+ APIs, graceful degradation for older

## Chrome Extension API Endpoints

### chrome.runtime Messaging API
- **Method:** sendMessage/onMessage
- **Endpoint:** Internal message passing
- **Purpose:** Inter-context communication for TTS requests
- **Integration:** Core messaging backbone between all components

**Request:**
```json
{
  "type": "TTS_REQUEST",
  "tabId": 123,
  "payload": {
    "text": "Text to synthesize",
    "textId": "uuid-for-large-text",
    "voice": "af_bella",
    "speed": 1.0
  }
}
```

**Response:**
```json
{
  "type": "TTS_RESPONSE",
  "status": "playing|completed|error",
  "sessionId": "session-uuid",
  "progress": 45,
  "error": null
}
```

### chrome.offscreen API
- **Method:** createDocument/closeDocument
- **Endpoint:** chrome://offscreen-doc
- **Purpose:** Isolated context for audio processing
- **Integration:** Singleton audio service management

**Request:**
```json
{
  "reasons": ["AUDIO_PLAYBACK"],
  "url": "offscreen.html",
  "justification": "TTS audio synthesis and playback"
}
```

**Response:**
```json
{
  "created": true,
  "documentId": "offscreen-doc-id"
}
```

## External API Integration

### Model CDN API
- **Purpose:** One-time model download from your CDN
- **Documentation:** Internal deployment docs
- **Base URL:** https://models.kokorojs.com
- **Authentication:** None (public models)
- **Integration Method:** Fetch with progress tracking

**Key Endpoints Used:**
- `GET /models/kokoro-82M.onnx` - Download ONNX model
- `GET /models/kokoro-82M.json` - Model metadata and checksums

**Error Handling:** Exponential backoff retry with user notification
