import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

const MAX_HTML_BYTES = 500_000;
const MAX_RECIPIENTS = 70_000;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const validateBlast = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ recipientsRaw: z.string().min(1).max(2_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { expandRecipientTags } = await import("./recipient-tags");
    const { parseRecipients, findSuppressed } = await import("./blast.server");

    const { expanded, resolved } = await expandRecipientTags(
      supabaseAdmin,
      data.recipientsRaw,
    );
    const parsed = parseRecipients(expanded);
    if (parsed.valid.length > MAX_RECIPIENTS) {
      throw new Error(`Too many recipients (max ${MAX_RECIPIENTS}).`);
    }
    const suppressedSet = await findSuppressed(parsed.valid);
    const will = parsed.valid.filter((e) => !suppressedSet.has(e));
    return {
      validCount: parsed.valid.length,
      invalid: parsed.invalid.slice(0, 50),
      invalidCount: parsed.invalid.length,
      duplicates: parsed.duplicates,
      suppressed: Array.from(suppressedSet),
      willSend: will.length,
      willSendSample: will.slice(0, 10),
      resolvedTags: resolved,
    };
  });

export const sendBlastTest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subject: z.string().trim().min(1).max(200),
        html: z.string().min(1).max(MAX_HTML_BYTES),
        fromName: z.string().trim().min(1).max(80),
        fromEmail: z.string().trim().email().max(200),
        replyTo: z.string().trim().email().max(200).optional(),
        testEmail: z.string().trim().email().max(254),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { sendBlastOne } = await import("./blast.server");
    const campaignId = `test-${randomUUID()}`;
    const result = await sendBlastOne({
      campaignId,
      subject: data.subject,
      html: data.html,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo,
      email: data.testEmail.toLowerCase(),
    });
    if (!result.ok) throw new Error(`Test send failed: ${result.error}`);
    return { messageId: result.messageId };
  });

export const previewBlast = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        html: z.string().min(1).max(MAX_HTML_BYTES),
        sampleEmail: z.string().trim().email().max(254),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { ensureUnsubscribeToken, wrapWithFooter } = await import(
      "./blast.server"
    );
    const token = await ensureUnsubscribeToken(data.sampleEmail.toLowerCase());
    const url = `https://cryptopop.org/unsubscribe?token=${encodeURIComponent(token)}`;
    return { html: wrapWithFooter(data.html, url) };
  });

export const sendBlast = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subject: z.string().trim().min(1).max(200),
        previewText: z.string().trim().max(200).optional(),
        html: z.string().min(1).max(MAX_HTML_BYTES),
        fromName: z.string().trim().min(1).max(80),
        fromEmail: z.string().trim().email().max(200),
        replyTo: z.string().trim().email().max(200).optional(),
        recipientsRaw: z.string().min(1).max(2_000_000),
        confirmText: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.confirmText !== "CONFIRM") {
      throw new Error("You must type CONFIRM to send the blast.");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { expandRecipientTags } = await import("./recipient-tags");
    const { parseRecipients, findSuppressed, enqueuePendingRecipients } =
      await import("./blast.server");

    const { expanded } = await expandRecipientTags(
      supabaseAdmin,
      data.recipientsRaw,
    );
    const parsed = parseRecipients(expanded);
    if (parsed.valid.length === 0) throw new Error("No valid recipients.");
    if (parsed.valid.length > MAX_RECIPIENTS) {
      throw new Error(`Too many recipients (max ${MAX_RECIPIENTS}).`);
    }
    const suppressedSet = await findSuppressed(parsed.valid);
    const queue = parsed.valid.filter((e) => !suppressedSet.has(e));
    if (queue.length === 0) {
      throw new Error("Every recipient is on the suppression list.");
    }

    const campaignId = randomUUID();
    await supabaseAdmin.from("blast_campaigns").insert({
      campaign_id: campaignId,
      subject: data.subject,
      preview_text: data.previewText ?? null,
      html: data.html,
      from_name: data.fromName,
      from_email: data.fromEmail,
      reply_to: data.replyTo ?? null,
      recipients_raw: data.recipientsRaw,
      total_recipients: queue.length,
      created_by: context.userId,
      sent_at: new Date().toISOString(),
    });

    await enqueuePendingRecipients(campaignId, queue);

    // Fire-and-forget kick the drainer
    try {
      const origin =
        process.env.SITE_URL || "https://cryptopop.org";
      void fetch(`${origin}/api/public/hooks/blast-drain`, {
        method: "POST",
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    return {
      campaignId,
      queued: queue.length,
      skippedSuppressed: suppressedSet.size,
    };
  });

export const getBlastProgress = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ campaignId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const statuses = [
      "pending",
      "sending",
      "sent",
      "failed",
      "suppressed",
    ] as const;
    const counts: Record<string, number> = Object.fromEntries(
      statuses.map((s) => [s, 0]),
    );
    const countResults = await Promise.all(
      statuses.map((s) =>
        supabaseAdmin
          .from("blast_recipients")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", data.campaignId)
          .eq("status", s),
      ),
    );
    let total = 0;
    statuses.forEach((s, i) => {
      const c = countResults[i].count ?? 0;
      counts[s] = c;
      total += c;
    });
    const { data: recent } = await supabaseAdmin
      .from("blast_recipients")
      .select("status, email, error_message, sent_at")
      .eq("campaign_id", data.campaignId)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(25);
    return { counts, total, recent: recent ?? [] };
  });

export const listBlastCampaigns = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ limit: z.number().int().min(1).max(100).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: rows, error } = await supabaseAdmin
      .from("blast_campaigns")
      .select(
        "campaign_id, subject, from_name, from_email, reply_to, total_recipients, sent_at, finished_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getBlastCampaign = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ campaignId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
      .from("blast_campaigns")
      .select(
        "campaign_id, subject, preview_text, html, from_name, from_email, reply_to, recipients_raw, total_recipients, created_at",
      )
      .eq("campaign_id", data.campaignId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Campaign not found.");
    return row;
  });

// ============ Templates ============

const templateBody = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().max(200).optional(),
  previewText: z.string().trim().max(200).optional(),
  html: z.string().min(1).max(MAX_HTML_BYTES),
  notes: z.string().trim().max(500).optional(),
});

export const listEmailTemplates = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: rows, error } = await supabaseAdmin
      .from("email_templates")
      .select(
        "id, name, subject, preview_text, html, notes, created_at, updated_at",
      )
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const createEmailTemplate = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => templateBody.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
      .from("email_templates")
      .insert({
        name: data.name,
        subject: data.subject ?? null,
        preview_text: data.previewText ?? null,
        html: data.html,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateEmailTemplate = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    templateBody.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({
        name: data.name,
        subject: data.subject ?? null,
        preview_text: data.previewText ?? null,
        html: data.html,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Suppressions ============

export const listSuppressions = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().trim().max(254).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    let q = supabaseAdmin
      .from("suppressed_emails")
      .select("email, reason, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.search) q = q.ilike("email", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const addSuppression = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(254),
        reason: z.enum(["unsubscribe", "bounce", "complaint"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("suppressed_emails")
      .upsert(
        { email: data.email.toLowerCase(), reason: data.reason ?? "unsubscribe" },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSuppression = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().trim().email().max(254) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("suppressed_emails")
      .delete()
      .eq("email", data.email.toLowerCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });
