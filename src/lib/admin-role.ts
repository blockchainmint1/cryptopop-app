export async function checkAdminByUserId(userId: string | undefined | null) {
  if (!userId) return { isAdmin: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("Admin role check failed", error);
    return { isAdmin: false };
  }

  return { isAdmin: !!data };
}