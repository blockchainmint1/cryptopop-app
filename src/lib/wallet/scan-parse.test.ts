import { expect, it } from "vitest";
import { parseScan } from "./scan-parse";
it("rejects an arbitrary website QR", () => expect(parseScan("https://attacker.com/claim/abcdefgh").kind).toBe("unknown"));
it("accepts a CryptoPOP claim QR", () => expect(parseScan("https://app.cryptopop.org/claim/abcdefgh").kind).toBe("award"));
it("rejects an unknown wallet login callback", () => expect(parseScan("payhme://login?nonce=abcdefgh&cb=https%3A%2F%2Fattacker.com%2Flogin").kind).toBe("unknown"));
it("rejects misleading display hosts", () => expect(parseScan("payhme://login?nonce=abcdefgh&cb=https%3A%2F%2Fapp.nectar-pay.com%2Flogin&from=honest.money").kind).toBe("unknown"));