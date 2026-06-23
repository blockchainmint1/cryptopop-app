// "Admin" here means: can access the /admin console. That's true if the user
// is either (a) a global app admin (user_roles.role='admin'), or (b) an
// owner/admin of any organization. New community creators land in /admin
// immediately after running the public Create-Community wizard.
export async function checkAdminByUserId(userId: string | undefined | null) {
  if (!userId) return { isAdmin: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [roleRes, orgRes] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (roleRes.error) console.error("Admin role check failed", roleRes.error);
  if (orgRes.error) console.error("Org-admin check failed", orgRes.error);

  return { isAdmin: !!roleRes.data || !!orgRes.data };
}
