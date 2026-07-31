import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CryptoPOP Wallet — Android shell.
 *
 * The web app is server-rendered (TanStack Start on Cloudflare), so the native
 * shell does NOT bundle a static build. It loads the live site, which means
 * every web deploy updates the app instantly with no store/APK re-release.
 *
 * Point CAP_SERVER_URL at the preview URL while testing:
 *   CAP_SERVER_URL=https://id-preview--b8b9779f-344d-4518-a3e5-793851a03a68.lovable.app
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://cryptopop.org";

const config: CapacitorConfig = {
  appId: "org.cryptopop.wallet",
  appName: "CryptoPOP Wallet",
  // Unused (remote server mode) but required by the CLI.
  webDir: "native/webdir",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    // Anything outside these hosts opens in the system browser.
    allowNavigation: ["cryptopop.org", "*.cryptopop.org", "*.lovable.app"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0710",
  },
};

export default config;
