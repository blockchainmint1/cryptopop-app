import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

type ManagedRole = "admin" | "gatekeeper";

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
  isSelf: boolean;
};

async function listRoleMembers(role: ManagedRole, callerId: string): Promise<AdminRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, created_at")
    .eq("role", role);
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
      isSelf: r.user_id === callerId,
    });
  }
  return rows.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 20; page++) {
    const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const match = pageData.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return match.id;
    if (pageData.users.length < 200) break;
  }
  return null;
}

async function addRoleByEmail(role: ManagedRole, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const targetId = await findUserIdByEmail(email);
  if (!targetId) throw new Error("No user found with that email — they must sign up first");
  const { error: insErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: targetId, role });
  if (insErr && !/duplicate/i.test(insErr.message)) throw new Error(insErr.message);
  return { ok: true, userId: targetId };
}

async function removeRoleById(role: ManagedRole, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  if (error) throw new Error(error.message);
  return { ok: true };
}

const emailValidator = (d: { email: string }) => {
  const email = String(d?.email ?? "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Valid email required");
  return { email };
};

const userIdValidator = (d: { userId: string }) => {
  const userId = String(d?.userId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
  return { userId };
};

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRow[]> => {
    await assertGlobalAdmin(context.userId);
    return listRoleMembers("admin", context.userId);
  });

export const addAdminByEmail = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator(emailValidator)
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    return addRoleByEmail("admin", data.email);
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator(userIdValidator)
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself");
    return removeRoleById("admin", data.userId);
  });

export const listGatekeepers = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRow[]> => {
    await assertGlobalAdmin(context.userId);
    return listRoleMembers("gatekeeper", context.userId);
  });

export const addGatekeeperByEmail = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator(emailValidator)
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    return addRoleByEmail("gatekeeper", data.email);
  });

export const removeGatekeeper = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator(userIdValidator)
  .handler(async ({ data, context }) => {
    await assertGlobalAdmin(context.userId);
    return removeRoleById("gatekeeper", data.userId);
  });
