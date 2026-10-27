// Telegram bot updates: card approval buttons and "/start CODE" enrollment.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const s = await import("@/lib/nfc-card.server");
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!s.safeEqual(got, await s.telegramSecret())) return new Response("Unauthorized", { status: 401 });
        const u = (await request.json().catch(() => ({}))) as any;
        const sb = await s.admin();

        const cb = u.callback_query;
        if (cb && typeof cb.data === "string") {
          const m = /^nfc:(a|d):([0-9a-f-]{36})$/.exec(cb.data);
          const chat = String(cb.message?.chat?.id ?? "");
          if (m && chat) {
            const { data } = await sb.rpc("nfc_claim_approval", { p_payment: m[2], p_chat: chat, p_approve: m[1] === "a" });
            const row = data?.[0];
            let note = "This request expired or was already handled.";
            if (row && m[1] === "d") note = "Declined.";
            if (row && m[1] === "a") {
              const r = await s.executePayment(row.id);
              note = r.status === "sent" ? "Approved and paid ✅" : `Approved, but payment failed: ${r.reason ?? ""}`;
            }
            await s.tg("answerCallbackQuery", { callback_query_id: cb.id, text: note.slice(0, 190) });
            await s.tg("editMessageReplyMarkup", { chat_id: chat, message_id: cb.message?.message_id, reply_markup: { inline_keyboard: [] } });
          }
          return Response.json({ ok: true });
        }

        const msg = u.message;
        const text: string = msg?.text ?? "";
        const code = /^\/start\s+(CP[A-Z0-9]{8})$/.exec(text.trim())?.[1];
        if (code && msg?.chat?.id) {
          const { data } = await sb.from("nfc_cards").update({ tg_chat_id: String(msg.chat.id), tg_code: null })
            .eq("tg_code", code).is("killed_at", null).select("label");
          await s.tg("sendMessage", {
            chat_id: msg.chat.id,
            text: data?.length ? `You'll now get tap alerts and approvals for "${data[0].label}".` : "That code didn't match a card. Make a new one in CryptoPOP → NFC Cards.",
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
