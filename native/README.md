# CryptoPOP Wallet — native apps (Capacitor)

Thin native shells (Android + iOS) that load the live wallet at
`https://app.cryptopop.org`. Remote-URL mode means **every web deploy updates the
installed app instantly** — no APK/IPA re-release for content or feature changes.

Rebuild only when the app ID, name, icon/splash, plugins, or `capacitor.config.ts` change.

- App ID: `org.cryptopop.wallet`
- App name: CryptoPOP Wallet
- Icon/splash sources: `resources/` (regenerated per build by `@capacitor/assets`)
- Native permissions are re-applied each build by `scripts/patch-native.mjs`
  (camera for QR scanning, biometrics for unlock, Face ID / camera plist strings on iOS)
- `android/` and `ios/` are generated in CI, not committed

## Android APK

Repo → **Actions** → **Build Android APK** → **Run workflow**
(leave `server_url` blank for production, or paste the preview URL to test).
Download the `cryptopop-wallet-apk` artifact and sideload it.

Tag `android-v1` → APK attached to a GitHub release automatically.

**Play Store release:** flip the `release` input on and add these repo secrets:

| Secret | What it is |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

Create a keystore once with:

```bash
keytool -genkey -v -keystore release.keystore -alias cryptopop \
  -keyalg RSA -keysize 2048 -validity 10000
```

The workflow then produces a signed `.apk` and a `.aab` (the Play Store upload format).

## iOS

Repo → **Actions** → **Build iOS app** → **Run workflow**.
Without any Apple credentials it builds an **unsigned Simulator app**
(`cryptopop-wallet-ios-simulator` artifact) — good for verifying the shell.

For a device build / TestFlight, add these repo secrets and the signed archive
step turns on by itself:

| Secret | What it is |
| --- | --- |
| `IOS_CERTIFICATE_P12` | base64 of your Apple distribution certificate (.p12) |
| `IOS_CERTIFICATE_PASSWORD` | password for that .p12 |
| `IOS_PROVISIONING_PROFILE` | base64 of the .mobileprovision |
| `IOS_TEAM_ID` | 10-character Apple Team ID |

All of those come from an Apple Developer Program account ($99/yr) — that account is
the only thing Lovable can't create for you.

## Build locally (optional)

```bash
bun install
mkdir -p native/webdir
bunx cap add android          # or: bunx cap add ios
bunx cap sync android
node scripts/patch-native.mjs android
bunx capacitor-assets generate --android --assetPath resources
cd android && ./gradlew assembleDebug
```

Android needs JDK 21 + Android SDK. iOS needs macOS + Xcode + CocoaPods.

## Store checklist

- [ ] Apple Developer account (iOS) / Google Play developer account (Android, $25 one-time)
- [ ] Signing secrets added to the repo (tables above)
- [ ] Privacy policy URL — `https://cryptopop.org/privacy`
- [ ] Store listing copy + screenshots (grab from the phone once sideloaded)
- [ ] Data-safety form: the wallet key never leaves the device unless the user opts
      into encrypted cloud backup; the app collects email only for that backup
