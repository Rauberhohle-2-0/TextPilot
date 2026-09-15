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
    // Native chrome: the page runs to the top edge (titleBarStyle: "hidden")
    // and macOS keeps drawing its own traffic lights - no custom buttons.
    // (Rounded corners via `borderRadius` need `decorations: false`, which
    // removes the frame and the lights with it, so they are off while the
    // native buttons are back.)
    titleBarStyle: 'hidden',
    titleBarHeight: 36,
  },
  permissions: {
    network: {
      allow: ['127.0.0.1', 'localhost'],
    },
  },
})
