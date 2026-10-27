// Pulls NectarPay's public merchant directory into our own copy.
//
// NectarPay is the source of truth: we only ever add or refresh rows from their
// feed, and we only retire a store when they tell us it left the directory.
// Nothing here deletes rows, so a bad pull leaves the previous copy intact.
//
// Runs from three places: the hourly database timer (via /api/public/nectarpay-sync),
// the admin "Sync now" button, and the first wallet request after a cold start.
import { z } from "zod";
import { NECTARPAY_ORIGIN } from "./nectarpay";

export type SyncResult = {
  status: "ok" | "busy" | "fresh" | "error";
  written?: number;
  count?: number;
  removed?: number;
  geocoded?: number;
  error?: string;
};

/** Don't pull more often than this unless someone forces it (admin button). */
export const MIN_SYNC_MINUTES = 15;

/** Map lookups per run — keeps Google's quota safe while pins are still missing. */
const GEOCODE_BUDGET = 10;

const addressSchema = z
  .object({
    street: z.string().max(200).nullish(),
    city: z.string().max(120).nullish(),
    region: z.string().max(60).nullish(),
    postal_code: z.string().max(20).nullish(),
    country: z.string().max(60).nullish(),
  })
  .nullish();

const storeSchema = z.object({
  id: z.string().trim().min(1).max(64),
  slug: z.string().max(120).nullish(),
  name: z.string().max(200).nullish(),
  category: z.string().max(120).nullish(),
  description: z.string().max(2000).nullish(),
  logo_url: z.string().max(600).nullish(),
  presence: z.string().max(20).nullish(),
  listing: z.string().max(20).nullish(),
  status: z.string().max(20).nullish(),
  hours: z.string().max(400).nullish(),
  phone: z.string().max(40).nullish(),
  website: z.string().max(400).nullish(),
  accepts: z.array(z.string().max(20)).max(60).default([]),
  address: addressSchema,
  location: z.object({ lat: z.number(), lng: z.number() }).nullish(),
  updated_at: z.string().max(60).nullish(),
});

const directorySchema = z.object({
  generated_at: z.string().max(60),
  since: z.string().max(60).nullish(),
  count: z.number().int().min(0).max(200000),
  stores: z.array(storeSchema).max(50000),
  removed: z.array(z.string().max(64)).max(50000).default([]),
});

type FeedStore = z.infer<typeof storeSchema>;

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Only http(s) links ever reach the browser; anything else is dropped. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^https?:\/\//i.test(v) || v.length > 600) return null;
  return v;
}

function text(value: string | null | undefined, max = 200): string | null {
  const v = (value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function coins(list: string[] | undefined): string[] {
  return Array.from(new Set((list ?? []).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z0-9_-]{1,10}$/.test(c)))).slice(0, 60);
}

function toRow(s: FeedStore) {
  const a = s.address ?? {};
  return {
    id: s.id,
    slug: text(s.slug, 120),
    name: text(s.name, 200),
    category: text(s.category, 120),
    description: text(s.description, 2000),
    logo_url: safeUrl(s.logo_url),
    presence: text(s.presence, 20) ?? "physical",
    listing: text(s.listing, 20) ?? "city_only",
    status: text(s.status, 20) ?? "live",
    street: text(a?.street, 200),
    city: text(a?.city, 120),
    region: text(a?.region, 60),
    postal_code: text(a?.postal_code, 20),
    country: text(a?.country, 60),
    phone: text(s.phone, 40),
    website: safeUrl(s.website),
    hours: text(s.hours, 400),
    accepts: coins(s.accepts),
    lat: s.location?.lat ?? null,
    lng: s.location?.lng ?? null,
    source_updated_at: iso(s.updated_at),
    is_active: (text(s.status, 20) ?? "live") === "live",
  };
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Fill in map pins for stores the feed didn't place, street address first. */
async function placeMissingPins(sb: ReturnType<Awaited<typeof import "@/integrations/supabase/client.server">["supabaseAdmin"] extends never ? never : typeof import("@/integrations/supabase/client.server")["supabaseAdmin"]>, budget: number) {
  const { geocodeAddress } = await import("./geocode.server");
  const { data, error } = await sb
    .from("nectarpay_stores")
    .select("id, street, city, region, postal_code, country, listing")
    .eq("is_active", true)
    .is("lat", null)
    .limit(budget);
  if (error || !data?.length) return 0;

  let placed = 0;
  for (const row of data) {
    const parts =
      row.listing === "full" && row.street
        ? [row.street, row.city, row.region, row.postal_code, row.country]
        : [row.city, row.region, row.country];
    const query = parts.filter(Boolean).join(", ");
    if (query.length < 4) continue;
    const hit = await geocodeAddress(query);
    if (!hit) continue;
    const { error: upErr } = await sb
      .from("nectarpay_stores")
      .update({ lat: hit.lat, lng: hit.lng, pin_source: "geocoded" })
      .eq("id", row.id);
    if (!upErr) placed += 1;
  }
  return placed;
}

/**
 * Pull the feed and refresh our copy.
 *
 * `force` skips the "we just did this" guard so the admin button always works.
 * Returns `busy` when another run holds the lock, and `fresh` when the last
 * successful pull is still recent — both cost nothing.
 */
export async function runNectarpaySync({ force = false }: { force?: boolean } = {}): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin;

  const { data: state, error: stateError } = await sb
    .from("nectarpay_sync_state")
    .select("cursor, last_run_at, last_ok_at")
    .eq("id", 1)
    .single();
  if (stateError) return { status: "error", error: stateError.message };

  if (!force && state?.last_run_at && Date.now() - Date.parse(state.last_run_at) < MIN_SYNC_MINUTES * 60_000) {
    return { status: "fresh" };
  }

  const { data: claimed, error: claimError } = await sb.rpc("claim_nectarpay_sync", { p_minutes: 10 });
  if (claimError) return { status: "error", error: claimError.message };
  if (claimed !== true) return { status: "busy" };

  const finish = async (patch: Record<string, unknown>) => {
    await sb.from("nectarpay_sync_state").update({ ...patch, running_until: null }).eq("id", 1);
  };

  try {
    const cursor = iso(state?.cursor);
    const url = new URL("/api/public/v1/directory", NECTARPAY_ORIGIN);
    if (cursor) url.searchParams.set("since", cursor);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "cryptopop-wallet directory sync" },
    });
    if (!res.ok) throw new Error(`NectarPay feed returned ${res.status}`);

    const feed = directorySchema.parse(await res.json());
    const isFullPull = !cursor;
    const rows = feed.stores.map(toRow);

    let written = 0;
    for (const batch of chunks(rows, 100)) {
      const { data, error } = await sb.rpc("upsert_nectarpay_stores", { p_rows: batch, p_touch: isFullPull });
      if (error) throw new Error(error.message);
      written += Number(data ?? 0);
    }

    let retired = 0;
    for (const batch of chunks(feed.removed, 200)) {
      const { data, error } = await sb
        .from("nectarpay_stores")
        .update({ is_active: false, status: "removed" })
        .in("id", batch)
        .select("id");
      if (error) throw new Error(error.message);
      retired += data?.length ?? 0;
    }

    const geocoded = await placeMissingPins(sb, GEOCODE_BUDGET);

    await finish({
      cursor: iso(feed.generated_at) ?? new Date().toISOString(),
      last_run_at: new Date().toISOString(),
      last_ok_at: new Date().toISOString(),
      last_status: "ok",
      last_error: null,
      last_count: feed.count,
      last_removed: feed.removed.length,
    });

    return { status: "ok", written, count: feed.count, removed: retired, geocoded };
  } catch (e) {
    const message = (e as Error)?.message || "Directory sync failed";
    console.error("[nectarpay-sync]", message);
    await finish({
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_error: message.slice(0, 300),
    });
    return { status: "error", error: message };
  }
}
