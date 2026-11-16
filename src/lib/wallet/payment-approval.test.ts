import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const state = {
  native: false,
  nativeBio: false,
  session: null as null | { mnemonic: string; origin: "generated"; createdAt: number; approval?: "passkey" },
  password: null as string | null,
};
const confirmWithBiometric = vi.fn(async (_reason: string) => true);
const passkeyApprove = vi.fn(async () => true);
const askForPassword = vi.fn(async () => state.password);

vi.mock("@/lib/native/platform", () => ({ isNative: () => state.native }));
vi.mock("@/lib/native/biometric", () => ({
  confirmWithBiometric: (r: string) => confirmWithBiometric(r),
  isNativeBiometricOn: async () => state.nativeBio,
}));
vi.mock("./password-prompt", () => ({ askForPassword: () => askForPassword() }));
vi.mock("./passkey-unlock", async (orig) => {
  const real = await orig<typeof import("./passkey-unlock")>();
  return { ...real, passkeyApprove: () => passkeyApprove() };
});
vi.mock("./vault", async (orig) => {
  const real = await orig<typeof import("./vault")>();
  return {
    ...real,
    loadSession: () => state.session,
    checkVaultPassword: async (pw: string) => (pw === "right-password" ? state.session : null),
  };
});

const { approvePayment, notApprovedMessage, LOCKED_NOT_APPROVED, PAYMENT_NOT_APPROVED } = await import("./payment-approval");

describe("payment gate", () => {
  let events: string[];
  beforeEach(() => {
    state.native = false;
    state.nativeBio = false;
    state.session = { mnemonic: A, origin: "generated", createdAt: 1 };
    state.password = null;
    vi.clearAllMocks();
    events = [];
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => events.push(e.type) });
  });

  it("phone app with its own Face ID on: uses the phone's prompt", async () => {
    state.native = true;
    state.nativeBio = true;
    expect(await approvePayment(A, "pay")).toBe(true);
    expect(confirmWithBiometric).toHaveBeenCalled();
  });

  it("phone app with its Face ID off but web Face ID set up: asks for the password", async () => {
    state.native = true;
    state.session = { ...state.session!, approval: "passkey" };
    expect(await approvePayment(A, "pay")).toBe(false); // cancelled
    state.password = "wrong";
    expect(await approvePayment(A, "pay")).toBe(false);
    state.password = "right-password";
    expect(await approvePayment(A, "pay")).toBe(true);
    expect(confirmWithBiometric).not.toHaveBeenCalled();
    expect(askForPassword).toHaveBeenCalledTimes(3);
  });

  it("phone app, Face ID never set up anywhere: no check, as before", async () => {
    state.native = true;
    expect(await approvePayment(A, "pay")).toBe(true);
    expect(askForPassword).not.toHaveBeenCalled();
  });

  it("wallet already auto-locked: refused, sends to unlock, and says 'locked' not 'Face ID failed'", async () => {
    state.session = null;
    expect(await approvePayment(A, "pay")).toBe(false);
    expect(events).toContain("cryptopop:wallet-locked");
    expect(passkeyApprove).not.toHaveBeenCalled();
    expect(notApprovedMessage("payment")).toBe(LOCKED_NOT_APPROVED);
  });

  it("Face ID declined while unlocked keeps the Face ID message", async () => {
    passkeyApprove.mockResolvedValueOnce(false);
    expect(await approvePayment(A, "pay")).toBe(false);
    expect(notApprovedMessage("payment")).toBe(PAYMENT_NOT_APPROVED);
  });

  it("a different wallet than the unlocked one is refused", async () => {
    expect(await approvePayment("legal winner thank year wave sausage worth useful legal winner thank yellow", "pay")).toBe(false);
  });
});
