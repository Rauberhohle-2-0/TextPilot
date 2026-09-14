import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

/** Builds the renderer into `dist/renderer` for production/packaging. */
export default defineConfig({
  root: "src/renderer",
  plugins: [tailwindcss()],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
});
