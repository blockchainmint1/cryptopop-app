import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * POP manager action: look up map coordinates for every active store that has
 * a street address but no pin yet. Runs as the signed-in admin (RLS applies).
 */
export const locateMerchants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await sb
      .from("merchants")
      .select("id, name, address")
      .eq("is_active", true)
      .not("address", "is", null)
      .or("lat.is.null,lng.is.null");
    if (error) throw error;

    const { geocodeAddress } = await import("./geocode.server");
    const placed: string[] = [];
    const missed: string[] = [];
    for (const m of data ?? []) {
      const hit = await geocodeAddress(m.address ?? "");
      if (!hit) {
        missed.push(m.name);
        continue;
      }
      const { error: upErr } = await sb.from("merchants").update({ lat: hit.lat, lng: hit.lng }).eq("id", m.id);
      if (upErr) missed.push(m.name);
      else placed.push(m.name);
    }
    return { placed, missed };
  });
