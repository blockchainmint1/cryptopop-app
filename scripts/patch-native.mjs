/**
 * Post-`cap add` patcher.
 *
 * The `android/` and `ios/` folders are generated in CI (not committed), so any
 * native permission or plist tweak has to be re-applied on every build. Run this
 * right after `cap add` / `cap sync`.
 *
 *   node scripts/patch-native.mjs android
 *   node scripts/patch-native.mjs ios
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = process.argv[2];

function patch(file, fn) {
  if (!existsSync(file)) {
    console.warn(`[patch-native] skip (missing): ${file}`);
    return;
  }
  const before = readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`[patch-native] patched ${file}`);
  } else {
    console.log(`[patch-native] already current ${file}`);
  }
}

if (target === "android") {
  patch("android/app/src/main/AndroidManifest.xml", (xml) => {
    const perms = [
      '<uses-permission android:name="android.permission.CAMERA" />',
      '<uses-permission android:name="android.permission.USE_BIOMETRIC" />',
      '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    ];
    let out = xml;
    for (const p of perms) {
      if (!out.includes(p)) out = out.replace("</manifest>", `    ${p}\n</manifest>`);
    }
    return out;
  });
} else if (target === "ios") {
  patch("ios/App/App/Info.plist", (plist) => {
    const entries = [
      ["NSCameraUsageDescription", "Scan Cold Storage Coins and event QR passes."],
      ["NSFaceIDUsageDescription", "Unlock your CryptoPOP wallet with Face ID."],
      ["NSPhotoLibraryAddUsageDescription", "Save your wallet QR code or event pass."],
    ];
    let out = plist;
    for (const [key, value] of entries) {
      if (out.includes(`<key>${key}</key>`)) continue;
      out = out.replace("</dict>\n</plist>", `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>`);
    }
    return out;
  });
} else {
  console.error("Usage: node scripts/patch-native.mjs <android|ios>");
  process.exit(1);
}
