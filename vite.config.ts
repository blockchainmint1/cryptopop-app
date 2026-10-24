// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// BUILD_ID: injected at build time so a running (possibly cached) webview can
// compare itself against what the server is now shipping.
const BUILD_ID = process.env.LOVABLE_BUILD_ID || String(Date.now());
process.env.LOVABLE_BUILD_ID = BUILD_ID;

export default defineConfig({
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false, // public/manifest.json is the manifest
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          // Precache only the offline page; hashed assets are cached at runtime.
          globPatterns: [],
          additionalManifestEntries: [{ url: "/offline.html", revision: BUILD_ID }],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML pages: always try the network first; never for OAuth or APIs.
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pop-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20 },
                plugins: [
                  {
                    handlerDidError: async () =>
                      (await caches.match("/offline.html", { ignoreSearch: true })) ||
                      Response.error(),
                  },
                ],
              },
            },
            {
              // Same-origin hashed build assets only.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: {
                cacheName: "pop-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
