// SPDX-License-Identifier: GPL-3.0-only
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

/**
 * crxjs wraps every content script in a tiny loader that `import()`s the real
 * chunk asynchronously. That's fine for ordinary isolated-world scripts, but
 * it breaks the popup guard in two ways:
 *
 * 1. For a `"world": "MAIN"` script it emits a *relative* import (there is no
 *    chrome.runtime in the page's world), which resolves against the page's
 *    own origin and 404s — so the window.open override never installs.
 * 2. Even where the loader works, the script no longer runs synchronously at
 *    document_start, which the guard's fail-closed default and the nonce
 *    handoff between guard-main.ts and guard-bridge.ts both depend on.
 *
 * So after crxjs has written the bundle, this plugin compiles each guard
 * script as a self-contained IIFE, points the manifest's content_scripts
 * entries at those files, and removes the now-dead loader chunks. Chrome
 * then injects them as plain scripts, synchronously, before any page script.
 *
 * Note: `pnpm dev` (the HMR server) does not run this step, so the guard is
 * only functional in `pnpm build` output — load dist/ from a build.
 */
const STANDALONE_CONTENT_SCRIPTS: Record<string, string> = {
  "src/content/guard-main.ts": "guard-main.js",
  "src/content/guard-bridge.ts": "guard-bridge.js"
};

interface ManifestContentScript {
  js?: string[];
}
interface ManifestShape {
  content_scripts?: ManifestContentScript[];
  web_accessible_resources?: { resources: string[] }[];
}

function standaloneContentScripts(): Plugin {
  return {
    name: "nullbanner:standalone-content-scripts",
    apply: "build",
    enforce: "post",
    async writeBundle(options) {
      const outDir = options.dir ?? "dist";
      const manifestPath = path.join(outDir, "manifest.json");
      const manifestJson = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestShape;
      const dead: string[] = [];

      for (const [entry, fileName] of Object.entries(STANDALONE_CONTENT_SCRIPTS)) {
        const stem = path.basename(entry); // e.g. "guard-main.ts"
        const script = manifestJson.content_scripts?.find((cs) =>
          cs.js?.some((file) => file.includes(`${stem}-loader-`))
        );
        if (!script) continue; // already rewritten (writeBundle can run more than once)

        await build({
          configFile: false,
          logLevel: "warn",
          plugins: [],
          build: {
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            lib: { entry, formats: ["iife"], name: "__nullbanner", fileName: () => fileName }
          }
        });

        dead.push(...(script.js ?? [])); // the crxjs loader file
        script.js = [fileName];
        for (const group of manifestJson.web_accessible_resources ?? []) {
          group.resources = group.resources.filter((r) => {
            const isDead = r.includes(`${stem}-`);
            if (isDead) dead.push(r);
            return !isDead;
          });
        }
      }

      await writeFile(manifestPath, JSON.stringify(manifestJson, null, 2) + "\n");
      await Promise.all(dead.map((file) => rm(path.join(outDir, file), { force: true })));
    }
  };
}

export default defineConfig({
  plugins: [crx({ manifest }), standaloneContentScripts()],
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
