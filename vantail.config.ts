import { defineConfig } from '@vantail/cli'

export default defineConfig({
  app: {
    name: 'Textpilot',
    identifier: 'dev.textpilot.app',
    version: '0.1.0',
  },
  window: {
    title: 'Textpilot',
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0b0d12',
    // Let the page draw its own title bar: the window content reaches the top
    // edge (titleBarStyle: "hidden") with room reserved for a bar about the
    // height of the system's own. The platform's buttons stay (macOS traffic
    // lights); the renderer drags the bar and centres them in it.
    titleBarStyle: 'hidden',
    titleBarHeight: 36,
    // Add Corner Radius to the App. Need to create my own window decorations.
    decorations: false,
    borderRadius: 36,
  },
  permissions: {
    network: {
      allow: ['127.0.0.1', 'localhost'],
    },
  },
})
