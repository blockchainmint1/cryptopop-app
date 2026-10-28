import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./send-sheet.tsx", import.meta.url)), "utf8");

describe("Send screen is TSD-native", () => {
  it("offers only TSD in the main asset picker", () => {
    expect(src).toMatch(/const PRIMARY_ASSETS = SENDABLE_ASSETS\.filter\(\(a\) => a\.id === "tsd"\)/);
    expect(src).toMatch(/const ADVANCED_ASSETS = SENDABLE_ASSETS\.filter\(\(a\) => a\.id !== "tsd"\)/);
    // The top-level picker iterates PRIMARY_ASSETS, never the whole sendable list.
    expect(src).toMatch(/\{PRIMARY_ASSETS\.map/);
    expect(src).not.toMatch(/\{SENDABLE_ASSETS\.map/);
  });

  it("keeps the base coin behind an Advanced disclosure", () => {
    const gate = src.indexOf("advancedOpen && (");
    const advanced = src.indexOf("ADVANCED_ASSETS.map");
    expect(gate).toBeGreaterThan(-1);
    expect(advanced).toBeGreaterThan(gate);
    expect(src).toMatch(/aria-expanded=\{advancedOpen\}/);
  });

  it("opens Advanced when a payment request needs the base coin", () => {
    // A scanned or prefilled TXC payment must not switch the asset while the
    // picker is hidden, or the user reviews something they never chose.
    expect(src).toMatch(/if \(prefill\.asset !== "tsd"\) setAdvancedOpen\(true\)/);
    expect(src).toMatch(/if \(intent\.asset !== "tsd"\) setAdvancedOpen\(true\)/);
  });

  it("never leaves a hidden asset selected", () => {
    expect(src).toMatch(
      /if \(!next && asset !== "tsd"\) \{\s*setAsset\("tsd"\);\s*setReview\(null\);/,
    );
  });
});
