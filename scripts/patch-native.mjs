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
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

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
      '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    ];
    let out = xml;
    for (const p of perms) {
      if (!out.includes(p)) out = out.replace("</manifest>", `    ${p}\n</manifest>`);
    }

    // App Links: cryptopop:// custom scheme + https deep links into the wallet.
    if (!out.includes("cryptopop")) {
      const intents = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="cryptopop" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="app.cryptopop.org" />
            </intent-filter>
`;
      out = out.replace("</activity>", `${intents}        </activity>`);
    }
    return out;
  });
} else if (target === "ios") {
  patch("ios/App/App/Info.plist", (plist) => {
    const entries = [
      ["NSCameraUsageDescription", "Scan Cold Storage Coins, merchant QR codes, and event QR passes."],
      ["NSFaceIDUsageDescription", "Unlock your POP Wallet with Face ID."],
      ["NSPhotoLibraryAddUsageDescription", "Save your wallet QR code or event pass."],
      [
        "NSLocationWhenInUseUsageDescription",
        "Confirms you're at the event when you scan in to earn POP.",
      ],
    ];
    let out = plist;
    for (const [key, value] of entries) {
      if (out.includes(`<key>${key}</key>`)) continue;
      out = out.replace("</dict>\n</plist>", `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>`);
    }

    // Background mode required for remote push notifications.
    if (!out.includes("remote-notification")) {
      out = out.replace(
        "</dict>\n</plist>",
        "\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n</dict>\n</plist>",
      );
    }

    // cryptopop:// custom URL scheme
    if (!out.includes("CFBundleURLTypes")) {
      out = out.replace(
        "</dict>\n</plist>",
        "\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>org.cryptopop.wallet</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>cryptopop</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>",
      );
    }
    return out;
  });

  // Apple privacy manifest (required for App Store review).
  if (existsSync("ios/App/App")) {
    copyFileSync("resources/PrivacyInfo.xcprivacy", "ios/App/App/PrivacyInfo.xcprivacy");
    console.log("[patch-native] copied PrivacyInfo.xcprivacy");
  }
} else {
  console.error("Usage: node scripts/patch-native.mjs <android|ios>");
  process.exit(1);
}
