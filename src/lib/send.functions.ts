/**
 * Non-custodial send RPC. The server only ever sees an unsigned transaction
 * or an already-signed raw hex — never a key or mnemonic.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Addr = z.string().min(20).max(64).regex(/^[A-Za-z0-9]+$/);

const PrepareInput = z.object({
  asset: z.enum(["pop", "txc"]),
  from: Addr,
  to: Addr,
  amount: z.number().positive().finite(),
});

const BroadcastInput = z.object({
  rawHex: z.string().min(20).max(200_000).regex(/^[0-9a-fA-F]+$/),
});

export const prepareSend = createServerFn({ method: "POST" })
  .inputValidator((input) => PrepareInput.parse(input))
  .handler(async ({ data }) => {
    const { buildUnsignedSend } = await import("./send.server");
    const built = await buildUnsignedSend(data);
    return {
      psbtBase64: built.psbtBase64,
      feeSats: built.feeSats,
      inputCount: built.inputCount,
      totalSats: built.totalSats,
    };
  });

export const broadcastSignedTx = createServerFn({ method: "POST" })
  .inputValidator((input) => BroadcastInput.parse(input))
  .handler(async ({ data }) => {
    const { broadcastRaw } = await import("./send.server");
    const txid = await broadcastRaw(data.rawHex);
    return { txid };
  });
