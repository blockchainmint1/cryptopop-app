import { describe, expect, it } from "vitest";
import { b64url, openPayload, sameWallet, sealPayload, vaultTagOf } from "./passkey-unlock";
import type { VaultPayload } from "./vault";

const A = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const B = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const payload: VaultPayload = { mnemonic: A, origin: "generated", createdAt: 1 };
const prf = new Uint8Array(32).map((_, i) => i + 1);
const otherPrf = new Uint8Array(32).map((_, i) => 200 - i);

async function sealed(vaultTag = "tag-1") {
  return sealPayload(prf, payload, { credId: "cred-1", rpId: "app.cryptopop.org", salt: b64url(new Uint8Array(32)), vaultTag });
}

describe("Face ID / fingerprint web unlock", () => {
  it("opens with the same passkey secret and gives back the same wallet", async () => {
    const rec = await sealed();
    const back = await openPayload(prf, rec);
    expect(back.mnemonic).toBe(A);
    expect(JSON.stringify(rec)).not.toContain("abandon");
  });

  it("refuses a different passkey secret", async () => {
    await expect(openPayload(otherPrf, await sealed())).rejects.toThrow();
  });

  it("refuses a copy moved to another passkey, site or vault", async () => {
    const rec = await sealed();
    await expect(openPayload(prf, { ...rec, credId: "cred-2" })).rejects.toThrow();
    await expect(openPayload(prf, { ...rec, rpId: "evil.example" })).rejects.toThrow();
    await expect(openPayload(prf, { ...rec, vaultTag: "tag-2" })).rejects.toThrow();
  });

  it("refuses an edited copy", async () => {
    const rec = await sealed();
    const ct = rec.ct.slice(0, -2) + (rec.ct.endsWith("A") ? "BB" : "AA");
    await expect(openPayload(prf, { ...rec, ct })).rejects.toThrow();
  });

  it("approves a payment only for the wallet that is unlocked", async () => {
    const back = await openPayload(prf, await sealed());
    expect(sameWallet(back, A)).toBe(true);
    expect(sameWallet(back, B)).toBe(false);
  });

  it("ties the copy to the exact password vault", async () => {
    expect(await vaultTagOf("ct-1")).not.toBe(await vaultTagOf("ct-2"));
    expect(await vaultTagOf("ct-1")).toBe(await vaultTagOf("ct-1"));
  });
});
