// Public "Create your community" flow. Any signed-in user can spin up an org;
// they become its `owner`. Org starts in status=`draft`, not featured. The
// dashboard at /admin then locks until the owner runs the mint-token wizard.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const checkSlugAvailability = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const slug = slugify(data.slug);
    if (!SLUG_RE.test(slug)) return { slug, available: false, reason: "invalid" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return { slug, available: !existing, reason: existing ? ("taken" as const) : ("ok" as const) };
  });

const CreateInput = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().min(2).max(40),
  tagline: z.string().trim().max(140).optional().nullable(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be #rrggbb")
    .optional()
    .nullable(),
});

export const createCommunity = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const slug = slugify(data.slug);
    if (!SLUG_RE.test(slug)) throw new Error("invalid_slug");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Slug uniqueness guard (race-safe: DB unique constraint is the real gate)
    const { data: clash } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (clash) throw new Error("slug_taken");

    const { data: org, error: insertErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        tagline: data.tagline ?? null,
        accent_color: data.accentColor ?? null,
        status: "draft",
        is_featured: false,
        created_by: context.userId,
      })
      .select("id, slug, name")
      .single();
    if (insertErr || !org) {
      throw new Error(insertErr?.message ?? "create_failed");
    }

    const { error: memErr } = await supabaseAdmin
      .from("organization_members")
      .insert({ org_id: org.id, user_id: context.userId, role: "owner" });
    if (memErr) {
      // Roll back the org so we don't leave it orphaned & ownerless
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      throw new Error(memErr.message);
    }

    return { ok: true as const, orgId: org.id, slug: org.slug, name: org.name };
  });
