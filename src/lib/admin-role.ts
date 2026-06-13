import { supabase } from "@/integrations/supabase/client";

export async function checkIsAdmin(userId: string | undefined | null) {
  if (!userId) return false;

  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("Admin role check failed", error);
    return false;
  }

  return data === true;
}