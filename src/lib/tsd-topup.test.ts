import { describe, expect, it } from "vitest";
import { derivePrivateKey } from "./wallet/sign";
import { signTxcMessage, verifyTxcMessage, pubkeyToTxcAddress } from "./wallet/txc-message";
import { secp256k1 } from "@noble/curves/secp256k1";
import { TSD_ORIGIN, TOPUP_PROTOCOL, TOPUP_TTL_MS, TOPUP_REFRESH_MS, TOPUP_DEPOSITS_ENABLED, topupMessage, trustedTopupEvent, validateTopupChallenge, validateTopupConnection } from "./tsd-topup";

const now = Date.parse("2026-10-24T10:00:00.000Z");
const key = derivePrivateKey("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const address = pubkeyToTxcAddress(secp256k1.getPublicKey(key, true));
key.fill(0);
const request = { origin: "https://app.cryptopop.org", address, requestId: "b78b470d-319a-412b-9ae7-d388ee7a7c86" };
const challenge = {
  ...request, type: "tsd-topup-challenge", protocol: TOPUP_PROTOCOL,
  challengeId: "24fe25fc-879f-4e34-893e-637b869be2c7", hmeMemberId: "6d13bad9-435e-4b63-9889-f9256b96a740",
  expiresAt: "2026-10-24T10:05:00.000Z", message: "",
};
challenge.message = topupMessage(challenge);
const connection = {
  protocol: TOPUP_PROTOCOL, requestId: request.requestId, type: "tsd-topup-connected",
  receivingAddress: address, depositAddress: `0x${"a".repeat(40)}`,
  networks: [{ chain: "ethereum", name: "Ethereum", chainId: 1, tokens: [{ symbol: "PYUSD", contract: `0x${"b".repeat(40)}`, decimals: 6 }] }],
  minUsd: 10, maxUsd: 1000, available: true, orders: [],
};

describe("TSD receiving-only connection", () => {
  it("reconstructs the exact receiving-only message, with no trailing newline", () => {
    expect(challenge.message).toBe([
      "Texas Stable Dollar — receiving-only wallet connection", "Protocol: tsd-topup-v1", "Bridge: https://tsd.honest.money",
      "Wallet origin: https://app.cryptopop.org", `HME member: ${challenge.hmeMemberId}`, `TSD receiving address: ${address}`,
      `Request: ${request.requestId}`, `Challenge: ${challenge.challengeId}`, "Expires: 2026-10-24T10:05:00.000Z",
      "Purpose: receive TSD from stablecoin top-ups. No spending, cash-out, or payment authorization.",
    ].join("\n"));
  });
  it("accepts only the exact origin and saved popup", () => {
    const popup = {} as Window;
    const event = { origin: TSD_ORIGIN, source: popup, data: challenge };
    expect(trustedTopupEvent(event, popup, request.requestId)).toBe(true);
    expect(trustedTopupEvent({ ...event, origin: "https://tsd.honest.money.evil.example" }, popup, request.requestId)).toBe(false);
    expect(trustedTopupEvent({ ...event, source: {} as Window }, popup, request.requestId)).toBe(false);
    expect(trustedTopupEvent(event, null, request.requestId)).toBe(false);
  });
  it("rejects wrong protocol and request ID", () => {
    const popup = {} as Window;
    expect(trustedTopupEvent({ origin: TSD_ORIGIN, source: popup, data: { ...challenge, protocol: "other" } }, popup, request.requestId)).toBe(false);
    expect(trustedTopupEvent({ origin: TSD_ORIGIN, source: popup, data: challenge }, popup, crypto.randomUUID())).toBe(false);
  });
  it("requires a five-minute unexpired challenge", () => {
    expect(TOPUP_TTL_MS).toBe(300_000);
    expect(validateTopupChallenge(challenge, request, null, new Set(), now).expiresAt).toBe(challenge.expiresAt);
    expect(() => validateTopupChallenge(challenge, request, null, new Set(), now + 300_000)).toThrow();
    expect(() => validateTopupChallenge(challenge, request, null, new Set(), now - 1)).toThrow();
  });
  it("rejects modified signing text", () => {
    expect(() => validateTopupChallenge({ ...challenge, message: challenge.message + "\n" }, request, null, new Set(), now)).toThrow();
  });
  it("rejects a different wallet destination", () => {
    expect(() => validateTopupChallenge(challenge, { ...request, address: address + "1" }, null, new Set(), now)).toThrow();
    expect(() => validateTopupConnection(connection, { ...request, address: address + "1" })).toThrow();
  });
  it("requires the signed-in HME member when known", () => {
    expect(() => validateTopupChallenge(challenge, request, crypto.randomUUID(), new Set(), now)).toThrow();
    expect(validateTopupChallenge(challenge, request, challenge.hmeMemberId, new Set(), now).hmeMemberId).toBe(challenge.hmeMemberId);
  });
  it("rejects replayed challenges", () => {
    expect(() => validateTopupChallenge(challenge, request, null, new Set([challenge.challengeId]), now)).toThrow();
  });
  it("produces a real TXC compact signature for the wallet address", () => {
    const privateKey = derivePrivateKey("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    try {
      const signature = signTxcMessage(privateKey, challenge.message);
      expect(verifyTxcMessage(address, challenge.message, signature)).toBe(true);
      expect(verifyTxcMessage(address, challenge.message + " altered", signature)).toBe(false);
    } finally { privateKey.fill(0); }
  });
  it("keeps paused availability and exact contracts/decimals from TSD", () => {
    const parsed = validateTopupConnection({ ...connection, available: false }, request);
    expect(parsed.available).toBe(false);
    expect(parsed.networks[0]?.tokens[0]).toEqual(connection.networks[0]?.tokens[0]);
  });
  it("offers only Ethereum and Base with their matching chain IDs", () => {
    expect(() => validateTopupConnection({ ...connection, networks: [{ ...connection.networks[0], chain: "bsc", chainId: 56 }] }, request)).toThrow();
    expect(() => validateTopupConnection({ ...connection, networks: [{ ...connection.networks[0], chain: "base", chainId: 1 }] }, request)).toThrow();
    expect(validateTopupConnection({ ...connection, networks: [{ ...connection.networks[0], chain: "base", chainId: 8453 }] }, request).networks[0]?.chain).toBe("base");
  });
  it("does not infer completion from TSD delivery alone", () => {
    const order = { id: crypto.randomUUID(), orderNumber: "TX-12345678", chain: "ethereum", token: "PYUSD", amount: 20,
      depositTx: null, payoutTx: "a".repeat(64), createdAt: new Date(now).toISOString(), error: null, note: null,
      complete: false, progress: { steps: Array.from({ length: 7 }, () => ({ label: "Pending", detail: "Waiting" })), index: 4, number: 5, total: 7 } };
    expect(validateTopupConnection({ ...connection, orders: [order] }, request).orders[0]?.complete).toBe(false);
  });
  it("refreshes no more often than 30 seconds", () => { expect(TOPUP_REFRESH_MS).toBe(30_000); });
  it("keeps deposits release-gated until live acceptance", () => { expect(TOPUP_DEPOSITS_ENABLED).toBe(false); });
});