# UIRenderer Plugin

## Overview
UIRenderer plugin provides Shadow DOM-based UI components for the KokoroJS Chrome Extension TTS experience. It renders floating buttons, progress bars, and control panels with complete CSS isolation.

## Features
- **Floating Button**: Appears near text selection with play/pause/stop controls
- **Progress Bar**: Shows TTS synthesis and playback progress with status messages
- **Control Panel**: Mini player with voice selection, speed control, and playback controls
- **Shadow DOM Isolation**: All components use closed Shadow DOM for CSS isolation
- **Accessibility**: Full ARIA support for screen readers
- **Responsive**: Adapts to viewport boundaries and different screen sizes

## Plugin Metadata
- **ID**: `ui-renderer`
- **Stage**: `ui`
- **Version**: `1.0.0`

## Components

### Floating Button
- Renders near text selection
- Auto-hides after 10 seconds (configurable)
- States: play, pause, stop, loading
- Fade-in/fade-out animations

### Progress Bar
- Shows progress percentage (0-100%)
- Displays status messages: "Initializing...", "Synthesizing...", "Playing...", "Complete"
- Auto-hides after completion
- Smooth CSS transitions

### Control Panel
- Sticky overlay in bottom-right corner
- Play/pause/stop/resume buttons
- Voice selector dropdown
- Speed slider (0.5x - 3.0x)
- Volume control (0-100%)
- Minimize/expand functionality

## Events

### Subscribed Events
- `selection:detected` - Renders floating button
- `tts:progress` - Updates progress bar
- `tts:started` - Shows control panel
- `tts:completed` - Hides control panel
- `tts:error` - Displays error message

### Emitted Events
- `ui:button-click` - User clicked floating button
- `ui:play` - User clicked play
- `ui:pause` - User clicked pause
- `ui:stop` - User clicked stop
- `ui:resume` - User clicked resume
- `ui:voice-change` - User changed voice
- `ui:speed-change` - User changed speed
- `ui:volume-change` - User changed volume

## Configuration

```javascript
const config = {
  defaultTheme: 'default',      // 'default' | 'dark' | 'light' | 'minimal'
  defaultSize: 'medium',        // 'small' | 'medium' | 'large'
  buttonAutoHideDelay: 10000,   // ms
  progressAutoHideDelay: 2000,  // ms
  enableAnimations: true        // boolean
}
```

## Usage

```javascript
import UIRendererPlugin from './plugins/ui-renderer/index.js'

const plugin = new UIRendererPlugin(config)
await plugin.init(eventBus, pal)

// Render floating button
await plugin.renderButton({
  position: { x: 100, y: 200 },
  theme: 'default',
  autoHide: true
})

// Update progress
await plugin.updateProgress(50, 'Synthesizing...')

// Show control panel
plugin.showComponent('control-panel')
```

## Dependencies
- Event bus (from core)
- Platform Abstraction Layer (PAL)
- Shadow DOM (native browser API)

## Architecture
Follows the standardized plugin structure:
- `index.js` - Plugin entry point
- `api.d.ts` - TypeScript definitions
- `src/renderer.js` - Main plugin class
- `src/components/` - UI component implementations
- `src/themes/` - Theme stylesheets
- `test/` - Plugin tests

## Testing
See `test/integration/ui-renderer.test.js` for integration tests covering:
- Floating button render on selection
- Progress bar updates from event bus
- Control panel functionality
- Shadow DOM isolation
- ARIA attributes
- Performance targets (<200ms render time)
