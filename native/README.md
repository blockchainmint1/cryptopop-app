# POP Wallet — native apps (Capacitor)

Thin native shells (Android + iOS) that load the live wallet at
`https://app.cryptopop.org`. Remote-URL mode means **every web deploy updates the
installed app instantly** — no APK/IPA re-release for content or feature changes.

Rebuild only when the app ID, name, icon/splash, plugins, or `capacitor.config.ts` change.

- App ID: `org.cryptopop.wallet`
- App name: POP Wallet
- Icon/splash sources: `resources/` (regenerated per build by `@capacitor/assets`)
- Native permissions are re-applied each build by `scripts/patch-native.mjs`
  (camera for QR scanning, biometrics for unlock, Face ID / camera plist strings on iOS)
- `android/` and `ios/` are generated in CI, not committed

## Android APK

Repo → **Actions** → **Build Android APK** → **Run workflow**
(leave `server_url` blank for production, or paste the preview URL to test).
Download the `popwallet-apk` artifact and sideload it.

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
(`popwallet-ios-simulator` artifact) — good for verifying the shell.

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


## Store-readiness notes

- **Version numbers** are automatic: `versionCode`/build number come from the GitHub
  Actions run number, `versionName` is `1.0.<run>`. No duplicate-upload rejections.
- **Deep links** are served from `public/.well-known/`:
  - `assetlinks.json` — replace `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT` with
    the output of `keytool -list -v -keystore release.keystore -alias cryptopop`
    (the SHA256 line).
  - `apple-app-site-association` — replace `TEAMID` with your 10-character Apple Team ID
    (Apple Developer → Membership).
- **Apple privacy manifest** lives at `resources/PrivacyInfo.xcprivacy` and is copied into
  the iOS project on every build.
- **Push notifications** use Firebase Cloud Messaging. Create a Firebase project, add both
  the Android and iOS apps (`org.cryptopop.wallet`), upload an APNs auth key for iOS, then
  save the service-account JSON as the `FCM_SERVICE_ACCOUNT_JSON` secret. Drop
  `google-services.json` into `android/app/` and `GoogleService-Info.plist` into `ios/App/App/`
  (add them as repo files + a copy step when you're ready).
  Manage and send notifications at `/admin/push`.
- **Account deletion** is in-app: Wallet settings → Delete my account (store requirement).
- **Offline screen** renders whenever the device drops its connection.
