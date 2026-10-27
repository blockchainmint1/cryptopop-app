// NectarPay → CryptoPOP tap-to-pay. Server-to-server only, HMAC-signed.
// POST signs the raw body; GET signs the payment id.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  card_uid: z.string().min(4).max(64),
  invoice_id: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  nonce: z.string().min(1).max(200).regex(/^[A-Za-z0-9_.~-]+$/),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const Route = createFileRoute("/api/public/card/pay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 4096) return json({ status: "declined", reason: "Request too large" }, 413);
        const s = await import("@/lib/nfc-card.server");
        if (!(await s.verifyPartner(request.headers.get("x-hme-timestamp"), request.headers.get("x-hme-signature"), raw)))
          return json({ status: "declined", reason: "Bad signature" }, 401);
        let input: z.infer<typeof Body>;
        try {
          input = Body.parse(JSON.parse(raw));
        } catch {
          return json({ status: "declined", reason: "Invalid request" }, 400);
        }
        const sb = await s.admin();
        const { data: card } = await sb.from("nfc_cards").select("*").eq("uid_hash", await s.hashUid(input.card_uid)).maybeSingle();
        if (!card || card.killed_at) return json({ status: "declined", reason: "Card not recognized" });
        if (!card.enabled) return json({ status: "declined", reason: "Card is turned off" });
        if (card.pin_fails >= 5) return json({ status: "declined", reason: "Card locked after wrong PINs — owner must unlock" });
        if (!input.pin) return json({ status: "pin_required" });
        const { hash } = await s.hashPin(input.pin, card.pin_salt);
        const ok = s.safeEqual(hash, card.pin_hash);
        const { data: fails } = await sb.rpc("nfc_record_pin", { p_card: card.id, p_ok: ok });
        if (!ok) {
          if ((fails ?? 0) >= 5) await s.notify(card.tg_chat_id, `🔒 ${card.label} locked after 5 wrong PINs.`);
          return json({ status: "pin_required", reason: "Wrong PIN" });
        }

        // Read the real invoice from NectarPay — amount and destination come from them, not the caller.
        const np = await import("@/lib/nectarpay.functions");
        let inv;
        try {
          const before = np.normalize(await np.fetchJson(np.invoiceUrl(input.invoice_id, input.nonce)));
          inv = before.address && before.tsdAmount ? before
            : np.normalize(await np.fetchJson(np.invoiceUrl(input.invoice_id, input.nonce, true), {
                method: "POST", body: JSON.stringify({ option: "txc:TSD" }),
              }), before);
        } catch (e) {
          return json({ status: "declined", reason: (e as Error).message || "Invoice unavailable" });
        }
        if (inv.status !== "pending") return json({ status: "declined", reason: `Invoice is ${inv.status}` });
        if (inv.currency.toUpperCase() !== "USD") return json({ status: "declined", reason: "Only USD invoices" });
        if (!inv.address || !inv.tsdAmount || !/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(inv.address))
          return json({ status: "declined", reason: "Store isn't accepting TSD" });
        if (!(inv.tsdAmount > 0) || Math.abs(inv.tsdAmount - inv.fiatAmount) > inv.fiatAmount * 0.01)
          return json({ status: "declined", reason: "Invoice amount mismatch" });

        const { data: res, error } = await sb.rpc("nfc_reserve_payment", {
          p_card: card.id, p_invoice: inv.id || input.invoice_id, p_merchant: inv.merchant?.name ?? null,
          p_usd: inv.fiatAmount, p_tsd: inv.tsdAmount, p_recipient: inv.address,
        });
        const row = res?.[0];
        if (error || !row) {
          const dup = /duplicate|unique/i.test(error?.message ?? "");
          return json({ status: "declined", reason: dup ? "This invoice is already being paid" : "Card is off" });
        }
        if (row.status === "approval_required") {
          if (!card.tg_chat_id) {
            await sb.from("nfc_card_payments").update({ status: "declined", reason: "Over limit and no Telegram approver" }).eq("id", row.payment_id);
            return json({ status: "declined", payment_id: row.payment_id, reason: "Over the card's limit" });
          }
          await s.askApproval(card.tg_chat_id, { id: row.payment_id, amount_usd: inv.fiatAmount, merchant_name: inv.merchant?.name ?? null }, card.label);
          return json({ status: "approval_required", payment_id: row.payment_id });
        }
        const out = await s.executePayment(row.payment_id);
        return json({ ...out, payment_id: row.payment_id });
      },

      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ status: "declined", reason: "Bad id" }, 400);
        const s = await import("@/lib/nfc-card.server");
        if (!(await s.verifyPartner(request.headers.get("x-hme-timestamp"), request.headers.get("x-hme-signature"), id)))
          return json({ status: "declined", reason: "Bad signature" }, 401);
        const sb = await s.admin();
        const { data: p } = await sb.from("nfc_card_payments").select("id,status,reason,txid").eq("id", id).maybeSingle();
        if (!p) return json({ status: "declined", reason: "Unknown payment" }, 404);
        return json({ payment_id: p.id, status: p.status, reason: p.reason, txid: p.txid });
      },
    },
  },
});
