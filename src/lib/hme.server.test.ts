import { createHmac } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { verifyHmeTicket } from "./hme.server";
const old = process.env.HME_ECOSYSTEM;
afterEach(() => { if (old === undefined) delete process.env.HME_ECOSYSTEM; else process.env.HME_ECOSYSTEM = old; });
function ticket(changes: Record<string, unknown> = {}) {
  process.env.HME_ECOSYSTEM = "audit-test-only-site-key";
  const body = Buffer.from(JSON.stringify({ iss: "honest.money", site: "pop-wallet", minerId: "test-member", email: "test@example.org", nonce: "test-nonce", exp: Math.floor(Date.now() / 1000) + 90, ...changes })).toString("base64url");
  return `${body}.${createHmac("sha256", "audit-test-only-site-key").update(body).digest("hex")}`;
}
it("accepts a pop-wallet ticket from honest.money", async () => expect((await verifyHmeTicket(ticket())).site).toBe("pop-wallet"));
it("rejects a ticket for another app", async () => expect(verifyHmeTicket(ticket({ site: "other-app" }))).rejects.toThrow());
it("rejects a ticket from another issuer", async () => expect(verifyHmeTicket(ticket({ iss: "attacker" }))).rejects.toThrow());
it("rejects expired tickets", async () => expect(verifyHmeTicket(ticket({ exp: Math.floor(Date.now() / 1000) - 1 }))).rejects.toThrow());