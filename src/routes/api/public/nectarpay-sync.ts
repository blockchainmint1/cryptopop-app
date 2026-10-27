// Hourly store-directory refresh, called by the database timer (pg_cron) and
// safe for anyone to poke: it only ever pulls NectarPay's public feed into our
// own copy, refuses to run twice at once, and ignores requests that arrive less
// than 15 minutes after the last run. It never returns store data or anything
// about a user.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nectarpay-sync")({
  server: {
    handlers: {
      GET: async () => {
        const { runNectarpaySync } = await import("@/lib/nectarpay-sync.server");
        const result = await runNectarpaySync();
        const status = result.status === "error" ? 502 : 200;
        return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
