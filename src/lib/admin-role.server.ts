// "Admin" here means: can access the /admin console. That's true if the user
// is either (a) a global app admin (user_roles.role='admin'), or (b) an
// owner/admin of any organization. New community creators land in /admin
// immediately after running the public Create-Community wizard.
//
// "Gatekeeper" is a scoped role — can ONLY reach /admin/checkin to scan
// attendee QR codes at the door.
export async function checkAdminByUserId(userId: string | undefined | null) {
  if (!userId) return { isAdmin: false, isGatekeeper: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [rolesRes, orgRes] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "gatekeeper"]),
    supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (rolesRes.error) console.error("Role check failed", rolesRes.error);
  if (orgRes.error) console.error("Org-admin check failed", orgRes.error);

  const roles = new Set((rolesRes.data ?? []).map((r) => r.role));
  const isAdmin = roles.has("admin") || !!orgRes.data;
  const isGatekeeper = roles.has("gatekeeper");

  return { isAdmin, isGatekeeper };
}
