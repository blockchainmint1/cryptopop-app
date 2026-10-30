// The wallet's Give recipient, saved server-side so card taps know whether to
// split. Signed by the card owner key (same as card settings); no login.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Addr = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/);
const Envelope = z.object({
  owner: Addr,
  ts: z.number().int(),
  action: z.enum(["give-set", "give-get"]),
  body: z.string().max(200),
  sig: z.string().min(40).max(200),
});

export const setGiveRecipient = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    const s = await import("@/lib/nfc-card.server");
    s.verifyOwner(data, "give-set");
    const { code } = z.object({ code: z.string().max(20).nullable() }).parse(JSON.parse(data.body));
    const { pinnedRecipient } = await import("./split-rule");
    const sb = await s.admin();
    if (code === null) {
      await sb.from("give_recipients").delete().eq("owner_address", data.owner);
      return { code: null };
    }
    const r = pinnedRecipient(code);
    if (!r) throw new Error("That cause can't receive Give payments yet");
    const { error } = await sb.from("give_recipients")
      .upsert({ owner_address: data.owner, charity_code: r.code, updated_at: new Date().toISOString() });
    if (error) throw new Error("Couldn't save your Give choice");
    return { code: r.code };
  });

export const getGiveRecipient = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    const s = await import("@/lib/nfc-card.server");
    s.verifyOwner(data, "give-get");
    const sb = await s.admin();
    const { data: row } = await sb.from("give_recipients").select("charity_code").eq("owner_address", data.owner).maybeSingle();
    return { code: (row?.charity_code as string | undefined) ?? null };
  });
