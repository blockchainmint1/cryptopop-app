import { createServerFn } from "@tanstack/react-start";

/** Relays NectarPay's signed church list. The phone verifies the signature itself. */
export const getSignedCauses = createServerFn({ method: "GET" }).handler(async () => {
  const { CAUSES_URL } = await import("./causes.server");
  const res = await fetch(CAUSES_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`causes ${res.status}`);
  const j = (await res.json()) as { signed_payload?: string; signer?: string; signature?: string };
  return { signed_payload: String(j.signed_payload ?? ""), signer: String(j.signer ?? ""), signature: String(j.signature ?? "") };
});
