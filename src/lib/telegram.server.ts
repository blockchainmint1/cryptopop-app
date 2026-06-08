// Server-only Telegram notifier via Lovable connector gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export async function sendTelegramMessage(opts: {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
}) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
    console.warn("[telegram] missing keys, skipping send");
    return;
  }
  try {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode ?? "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] send failed ${res.status}: ${body}`);
    }
  } catch (e) {
    console.error("[telegram] send error", e);
  }
}

export const SIGNUPS_CHAT_ID = "-1003747539274";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function notifyEventSignup(data: {
  fullName: string;
  email: string;
  mobile: string;
  instagram?: string | null;
  telegram?: string | null;
  isFriend: boolean;
  signupId: string;
}) {
  const lines = [
    `🎉 <b>New CryptoPOP signup</b>`,
    ``,
    `<b>${escapeHtml(data.fullName)}</b>`,
    `📧 ${escapeHtml(data.email)}`,
    `📱 ${escapeHtml(data.mobile)}`,
  ];
  if (data.instagram) lines.push(`📸 IG: @${escapeHtml(data.instagram)}`);
  if (data.telegram) lines.push(`💬 TG: @${escapeHtml(data.telegram)}`);
  lines.push(`👥 Bringing a friend: ${data.isFriend ? "Yes" : "No"}`);
  lines.push(``);
  lines.push(`<code>${data.signupId}</code>`);
  await sendTelegramMessage({ chatId: SIGNUPS_CHAT_ID, text: lines.join("\n") });
}
