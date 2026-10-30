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
        // Read the real invoice from NectarPay — amount and destination come from them, not the caller.
        const chatP = s.walletChat(card.owner_address);
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
        // PIN only above the owner's per-card amount (0 = every tap).
        if (!(Number(inv.fiatAmount) <= Number(card.pin_above_usd ?? 0))) {
          if (!input.pin) return json({ status: "pin_required" });
          const { hash } = await s.hashPin(input.pin, card.pin_salt);
          const ok = s.safeEqual(hash, card.pin_hash);
          const { data: fails } = await sb.rpc("nfc_record_pin", { p_card: card.id, p_ok: ok });
          if (!ok) {
            if ((fails ?? 0) >= 5) await s.notify(await chatP, `🔒 ${card.label} locked after 5 wrong PINs.`);
            return json({ status: "pin_required", reason: "Wrong PIN" });
          }
        }
        const ownerChat = await chatP;
        if (inv.status !== "pending") return json({ status: "declined", reason: `Invoice is ${inv.status}` });
        if (inv.currency.toUpperCase() !== "USD") return json({ status: "declined", reason: "Only USD invoices" });
        if (!inv.address || !inv.tsdAmount || !/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(inv.address))
          return json({ status: "declined", reason: "Store isn't accepting TSD" });
        if (!(inv.tsdAmount > 0) || Math.abs(inv.tsdAmount - inv.fiatAmount) > inv.fiatAmount * 0.01)
          return json({ status: "declined", reason: "Invoice amount mismatch" });

        const { data: res, error } = await sb.rpc("nfc_reserve_payment", {
          p_card: card.id, p_invoice: inv.id || input.invoice_id, p_merchant: inv.merchant?.name ?? "",
          p_usd: inv.fiatAmount, p_tsd: inv.tsdAmount, p_recipient: inv.address,
        });
        const row = res?.[0];
        if (error || !row) {
          const msg = error?.message ?? "no row returned";
          console.error("[card/pay] reserve failed:", msg);
          const dup = /duplicate|unique/i.test(msg);
          const off = /card is off/i.test(msg);
          return json({ status: "declined", reason: dup ? "This invoice is already being paid" : off ? "Card is off" : "Card payment couldn't start — try again" });
        }
        // eGiving: split only if the store is in Give AND the card owner picked a Give recipient.
        if (inv.egiving?.accepted) {
          const { data: gr } = await sb.from("give_recipients").select("charity_code").eq("owner_address", card.owner_address).maybeSingle();
          const { giveSplitFor } = await import("@/lib/give/split-rule");
          const sp = giveSplitFor({ egiving: inv.egiving, recipientCode: gr?.charity_code ?? null, total: inv.tsdAmount, merchant: inv.address });
          if (sp) await sb.from("nfc_card_payments").update({ give_discount_pct: sp.discountPct }).eq("id", row.payment_id);
        }
        if (row.status === "approval_required") {
          if (!ownerChat) {
            await sb.from("nfc_card_payments").update({ status: "declined", reason: "Over limit and no Telegram approver" }).eq("id", row.payment_id);
            return json({ status: "declined", payment_id: row.payment_id, reason: "Over the card's limit" });
          }
          await s.askApproval(ownerChat, { id: row.payment_id, amount_usd: inv.fiatAmount, merchant_name: inv.merchant?.name ?? null }, card.label);
          return json({ status: "approval_required", payment_id: row.payment_id });
        }
        const out = await s.executePayment(row.payment_id, { card, chat: ownerChat });
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
