import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { b64url, openPayload, sameWallet, sealPayload, vaultTagOf } from "./passkey-unlock";
import type { VaultPayload } from "./vault";
import {
  bytesEqual,
  checkAssertion,
  loadPasskeyRecord,
  passkeyApprove,
  runApproval,
  startPasskeyEnroll,
  cancelPasskeyEnroll,
  hasPendingPasskeySetup,
  passkeyTransports,
  PENDING_SETUP_MS,
  userVerified,
  type ApprovalDeps,
  type PasskeyRecord,
} from "./passkey-unlock";
import { changeVaultPassword, createVault, loadSession, PASSKEY_KEY } from "./vault";

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

/* ----------------------- auditor follow-up (Nov 16) ----------------------- */

const CRED = new Uint8Array(16).map((_, i) => i + 7);
function authData(flags: number) {
  const a = new Uint8Array(37);
  a[32] = flags;
  return a;
}

describe("passkey answer checks", () => {
  it("refuses an answer from a different passkey (rawId mismatch)", () => {
    const other = CRED.slice();
    other[0] ^= 1;
    expect(() => checkAssertion(other, authData(0x05), b64url(CRED))).toThrow(/different passkey/);
    expect(() => checkAssertion(CRED.slice(0, 15), authData(0x05), b64url(CRED))).toThrow(/different passkey/);
  });

  it("refuses an answer where the phone didn't confirm face / fingerprint (no UV flag)", () => {
    expect(() => checkAssertion(CRED, authData(0x01), b64url(CRED))).toThrow(/didn't confirm/);
    expect(userVerified(new Uint8Array(10))).toBe(false);
  });

  it("accepts the enrolled passkey with face / fingerprint confirmed", () => {
    expect(() => checkAssertion(CRED, authData(0x05), b64url(CRED))).not.toThrow();
    expect(bytesEqual(CRED, CRED.slice())).toBe(true);
  });

  it("refuses a passkey secret that isn't exactly 32 bytes", async () => {
    const rec = await sealed();
    await expect(openPayload(new Uint8Array(33).fill(1), rec)).rejects.toThrow(/wrong size/);
    await expect(sealPayload(new Uint8Array(31).fill(1), payload, { credId: "c", rpId: "r", salt: "s", vaultTag: "t" })).rejects.toThrow(/wrong size/);
  });

  it("keeps the 'approval required' flag inside the sealed copy", async () => {
    const rec = await sealPayload(prf, { ...payload, approval: "passkey" }, { credId: "c", rpId: "r", salt: "s", vaultTag: "t" });
    expect((await openPayload(prf, rec)).approval).toBe("passkey");
  });

  it("new copies are version 2 (key bound to the passkey id); relabelling the version is refused", async () => {
    const rec = await sealed();
    expect(rec.v).toBe(2);
    await expect(openPayload(prf, { ...rec, v: 1 as unknown as 2 })).rejects.toThrow();
  });

  it("transport hint: drops the cross-device QR route, keeps what the phone reported", () => {
    expect(passkeyTransports(["hybrid", "internal"])).toEqual(["internal"]);
    expect(passkeyTransports(["hybrid"])).toEqual(["internal"]);
    expect(passkeyTransports(undefined)).toEqual(["internal"]);
    expect(passkeyTransports(["internal", "usb", "made-up"])).toEqual(["internal", "usb"]);
  });
});

describe("payment approval rule (fail closed)", () => {
  async function deps(over: Partial<ApprovalDeps> = {}): Promise<ApprovalDeps> {
    return {
      required: true,
      unlockedMnemonic: A,
      record: await sealed("tag-1"),
      passkey: async () => prf,
      currentTag: async () => "tag-1",
      askPassword: async () => null,
      checkPassword: async (pw) => (pw === "right-password" ? payload : null),
      ...over,
    };
  }

  it("Face ID copy deleted while approval is required: refused without the password", async () => {
    expect(await runApproval(await deps({ record: null }))).toBe(false);
    expect(await runApproval(await deps({ record: null, askPassword: async () => "wrong" }))).toBe(false);
    expect(await runApproval(await deps({ record: null, askPassword: async () => "right-password" }))).toBe(true);
  });

  it("password for a different wallet doesn't approve", async () => {
    const d = await deps({ record: null, askPassword: async () => "x", checkPassword: async () => ({ ...payload, mnemonic: B }) });
    expect(await runApproval(d)).toBe(false);
  });

  it("Face ID never turned on: no check", async () => {
    expect(await runApproval(await deps({ required: false, record: null }))).toBe(true);
  });

  it("face / fingerprint passes for the unlocked wallet", async () => {
    expect(await runApproval(await deps())).toBe(true);
    expect(await runApproval(await deps({ unlockedMnemonic: B }))).toBe(false);
  });

  it("cancelling the prompt refuses and never falls back", async () => {
    const askPassword = vi.fn(async () => "right-password");
    const cancel = Object.assign(new Error("no"), { name: "NotAllowedError" });
    expect(await runApproval(await deps({ passkey: async () => Promise.reject(cancel), askPassword }))).toBe(false);
    expect(askPassword).not.toHaveBeenCalled();
  });

  it("out-of-date copy or a different passkey answering asks for the password instead", async () => {
    const askPassword = vi.fn(async () => null);
    expect(await runApproval(await deps({ currentTag: async () => "tag-2", askPassword }))).toBe(false);
    expect(await runApproval(await deps({ passkey: async () => Promise.reject(new Error("A different passkey answered")), askPassword }))).toBe(false);
    expect(await runApproval(await deps({ passkey: async () => otherPrf, askPassword }))).toBe(false);
    expect(askPassword).toHaveBeenCalledTimes(3);
  });
});

describe("Face ID setup (browser stubs)", () => {
  let store: Map<string, string>;
  let signal: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    };
    signal = vi.fn(async () => undefined);
    create = vi.fn();
    get = vi.fn();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("sessionStorage", ls);
    vi.stubGlobal("window", { location: { hostname: "app.cryptopop.org" }, isSecureContext: true });
    vi.stubGlobal("navigator", { credentials: { create, get } });
    vi.stubGlobal("PublicKeyCredential", { signalUnknownCredential: signal });
  });
  afterEach(() => vi.unstubAllGlobals());

  function fakeCreated(results?: Uint8Array) {
    return {
      rawId: CRED.buffer.slice(0),
      response: { getAuthenticatorData: () => authData(0x45).buffer, getTransports: () => ["hybrid", "internal"] },
      getClientExtensionResults: () => ({ prf: { enabled: true, ...(results ? { results: { first: results } } : {}) } }),
    };
  }

  function fakeAsserted(results: Uint8Array) {
    return {
      rawId: CRED.buffer.slice(0),
      response: { authenticatorData: authData(0x05).buffer },
      getClientExtensionResults: () => ({ prf: { results: { first: results } } }),
    };
  }

  it("passkey created but the follow-up check fails: nothing saved, passkey dropped", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated());
    get.mockRejectedValue(Object.assign(new Error("boom"), { name: "InvalidStateError" }));
    await expect(startPasskeyEnroll(payload, "right-password", "POP")).rejects.toThrow();
    expect(store.has(PASSKEY_KEY)).toBe(false);
    expect(signal).toHaveBeenCalledWith({ rpId: "app.cryptopop.org", credentialId: b64url(CRED) });
    expect(loadSession()?.approval).toBeUndefined();
  });

  it("setup turns on 'approval required'; deleting the copy then needs the password", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated(prf));
    expect(await startPasskeyEnroll(payload, "right-password", "POP")).toBe("done");
    expect(loadPasskeyRecord()).not.toBeNull();
    const session = loadSession()!;
    expect(session.approval).toBe("passkey");

    store.delete(PASSKEY_KEY); // someone removes the Face ID copy
    const io = { askPassword: vi.fn(async () => null), checkPassword: vi.fn(async () => null) };
    expect(await passkeyApprove(session, io)).toBe(false);
    expect(io.askPassword).toHaveBeenCalled();
  });

  it("refuses an older v1 Face ID copy instead of loading it", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated(prf));
    await startPasskeyEnroll(payload, "right-password", "POP");
    const rec = loadPasskeyRecord() as PasskeyRecord;
    expect(rec.v).toBe(2);
    // An attacker (or stale test data) cannot put a zero-salt v1 copy back in storage.
    store.set(PASSKEY_KEY, JSON.stringify({ ...rec, v: 1 }));
    expect(loadPasskeyRecord()).toBeNull();
  });

  it("changing the password drops the Face ID copy and tells the phone", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated(prf));
    await startPasskeyEnroll(payload, "right-password", "POP");
    const rec = loadPasskeyRecord() as PasskeyRecord;
    const result = await changeVaultPassword("right-password", "new-password-123");
    expect(store.has(PASSKEY_KEY)).toBe(false);
    expect(signal).toHaveBeenCalledWith({ rpId: rec.rpId, credentialId: rec.credId });
    expect(result.faceIdNeedsSetup).toBe(true);
  });

  it("changing the password never switches the payment check off: payments then need the new password", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated(prf));
    await startPasskeyEnroll(payload, "right-password", "POP");
    await changeVaultPassword("right-password", "new-password-123");
    const session = loadSession()!;
    expect(session.approval).toBe("passkey");
    const { checkVaultPassword } = await import("./vault");
    expect(await passkeyApprove(session, { askPassword: async () => null, checkPassword: checkVaultPassword })).toBe(false);
    expect(await passkeyApprove(session, { askPassword: async () => "right-password", checkPassword: checkVaultPassword })).toBe(false);
    expect(await passkeyApprove(session, { askPassword: async () => "new-password-123", checkPassword: checkVaultPassword })).toBe(true);
  });

  it("password change without Face ID leaves payments unchecked as before", async () => {
    await createVault(A, "right-password", "generated");
    const result = await changeVaultPassword("right-password", "new-password-123");
    expect(result.faceIdNeedsSetup).toBe(false);
    expect(loadSession()?.approval).toBeUndefined();
  });

  it("the passkey prompt uses the phone's own transport hint, without the QR route", async () => {
    await createVault(A, "right-password", "generated");
    create.mockResolvedValue(fakeCreated());
    get.mockResolvedValue(fakeAsserted(prf));
    expect(await startPasskeyEnroll(payload, "right-password", "POP")).toBe("done");
    const opts = get.mock.calls[0][0].publicKey;
    expect(opts.allowCredentials[0].transports).toEqual(["internal"]);
    expect(loadPasskeyRecord()?.transports).toEqual(["internal"]);
  });

  it("a half-finished setup forgets the password after 2 minutes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await createVault(A, "right-password", "generated");
      create.mockResolvedValue(fakeCreated());
      get.mockRejectedValue(Object.assign(new Error("dismissed"), { name: "NotAllowedError" }));
      expect(await startPasskeyEnroll(payload, "right-password", "POP")).toBe("needs-tap");
      expect(hasPendingPasskeySetup()).toBe(true);
      expect(PENDING_SETUP_MS).toBe(120_000);
      vi.advanceTimersByTime(PENDING_SETUP_MS - 1);
      expect(hasPendingPasskeySetup()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(hasPendingPasskeySetup()).toBe(false);
      expect(signal).toHaveBeenCalled();
      expect(store.has(PASSKEY_KEY)).toBe(false);
    } finally {
      cancelPasskeyEnroll();
      vi.useRealTimers();
    }
  });
});
