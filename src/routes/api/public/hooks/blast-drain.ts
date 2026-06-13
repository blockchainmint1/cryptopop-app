import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/blast-drain")({
  server: {
    handlers: {
      POST: async () => {
        const { drainPendingBlasts } = await import("@/lib/blast.server");
        try {
          const result = await drainPendingBlasts({});
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[blast-drain] failed:", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to drain" }),
    },
  },
});
