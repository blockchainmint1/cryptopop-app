import { expect, it } from "vitest";
import { parseScan } from "./scan-parse";
it("rejects an arbitrary website QR", () => expect(parseScan("https://attacker.com/claim/abcdefgh").kind).toBe("unknown"));
it("accepts a CryptoPOP claim QR", () => expect(parseScan("https://app.cryptopop.org/claim/abcdefgh").kind).toBe("award"));
it("rejects an unknown wallet login callback", () => expect(parseScan("payhme://login?nonce=abcdefgh&cb=https%3A%2F%2Fattacker.com%2Flogin").kind).toBe("unknown"));
it("rejects misleading display hosts", () => expect(parseScan("payhme://login?nonce=abcdefgh&cb=https%3A%2F%2Fapp.nectar-pay.com%2Flogin&from=honest.money").kind).toBe("unknown"));
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { parseScan as ps2 } from "./scan-parse";
d2("NectarPay store sticker", () => {
  i2("reads the store code from a printed sticker link", () => {
    e2(ps2("https://app.nectar-pay.com/s/dQdbix")).toMatchObject({ kind: "nectar_sticker", code: "dQdbix" });
  });
});
