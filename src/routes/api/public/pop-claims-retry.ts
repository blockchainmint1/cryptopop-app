// Called every few minutes by the database timer (pg_cron) so store-payment POP
// is never stranded when the shopper closes the checkout before NectarPay
// confirms the sale. Safe for anyone to poke: it only re-checks sales already
// written down, each on its own back-off schedule, and returns no user data.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pop-claims-retry")({
  server: {
    handlers: {
      GET: async () => {
        const { retryDueClaims } = await import("@/lib/pop-claim.server");
        try {
          await retryDueClaims(10);
          return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          console.error("[pop claim retry]", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
