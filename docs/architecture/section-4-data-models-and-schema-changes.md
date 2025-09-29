# Section 4: Data Models and Schema Changes

## New Data Models

### TTSSession Model
**Purpose:** Track active TTS sessions across tabs for singleton management
**Integration:** Manages Offscreen document's single audio stream

**Key Attributes:**
- `sessionId`: string (UUID) - Unique session identifier
- `tabId`: number - Chrome tab ID requesting TTS
- `status`: enum ['queued', 'playing', 'paused', 'stopped'] - Current state
- `text`: string - Text being synthesized (reference if large)
- `voiceId`: string - Selected Kokoro voice
- `speed`: number - Playback rate (0.5-3.0)
- `progress`: number - Current position (0-100)
- `startTime`: timestamp - Session start time
- `isLargeText`: boolean - Whether text is stored in IndexedDB

**Relationships:**
- **With Existing:** None (new model)
- **With New:** References TextCache for large texts

### TextCache Model
**Purpose:** Store large texts (>50KB) for transport between contexts
**Integration:** Enables message passing without size limits

**Key Attributes:**
- `cacheId`: string (UUID) - Unique cache identifier
- `text`: string - Full text content
- `tabId`: number - Source tab ID
- `timestamp`: number - Creation time (for cleanup)
- `size`: number - Text size in bytes
- `extracted`: boolean - Whether from Readability extraction

**Relationships:**
- **With Existing:** None (new model)
- **With New:** Referenced by TTSSession when isLargeText=true

### UserPreferences Model
**Purpose:** Store user settings synchronized across devices
**Integration:** Replaces localStorage preferences from web app

**Key Attributes:**
- `defaultVoice`: string - Preferred Kokoro voice ID
- `defaultSpeed`: number - Preferred playback rate
- `autoDetectContent`: boolean - Auto-extract page content
- `showFloatingButton`: boolean - Display selection button
- `keyboardShortcuts`: object - Custom keyboard mappings
- `persistentStorage`: boolean - Whether persistent storage granted

**Relationships:**
- **With Existing:** Migrates from web app localStorage
- **With New:** Applied to all TTSSession instances

### ModelMetadata Model
**Purpose:** Track ONNX model storage and versioning
**Integration:** Manages the 300MB model lifecycle

**Key Attributes:**
- `modelId`: string - Model identifier (kokoro-82M)
- `version`: string - Model version for updates
- `size`: number - Model size in bytes
- `downloadDate`: timestamp - When downloaded
- `lastUsed`: timestamp - For cache management
- `storageType`: enum ['indexeddb', 'temporary'] - Storage persistence
- `checksums`: object - Integrity verification

**Relationships:**
- **With Existing:** New model storage (was CDN-loaded)
- **With New:** Required by all TTSSession instances

## Schema Integration Strategy

**Database Changes Required:**
- **New Tables:** None (NoSQL approach with IndexedDB)
- **New IndexedDB Object Stores:**
  - `models` - ONNX model binary data (300MB)
  - `sessions` - Active TTS session tracking
  - `textCache` - Large text temporary storage
  - `metadata` - Model and app metadata

**Migration Strategy:**
```javascript
// One-time migration from web app
async function migrateFromWebApp() {
  const webAppData = localStorage.getItem('kokorojs_preferences');
  if (webAppData) {
    const prefs = JSON.parse(webAppData);
    await chrome.storage.sync.set({
      defaultVoice: prefs.voice || 'af_bella',
      defaultSpeed: prefs.speed || 1.0
    });
    localStorage.removeItem('kokorojs_preferences'); // Clean up
  }
}
```

**Backward Compatibility:**
- No breaking changes (greenfield extension data)
- Web app continues to work independently
- Optional one-way import from web app settings

## Storage Architecture

```javascript
// IndexedDB Structure (300MB+)
const db = {
  name: 'KokoroJSExtension',
  version: 1,
  stores: {
    models: {
      keyPath: 'modelId',
      indexes: ['version', 'downloadDate']
    },
    textCache: {
      keyPath: 'cacheId',
      indexes: ['tabId', 'timestamp'],
      autoCleanup: true // Delete after 1 hour
    },
    metadata: {
      keyPath: 'key',
      data: ['modelVersion', 'lastCleanup', 'sessionCount']
    }
  }
};

// Chrome Storage Structure
const chromeStorage = {
  sync: { // 100KB limit - User preferences only
    userPreferences: UserPreferences
  },
  local: { // 10MB limit - Runtime data
    sessions: Map<tabId, TTSSession>,
    offscreenState: {
      recycleCount: number,
      lastRestart: timestamp,
      memoryUsage: number
    }
  }
};
```
