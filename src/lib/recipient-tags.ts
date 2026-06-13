import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Audience tags that can be inlined in the recipients textarea on
 * /admin/blast. The tag is replaced with a comma-separated list of
 * unique CryptoPOP contact emails when the blast is validated and sent.
 */
export const RECIPIENT_TAGS = {
  "#all": "all",
  "#signups": "signups",
  "#rsvps": "rsvps",
  "#has-account": "has-account",
  "#has-wallet": "has-wallet",
  "#checked-in": "checked-in",
} as const;

export type RecipientTag = keyof typeof RECIPIENT_TAGS;
export type CryptoPopAudience = (typeof RECIPIENT_TAGS)[RecipientTag];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATIC_TAG_RE = (tag: string) =>
  new RegExp(`(^|[\\s,;])${escapeRegex(tag)}(?=$|[\\s,;])`, "gi");

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findRecipientTags(raw: string): RecipientTag[] {
  const found: RecipientTag[] = [];
  const lower = raw.toLowerCase();
  for (const tag of Object.keys(RECIPIENT_TAGS) as RecipientTag[]) {
    if (new RegExp(`(^|[\\s,;])${tag}(?=$|[\\s,;])`, "i").test(lower)) {
      found.push(tag);
    }
  }
  return found;
}

/** Tags like `#event:<uuid>` or `#rsvp:<slug>` for per-event audiences. */
function findParamTags(raw: string): Array<{ kind: "event" | "rsvp"; arg: string; raw: string }> {
  const out: Array<{ kind: "event" | "rsvp"; arg: string; raw: string }> = [];
  const re = /(?:^|[\s,;])#(event|rsvp):([a-z0-9_-]+)(?=$|[\s,;])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out.push({
      kind: m[1].toLowerCase() as "event" | "rsvp",
      arg: m[2],
      raw: `#${m[1].toLowerCase()}:${m[2]}`,
    });
  }
  return out;
}

async function pageAll<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pluck: (row: T) => string | null | undefined,
): Promise<string[]> {
  const PAGE = 1000;
  const out = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error((error as { message?: string }).message ?? "query failed");
    if (!data || data.length === 0) break;
    for (const r of data) {
      const e = (pluck(r) ?? "").trim().toLowerCase();
      if (e && EMAIL_RE.test(e) && e.length <= 254) out.add(e);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return [...out];
}

export async function emailsForAudience(
  supabaseAdmin: SupabaseClient,
  audience: CryptoPopAudience,
): Promise<string[]> {
  switch (audience) {
    case "signups":
      return pageAll(
        (a, b) =>
          supabaseAdmin.from("event_signups").select("email").range(a, b),
        (r) => (r as { email: string }).email,
      );
    case "rsvps":
      return pageAll(
        (a, b) => supabaseAdmin.from("event_rsvps").select("email").range(a, b),
        (r) => (r as { email: string }).email,
      );
    case "has-account": {
      // profiles has no email; fetch auth users via service role
      const users: string[] = [];
      let page = 1;
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin.auth as any).admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw new Error(error.message);
        for (const u of data?.users ?? []) {
          const e = (u.email ?? "").trim().toLowerCase();
          if (e && EMAIL_RE.test(e)) users.push(e);
        }
        if (!data || data.users.length < 1000) break;
        page += 1;
      }
      return Array.from(new Set(users));
    }
    case "has-wallet":
      return pageAll(
        (a, b) => supabaseAdmin.from("email_wallets").select("email").range(a, b),
        (r) => (r as { email: string }).email,
      );
    case "checked-in":
      return pageAll(
        (a, b) =>
          supabaseAdmin
            .from("event_signups")
            .select("email")
            .not("checked_in_at", "is", null)
            .range(a, b),
        (r) => (r as { email: string }).email,
      );
    case "all": {
      const [s, r, w] = await Promise.all([
        emailsForAudience(supabaseAdmin, "signups"),
        emailsForAudience(supabaseAdmin, "rsvps"),
        emailsForAudience(supabaseAdmin, "has-wallet"),
      ]);
      return Array.from(new Set([...s, ...r, ...w]));
    }
    default:
      return [];
  }
}

async function emailsForEvent(
  supabaseAdmin: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  // Best effort: event_signups isn't directly tied to events.id in this
  // schema, so we treat #event:<id> as "all signups" for now and refine
  // later when an event_id column is added.
  // For RSVPs we filter by event_slug below.
  return pageAll(
    (a, b) =>
      supabaseAdmin
        .from("event_signups")
        .select("email")
        .range(a, b),
    (r) => (r as { email: string }).email,
  ).then((all) => {
    void eventId;
    return all;
  });
}

async function emailsForRsvpSlug(
  supabaseAdmin: SupabaseClient,
  slug: string,
): Promise<string[]> {
  return pageAll(
    (a, b) =>
      supabaseAdmin
        .from("event_rsvps")
        .select("email")
        .eq("event_slug", slug)
        .range(a, b),
    (r) => (r as { email: string }).email,
  );
}

export async function expandRecipientTags(
  supabaseAdmin: SupabaseClient,
  raw: string,
): Promise<{
  expanded: string;
  resolved: Array<{ tag: string; count: number }>;
}> {
  const staticTags = findRecipientTags(raw);
  const paramTags = findParamTags(raw);
  if (staticTags.length === 0 && paramTags.length === 0) {
    return { expanded: raw, resolved: [] };
  }
  let expanded = raw;
  const resolved: Array<{ tag: string; count: number }> = [];

  for (const tag of staticTags) {
    const audience = RECIPIENT_TAGS[tag];
    const emails = await emailsForAudience(supabaseAdmin, audience);
    resolved.push({ tag, count: emails.length });
    expanded = expanded.replace(
      STATIC_TAG_RE(tag),
      (_m, lead) => `${lead}${emails.join(", ")}`,
    );
  }

  for (const p of paramTags) {
    const emails =
      p.kind === "rsvp"
        ? await emailsForRsvpSlug(supabaseAdmin, p.arg)
        : await emailsForEvent(supabaseAdmin, p.arg);
    resolved.push({ tag: p.raw, count: emails.length });
    const re = new RegExp(
      `(^|[\\s,;])${escapeRegex(p.raw)}(?=$|[\\s,;])`,
      "gi",
    );
    expanded = expanded.replace(re, (_m, lead) => `${lead}${emails.join(", ")}`);
  }

  return { expanded, resolved };
}
