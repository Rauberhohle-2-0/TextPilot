import { defineConfig } from "@vantail/cli";

export default defineConfig({
  app: {
    name: "Textpilot",
    identifier: "dev.textpilot.app",
    version: "0.1.0",
  },
  window: {
    title: "Textpilot",
    width: 800,
    height: 600,
    backgroundColor: "#0b0d12",
  },
});
