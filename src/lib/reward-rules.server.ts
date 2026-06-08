// Server-only helper to read configured POP amounts for an action.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getRewardAmount(
  actionKey: string,
  fallback: number,
): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from("reward_rules")
      .select("pop_amount, enabled")
      .eq("action_key", actionKey)
      .maybeSingle();
    if (!data) return fallback;
    if (!data.enabled) return 0;
    return Number(data.pop_amount);
  } catch (e) {
    console.error("[getRewardAmount]", actionKey, e);
    return fallback;
  }
}
