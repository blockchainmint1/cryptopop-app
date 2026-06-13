import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export type CrmContact = {
  email: string;
  full_name: string | null;
  mobile_number: string | null;
  has_account: boolean;
  has_wallet: boolean;
  signup_count: number;
  rsvp_count: number;
  checked_in_count: number;
  suppressed: boolean;
  sources: string[];
  last_seen_at: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e?: string | null) =>
  (e ?? "").trim().toLowerCase();

export const listCrmContacts = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().trim().max(254).optional(),
        limit: z.number().int().min(1).max(2000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Pull from all four sources in parallel
    const [signups, rsvps, wallets, suppressedRows] = await Promise.all([
      supabaseAdmin
        .from("event_signups")
        .select(
          "email, full_name, mobile_number, checked_in_at, signed_up_at",
        )
        .limit(20000),
      supabaseAdmin
        .from("event_rsvps")
        .select("email, full_name, contact_number, created_at, event_slug")
        .limit(20000),
      supabaseAdmin
        .from("email_wallets")
        .select("email, created_at")
        .limit(20000),
      supabaseAdmin.from("suppressed_emails").select("email"),
    ]);

    // Auth users (for has_account)
    const accountEmails = new Set<string>();
    let page = 1;
    while (page <= 10) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: u, error } = await (supabaseAdmin.auth as any).admin.listUsers(
        { page, perPage: 1000 },
      );
      if (error) break;
      for (const usr of u?.users ?? []) {
        const e = norm(usr.email);
        if (e) accountEmails.add(e);
      }
      if (!u || u.users.length < 1000) break;
      page += 1;
    }

    const map = new Map<string, CrmContact>();
    const upsert = (email: string, patch: Partial<CrmContact>, source: string) => {
      const e = norm(email);
      if (!e || !EMAIL_RE.test(e)) return;
      let cur = map.get(e);
      if (!cur) {
        cur = {
          email: e,
          full_name: null,
          mobile_number: null,
          has_account: accountEmails.has(e),
          has_wallet: false,
          signup_count: 0,
          rsvp_count: 0,
          checked_in_count: 0,
          suppressed: false,
          sources: [],
          last_seen_at: null,
        };
        map.set(e, cur);
      }
      Object.assign(cur, patch);
      if (!cur.sources.includes(source)) cur.sources.push(source);
    };

    for (const r of signups.data ?? []) {
      const e = norm(r.email);
      if (!e) continue;
      upsert(
        e,
        {
          full_name: r.full_name ?? null,
          mobile_number: r.mobile_number ?? null,
        },
        "signup",
      );
      const c = map.get(e)!;
      c.signup_count += 1;
      if (r.checked_in_at) c.checked_in_count += 1;
      const ts = r.signed_up_at ?? null;
      if (ts && (!c.last_seen_at || ts > c.last_seen_at)) c.last_seen_at = ts;
    }

    for (const r of rsvps.data ?? []) {
      const e = norm(r.email);
      if (!e) continue;
      upsert(
        e,
        {
          full_name: r.full_name ?? null,
          mobile_number: r.contact_number ?? null,
        },
        "rsvp",
      );
      const c = map.get(e)!;
      c.rsvp_count += 1;
      const ts = r.created_at ?? null;
      if (ts && (!c.last_seen_at || ts > c.last_seen_at)) c.last_seen_at = ts;
    }

    for (const r of wallets.data ?? []) {
      const e = norm(r.email);
      if (!e) continue;
      upsert(e, { has_wallet: true }, "wallet");
    }

    for (const e of accountEmails) {
      upsert(e, { has_account: true }, "account");
    }

    const suppSet = new Set(
      (suppressedRows.data ?? []).map((r) => norm(r.email)),
    );
    for (const c of map.values()) {
      if (suppSet.has(c.email)) c.suppressed = true;
    }

    let contacts = Array.from(map.values());
    if (data.search) {
      const s = data.search.toLowerCase();
      contacts = contacts.filter(
        (c) =>
          c.email.includes(s) ||
          (c.full_name ?? "").toLowerCase().includes(s) ||
          (c.mobile_number ?? "").toLowerCase().includes(s),
      );
    }
    contacts.sort((a, b) => {
      const at = a.last_seen_at ?? "";
      const bt = b.last_seen_at ?? "";
      return bt.localeCompare(at);
    });
    const total = contacts.length;
    contacts = contacts.slice(0, data.limit ?? 500);

    return { contacts, total };
  });
