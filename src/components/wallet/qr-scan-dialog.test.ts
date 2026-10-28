import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(fileURLToPath(new URL("./qr-scan-dialog.tsx", import.meta.url)), "utf8");

describe("QR scanner loading", () => {
  it("never imports the browser-only scanner at module scope", () => {
    // A static import crashes server rendering ("Named export
    // 'setZXingModuleOverrides' not found") and forces every page that shows
    // the dialog to fall back to client-only rendering.
    expect(src).not.toMatch(/^\s*import[^;]*from\s*["']@yudiel\/react-qr-scanner["']/m);
    expect(src).toMatch(/import\(\s*["']@yudiel\/react-qr-scanner["']\s*\)/);
  });

  it("serves the decoder from this site, not a CDN", () => {
    // The wallet's content security policy blocks the CDN barcode-detector
    // downloads from, so the binary has to be fetched from our own origin.
    expect(src).toMatch(/locateFile/);
    expect(src).toMatch(/\/wasm\//);
  });
});
