# QueueManager Plugin

## Overview
QueueManager plugin manages the TTS request queue with "stop previous" behavior to prevent concurrent audio playback. It ensures only one TTS session plays at a time.

## Features
- **Stop Previous Behavior**: Automatically stops current audio when a new request arrives
- **Session Tracking**: Tracks current TTS session state (queued, playing, paused, stopped)
- **Queue Management**: FIFO queue for TTS requests (though typically only one at a time)
- **State Persistence**: Session state tracked in chrome.storage.local
- **Priority Support**: Support for priority-based queueing (future enhancement)

## Plugin Metadata
- **ID**: `queue-manager`
- **Stage**: `queue`
- **Version**: `1.0.0`

## Behavior

### Stop Previous Mode (Default)
When a new TTS request arrives:
1. If audio is currently playing, send 'audio:stop' event
2. Clear current session
3. Create new session for incoming request
4. Forward request to synthesis stage

This ensures **no concurrent audio** playback.

### Session States
- `queued`: Request received, waiting to be processed
- `playing`: Audio is currently playing
- `paused`: Audio playback is paused
- `stopped`: Audio playback was stopped
- `completed`: Audio playback finished normally

## Events

### Subscribed Events
- `tts:request` - New TTS request to enqueue

### Emitted Events
- `audio:stop` - Stop current audio (sent to OffscreenAudio plugin)
- `queue:started` - New session started
- `queue:stopped` - Current session stopped
- `queue:paused` - Current session paused
- `queue:resumed` - Current session resumed
- `queue:completed` - Current session completed
- `tts:synthesize` - Forward request to synthesis stage

## Configuration

```javascript
const config = {
  maxQueueSize: 10,         // Max queue size (not enforced in stop-previous mode)
  stopPrevious: true,       // Always stop previous audio (default)
  sessionTimeout: 300000,   // Session timeout in ms (5 minutes)
  persistState: true        // Persist session state to chrome.storage.local
}
```

## Usage

```javascript
import QueueManagerPlugin from './plugins/queue-manager/index.js'

const plugin = new QueueManagerPlugin(config)
await plugin.init(eventBus, pal)

// The plugin will automatically handle incoming TTS requests
// and enforce the stop-previous behavior

// Manual controls (if needed)
await plugin.stopCurrent()      // Stop current session
await plugin.pauseCurrent()     // Pause current session
await plugin.resumeCurrent()    // Resume current session
plugin.clear()                  // Clear queue

// Query state
const session = plugin.getCurrentSession()
const queueLength = plugin.getQueueLength()
const state = plugin.getQueueState()
```

## Data Model

### TTSSession
```javascript
{
  sessionId: string,      // UUID
  tabId: number,          // Chrome tab ID
  status: SessionStatus,  // 'queued' | 'playing' | 'paused' | 'stopped' | 'completed'
  text: string,           // Text being synthesized
  textId?: string,        // Reference to IndexedDB if large (>50KB)
  voiceId: string,        // Selected Kokoro voice
  speed: number,          // Playback rate (0.5-3.0)
  progress: number,       // Current position (0-100)
  startTime: number,      // Session start time
  pausedTime?: number,    // Time when paused
  resumeTime?: number     // Time when resumed
}
```

## Integration

The QueueManager plugin is registered in the pipeline at the 'queue' stage, which runs **before synthesis**:

```
1. User Action (selection/context menu)
2. ContentExtractor (extraction stage)
3. ➡️ QueueManager (queue stage) ⬅️ YOU ARE HERE
4. KokoroEngine (synthesis stage)
5. OffscreenAudio (playback stage)
6. UIRenderer (ui stage)
```

When a new TTS request arrives at the QueueManager:
- Current audio is stopped via 'audio:stop' event
- New session is created and tracked
- Request is forwarded to synthesis stage

## Dependencies
- Event bus (from core)
- Platform Abstraction Layer (PAL)
- chrome.storage.local for session persistence

## Architecture
Follows the standardized plugin structure:
- `index.js` - Plugin entry point
- `api.d.ts` - TypeScript definitions
- `src/queue.js` - Main plugin class
- `test/` - Plugin tests

## Testing
See `test/integration/queue-manager.test.js` for integration tests covering:
- Stop previous behavior (no concurrent audio)
- Session state transitions
- Queue operations
- State persistence
- Performance targets (<50ms stop time, <10ms enqueue time)
