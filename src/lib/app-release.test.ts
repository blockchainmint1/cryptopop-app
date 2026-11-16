import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestRelease } from "./app-release";

/**
 * The wallet's Content-Security-Policy only lets it talk to its own origin plus
 * the listed ecosystem hosts. A hard-coded cross-origin release feed therefore
 * either gets blocked by CSP or refused by the other host's CORS, and both
 * hosts read the same app_releases table the database fallback reads anyway.
 * This asserts the update check never reaches for another host.
 */
describe("release feed source", () => {
  const ORIGIN = "https://cryptopop-wallet.lovable.app";
  let urls: string[];

  beforeEach(() => {
    urls = [];
    vi.stubGlobal("window", { location: { origin: ORIGIN } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        urls.push(String(input));
        return { ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response;
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("asks only this app's own origin, never another host", async () => {
    expect(await fetchLatestRelease("web")).toBeNull();
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(new URL(u).host).toBe("cryptopop-wallet.lovable.app");
    }
    expect(urls.some((u) => u.includes("cryptopop-app.lovable.app"))).toBe(false);
    expect(urls.some((u) => u.includes("app.cryptopop.org"))).toBe(false);
  });

  it("reads the release from this app's own feed when it answers", async () => {
    const release = {
      platform: "web",
      version: "9.9.9",
      ipfs_cid: null,
      download_url: null,
      notes: null,
      mandatory: false,
      released_at: "2026-11-16T00:00:00Z",
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: unknown) => {
      urls.push(String(input));
      return { ok: true, status: 200, json: async () => ({ release }) } as Response;
    });
    expect(await fetchLatestRelease("web")).toMatchObject({ version: "9.9.9" });
    expect(new URL(urls[0]).host).toBe("cryptopop-wallet.lovable.app");
  });
});
