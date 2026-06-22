import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendSesEmail, htmlToText, FROM_EMAIL } from "./ses.server";

const SITE_URL = "https://cryptopop.org";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipients(raw: string): {
  valid: string[];
  invalid: string[];
  duplicates: number;
} {
  const seen = new Set<string>();
  let duplicates = 0;
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const tok of raw.split(/[\s,;]+/)) {
    const t = tok.trim().toLowerCase();
    if (!t) continue;
    if (t.startsWith("#")) continue; // unresolved tag, ignore
    if (!EMAIL_RE.test(t) || t.length > 254) {
      invalid.push(tok.trim());
      continue;
    }
    if (seen.has(t)) {
      duplicates += 1;
      continue;
    }
    seen.add(t);
    valid.push(t);
  }
  return { valid, invalid, duplicates };
}

export async function findSuppressed(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const suppressed = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const slice = emails.slice(i, i + 500);
    const { data, error } = await supabaseAdmin
      .from("suppressed_emails")
      .select("email")
      .in("email", slice);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) suppressed.add(r.email.toLowerCase());
  }
  return suppressed;
}

export async function ensureUnsubscribeToken(email: string): Promise<string> {
  const lower = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", lower)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .insert({ email: lower, token });
  if (error) {
    const { data: retry } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", lower)
      .maybeSingle();
    if (retry?.token) return retry.token;
    throw new Error(error.message);
  }
  return token;
}

export function wrapWithFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #2a1f3d;">
  <tr><td style="padding:16px 24px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888;line-height:1.5;">
    You're receiving this because you signed up to a CryptoPOP event.<br/>
    <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a> &middot;
    <a href="${SITE_URL}" style="color:#888;text-decoration:underline;">cryptopop.org</a>
  </td></tr>
</table>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return html + footer;
}

export type SendOneResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

async function markRecipient(
  recipientId: string,
  patch: {
    status?: string;
    error_message?: string | null;
    ses_message_id?: string | null;
    sent_at?: string | null;
    attempts?: number;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("blast_recipients")
    .update(patch)
    .eq("id", recipientId);
  if (error) console.error("[blast_recipients] update failed", error.message);
}

export async function enqueuePendingRecipients(
  campaignId: string,
  emails: string[],
): Promise<{ inserted: number; alreadyDone: number }> {
  if (emails.length === 0) return { inserted: 0, alreadyDone: 0 };
  const lower = Array.from(new Set(emails.map((e) => e.toLowerCase())));

  const existing = new Set<string>();
  for (let i = 0; i < lower.length; i += 500) {
    const slice = lower.slice(i, i + 500);
    const { data, error } = await supabaseAdmin
      .from("blast_recipients")
      .select("email")
      .eq("campaign_id", campaignId)
      .in("email", slice);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) existing.add(r.email.toLowerCase());
  }

  const todo = lower.filter((e) => !existing.has(e));
  if (todo.length === 0) return { inserted: 0, alreadyDone: existing.size };

  for (let i = 0; i < todo.length; i += 500) {
    const slice = todo.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("blast_recipients").insert(
      slice.map((email) => ({
        campaign_id: campaignId,
        email,
        status: "pending",
      })),
    );
    if (error) console.error("[enqueue] insert failed", error.message);
  }
  return { inserted: todo.length, alreadyDone: existing.size };
}

type CampaignBlast = {
  campaign_id: string;
  subject: string;
  html: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
};

export async function drainPendingBlasts(opts: {
  maxEmails?: number;
  maxMs?: number;
  concurrency?: number;
}): Promise<{
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  campaigns: string[];
}> {
  const maxEmails = opts.maxEmails ?? 1200;
  const maxMs = opts.maxMs ?? 50_000;
  const concurrency = opts.concurrency ?? 14;
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let scanned = 0;
  const seenCampaigns = new Set<string>();
  const campaignCache = new Map<string, CampaignBlast | null>();

  await supabaseAdmin
    .from("blast_recipients")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - 5 * 60_000).toISOString());

  const PAGE = 1000;
  const collected: { id: string; campaign_id: string; email: string }[] = [];
  while (collected.length < maxEmails) {
    const remaining = maxEmails - collected.length;
    const take = Math.min(PAGE, remaining);
    const { data: page, error } = await supabaseAdmin
      .from("blast_recipients")
      .select("id, campaign_id, email")
      .eq("status", "pending")
      .order("queued_at", { ascending: true })
      .range(collected.length, collected.length + take - 1);
    if (error) throw new Error(error.message);
    if (!page || page.length === 0) break;
    collected.push(...page);
    if (page.length < take) break;
  }

  if (collected.length === 0) {
    return { scanned: 0, sent: 0, failed: 0, skipped: 0, campaigns: [] };
  }

  const ids = collected.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    await supabaseAdmin
      .from("blast_recipients")
      .update({ status: "sending", attempts: 1 })
      .in("id", ids.slice(i, i + 500))
      .eq("status", "pending");
  }

  const uniqueEmails = Array.from(
    new Set(collected.map((r) => r.email.toLowerCase())),
  );
  const suppressed = await findSuppressed(uniqueEmails);

  const tokenMap = new Map<string, string>();
  for (let i = 0; i < uniqueEmails.length; i += 500) {
    const slice = uniqueEmails.slice(i, i + 500);
    const { data } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("email, token")
      .in("email", slice);
    for (const r of data ?? []) tokenMap.set(r.email.toLowerCase(), r.token);
  }
  const missingTokens = uniqueEmails.filter((e) => !tokenMap.has(e));
  if (missingTokens.length > 0) {
    for (let i = 0; i < missingTokens.length; i += 500) {
      const slice = missingTokens.slice(i, i + 500);
      const rows = slice.map((email) => ({
        email,
        token: randomBytes(24).toString("base64url"),
      }));
      const { data, error } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .insert(rows)
        .select("email, token");
      if (error) {
        const { data: refetch } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("email, token")
          .in("email", slice);
        for (const r of refetch ?? [])
          tokenMap.set(r.email.toLowerCase(), r.token);
      } else {
        for (const r of data ?? []) tokenMap.set(r.email.toLowerCase(), r.token);
      }
    }
  }

  const campaignIds = Array.from(new Set(collected.map((r) => r.campaign_id)));
  if (campaignIds.length > 0) {
    const { data: campRows } = await supabaseAdmin
      .from("blast_campaigns")
      .select("campaign_id, subject, html, from_name, from_email, reply_to")
      .in("campaign_id", campaignIds);
    for (const c of (campRows ?? []) as CampaignBlast[]) {
      campaignCache.set(c.campaign_id, c);
    }
    for (const cid of campaignIds) {
      if (!campaignCache.has(cid)) campaignCache.set(cid, null);
    }
  }

  const queue = collected.slice();

  async function worker() {
    while (true) {
      if (Date.now() - started > maxMs) return;
      const row = queue.shift();
      if (!row) return;
      scanned += 1;
      seenCampaigns.add(row.campaign_id);

      const campaign = campaignCache.get(row.campaign_id) ?? null;
      if (!campaign) {
        await markRecipient(row.id, {
          status: "failed",
          error_message: "Campaign archive missing",
          sent_at: new Date().toISOString(),
        });
        failed += 1;
        continue;
      }

      const lower = row.email.toLowerCase();
      if (suppressed.has(lower)) {
        await markRecipient(row.id, {
          status: "suppressed",
          sent_at: new Date().toISOString(),
        });
        skipped += 1;
        continue;
      }

      const token = tokenMap.get(lower);
      if (!token) {
        await markRecipient(row.id, {
          status: "failed",
          error_message: "Unsubscribe token unavailable",
          sent_at: new Date().toISOString(),
        });
        failed += 1;
        continue;
      }

      const unsubUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
      const fullHtml = wrapWithFooter(campaign.html, unsubUrl);
      const fromAddr = campaign.from_email || FROM_EMAIL;
      const from = `${campaign.from_name} <${fromAddr}>`;

      try {
        const res = await sendSesEmail({
          from,
          to: row.email,
          subject: campaign.subject,
          html: fullHtml,
          text: htmlToText(fullHtml),
          replyTo: campaign.reply_to || undefined,
          headers: [
            { Name: "List-Unsubscribe", Value: `<${unsubUrl}>` },
            {
              Name: "List-Unsubscribe-Post",
              Value: "List-Unsubscribe=One-Click",
            },
          ],
        });
        await markRecipient(row.id, {
          status: "sent",
          ses_message_id: res.id,
          sent_at: new Date().toISOString(),
        });
        sent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markRecipient(row.id, {
          status: "failed",
          error_message: msg.slice(0, 1000),
          sent_at: new Date().toISOString(),
        });
        console.error(
          `[blast ${campaign.campaign_id}] send to ${row.email} failed:`,
          msg,
        );
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  for (const cid of seenCampaigns) {
    const { count: remaining } = await supabaseAdmin
      .from("blast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", cid)
      .in("status", ["pending", "sending"]);
    if (!remaining) {
      await supabaseAdmin
        .from("blast_campaigns")
        .update({ finished_at: new Date().toISOString() })
        .eq("campaign_id", cid)
        .is("finished_at", null);
    }
  }

  return {
    scanned,
    sent,
    failed,
    skipped,
    campaigns: Array.from(seenCampaigns),
  };
}

export async function sendBlastOne(opts: {
  campaignId: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail?: string;
  replyTo?: string | null;
  email: string;
  recipientId?: string;
}): Promise<SendOneResult> {
  const {
    campaignId,
    subject,
    html,
    fromName,
    fromEmail,
    replyTo,
    email,
    recipientId,
  } = opts;

  const token = await ensureUnsubscribeToken(email);
  const unsubUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
  const fullHtml = wrapWithFooter(html, unsubUrl);
  const fromAddr = fromEmail || FROM_EMAIL;
  const from = `${fromName} <${fromAddr}>`;

  try {
    const res = await sendSesEmail({
      from,
      to: email,
      subject,
      html: fullHtml,
      text: htmlToText(fullHtml),
      replyTo: replyTo || undefined,
      headers: [
        { Name: "List-Unsubscribe", Value: `<${unsubUrl}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ],
    });
    if (recipientId) {
      await markRecipient(recipientId, {
        status: "sent",
        ses_message_id: res.id,
        sent_at: new Date().toISOString(),
      });
    }
    return { ok: true, messageId: res.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (recipientId) {
      await markRecipient(recipientId, {
        status: "failed",
        error_message: msg.slice(0, 1000),
        sent_at: new Date().toISOString(),
      });
    }
    console.error(`[blast ${campaignId}] send to ${email} failed:`, msg);
    return { ok: false, error: msg };
  }
}
