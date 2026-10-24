import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/blast-drain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bearer = request.headers.get("authorization");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!bearer?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (!url || !key) return Response.json({ error: "Unavailable" }, { status: 503 });
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: bearer } } });
        const { data: user, error: authError } = await client.auth.getUser(bearer.slice(7));
        if (authError || !user.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { data: admin, error: roleError } = await client.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
        if (roleError || !admin) return Response.json({ error: "Forbidden" }, { status: 403 });
        const { drainPendingBlasts } = await import("@/lib/blast.server");
        try {
          const result = await drainPendingBlasts({});
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[blast-drain] failed:", msg);
          return Response.json({ ok: false, error: "Email processing failed" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ error: "Method not allowed" }, { status: 405 }),
    },
  },
});
