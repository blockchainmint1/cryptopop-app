// Public, read-only fetch for the RSVP page so admin edits to an event's
// description/name flow through to the public page without a redeploy.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicEventDb = {
  slug: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  lat: number;
  lng: number;
} | null;

export const getPublicEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<PublicEventDb> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("events")
      .select("slug, name, description, start_at, end_at, lat, lng")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return null;
    if (!row || !row.slug) return null;
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      start_at: row.start_at,
      end_at: row.end_at,
      lat: Number(row.lat),
      lng: Number(row.lng),
    };
  });
