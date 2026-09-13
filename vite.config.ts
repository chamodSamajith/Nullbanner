// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    // Chrome ignores <link rel="modulepreload"> inside extension pages
    // ("cross-world extension resource mismatch") and logs each one to the
    // chrome://extensions Errors panel. Nothing is gained from preloading a
    // local chrome-extension:// module anyway, so don't emit the hints.
    modulePreload: false,
    rollupOptions: {
      input: {
        options: "src/options/index.html"
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 }
  }
});
