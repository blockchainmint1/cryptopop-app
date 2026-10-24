import { expect, it, afterEach } from "vitest";
import { isEcosystemSite, setEcosystemSites } from "./hosts";
afterEach(() => setEcosystemSites([]));
it("blocks unknown external sites", () => expect(isEcosystemSite("attacker.com")).toBe(false));
it("does not automatically trust subdomains", () => expect(isEcosystemSite("attacker.honest.money")).toBe(false));
it("permits a verified registry entry", () => { setEcosystemSites([{ host: "newpartner.com", label: "Partner" }]); expect(isEcosystemSite("newpartner.com")).toBe(true); });
it("blocks private hosts in the registry", () => { setEcosystemSites([{ host: "127.0.0.1", label: "Bad" }]); expect(isEcosystemSite("127.0.0.1")).toBe(false); });