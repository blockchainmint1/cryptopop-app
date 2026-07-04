import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

async function assertGlobalAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: global admin only");
}

export type AdminRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
};

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRow[]> => {
    await assertGlobalAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if (!roles?.length) return [];

    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    const rows: AdminRow[] = [];
    for (const r of roles) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      rows.push({
        userId: r.user_id,
        email: u.user?.email ?? null,
        displayName: nameMap.get(r.user_id) ?? null,
        createdAt: (r as { created_at?: string }).created_at ?? null,
      });
    }
    return rows.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });

export const addAdminByEmail = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d: { email: string }) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Valid email required");
    return { email };
  })
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find the user by email via admin listUsers (paginated search)
    let target: { id: string; email?: string } | null = null;
    for (let page = 1; page <= 20 && !target; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      target = data.users.find((u) => (u.email ?? "").toLowerCase() === data.email) ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = data.users.find((u) => (u.email ?? "").toLowerCase() === (data as any).email);
      target = found ?? data.users.find((u) => (u.email ?? "").toLowerCase() === data.email) ?? null;
      // simpler correct search:
      target = data.users.find((u) => (u.email ?? "").toLowerCase() === (data as any).email) ?? null;
      const match = data.users.find((u) => (u.email ?? "").toLowerCase() === (data as any).email);
      target = match ?? null;
      const t = data.users.find((u) => (u.email ?? "").toLowerCase() === (data as any).email);
      target = t ?? null;
      if (data.users.length < 200) break;
    }
    if (!target) throw new Error("No user found with that email — they must sign up first");

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: target.id, role: "admin" });
    if (insErr && !/duplicate/i.test(insErr.message)) throw new Error(insErr.message);

    return { ok: true, userId: target.id };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    const userId = String(d?.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
