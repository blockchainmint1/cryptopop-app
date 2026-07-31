# CryptoPOP Wallet — Android (Capacitor)

The native shell is a thin Capacitor wrapper that loads the live CryptoPOP web app
(`https://cryptopop.org`). Because it's remote-URL mode, **every web deploy updates the
installed app instantly** — no APK rebuild needed for content or feature changes.

Rebuild the APK only when the app ID, name, icon, plugins, or Capacitor config change.

## Build an APK (no local setup — via GitHub)

1. Make sure this project is synced to GitHub (Lovable → GitHub → Connect project).
2. Go to the repo → **Actions** → **Build Android APK** → **Run workflow**.
   - Leave `server_url` blank for production, or paste the preview URL to test against preview.
3. When it finishes, download the `cryptopop-wallet-debug-apk` artifact.
4. Sideload it: copy to the phone, open it, allow "install unknown apps".

Tag-based release: push a tag like `android-v1` and the APK is attached to a GitHub release.

## Build locally (optional)

```bash
bun install
mkdir -p native/webdir
bunx cap add android      # first time only
bunx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 21 + Android SDK (Android Studio). `npx cap open android` opens the project.

## Notes

- `android/` is generated, not committed — CI recreates it each run.
- Debug APKs are self-signed and fine for sideloading. Play Store release needs a
  signing keystore (`assembleRelease` + upload key) — say the word and we'll add it.
- The shell keeps CryptoPOP links in-app; other domains open in the system browser.
- Config lives in `capacitor.config.ts` (app ID `org.cryptopop.wallet`).
