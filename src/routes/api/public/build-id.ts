/**
 * Build freshness probe — returns the BUILD_ID of the currently deployed bundle.
 * The app compares it with its own baked-in __BUILD_ID__ to spot a stale webview.
 */
import { createFileRoute } from "@tanstack/react-router";

declare const __BUILD_ID__: string;

export const Route = createFileRoute("/api/public/build-id")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      GET: async () =>
        new Response(
          JSON.stringify({ buildId: typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev" }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ),
    },
  },
});
