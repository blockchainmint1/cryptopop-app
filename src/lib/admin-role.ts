import { supabase } from "@/integrations/supabase/client";

export async function checkIsAdmin(userId: string | undefined | null) {
  if (!userId) return false;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("Admin role check failed", error);
    return false;
  }

  return !!data;
}