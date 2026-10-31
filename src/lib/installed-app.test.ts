import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The home-screen app is installed from Chrome, so the manifest decides what
 * the owner sees: Chrome reads `display_override` first and picks the first
 * mode it supports. Leading with "fullscreen" is what hides Android's on-screen
 * Back / Home / Recents buttons; "standalone" stays in the list as the fallback
 * for browsers that have no immersive mode.
 */
function manifest() {
  const raw = readFileSync(new URL("../../public/manifest.json", import.meta.url), "utf8");
  return JSON.parse(raw) as {
    display: string;
    display_override?: string[];
    theme_color: string;
    background_color: string;
  };
}

describe("installed app manifest", () => {
  it("asks for immersive fullscreen first, then falls back to standalone", () => {
    const m = manifest();
    expect(m.display_override?.[0]).toBe("fullscreen");
    expect(m.display_override).toContain("standalone");
    expect(m.display).toBe("standalone");
  });

  it("keeps the dark ink colours used by the install splash and status bar", () => {
    const m = manifest();
    expect(m.theme_color).toBe("#0B0710");
    expect(m.background_color).toBe("#0B0710");
  });
});
