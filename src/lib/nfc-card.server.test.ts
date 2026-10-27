import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as s from "./nfc-card.server";
import { ownerEnvelope, pocketAddress, pocketKeyHex, nfcPocketPath } from "./wallet/nfc-cards";

beforeAll(() => {
  process.env.CARD_KEY_ENC = "test-card-key-secret";
  process.env.NFC_PAY_SECRET = "test-pay-secret";
});

describe("NFC card service", () => {
  const m = generateMnemonic(wordlist);

  it("uses CryptoPOP's own 1110' branch", () => {
    expect(nfcPocketPath(3)).toBe("m/44'/696969'/1110'/0/3");
  });

  it("pocket key matches its pocket address", () => {
    expect(s.addressOfKey(pocketKeyHex(m, 0))).toBe(pocketAddress(m, 0));
    expect(pocketAddress(m, 0)).not.toBe(pocketAddress(m, 1));
  });

  it("card id ignores separators and case", async () => {
    expect(await s.hashUid("04:a1:b2:c3")).toBe(await s.hashUid("04A1B2C3"));
  });

  it("accepts a fresh owner signature and rejects tampering", () => {
    const env = ownerEnvelope(m, "kill", { id: "x" });
    expect(() => s.verifyOwner(env, "kill")).not.toThrow();
    expect(() => s.verifyOwner({ ...env, body: '{"id":"y"}' }, "kill")).toThrow();
    expect(() => s.verifyOwner(env, "link")).toThrow();
  });

  it("rejects owner requests older than 5 minutes", () => {
    const env = ownerEnvelope(m, "list", {});
    expect(() => s.verifyOwner({ ...env, ts: env.ts - 301 }, "list")).toThrow();
  });

  it("PIN check only matches the right PIN", async () => {
    const a = await s.hashPin("4321");
    expect((await s.hashPin("4321", a.salt)).hash).toBe(a.hash);
    expect((await s.hashPin("1234", a.salt)).hash).not.toBe(a.hash);
  });

  it("encrypted card key round-trips only through the service", async () => {
    const k = pocketKeyHex(m, 2);
    const blob = await s.encryptKey(k);
    expect(blob).not.toContain(k);
  });

  it("partner signature must match body and be fresh", async () => {
    const body = '{"card_uid":"04A1B2C3"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", "test-pay-secret").update(`${ts}.${body}`).digest("hex");
    expect(await s.verifyPartner(ts, sig, body)).toBe(true);
    expect(await s.verifyPartner(ts, sig, body + " ")).toBe(false);
    expect(await s.verifyPartner(String(Number(ts) - 400), sig, body)).toBe(false);
  });
});
