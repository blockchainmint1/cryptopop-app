import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CryptoPOP Wallet — native shell (Android + iOS).
 *
 * The web app is server-rendered (TanStack Start on Cloudflare), so the native
 * shell does NOT bundle a static build. It loads the live site, which means
 * every web deploy updates the app instantly with no store/APK re-release.
 *
 * Point CAP_SERVER_URL at the preview URL while testing:
 *   CAP_SERVER_URL=https://id-preview--b8b9779f-344d-4518-a3e5-793851a03a68.lovable.app
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://app.cryptopop.org";

const config: CapacitorConfig = {
  appId: "org.cryptopop.wallet",
  appName: "CryptoPOP Wallet",
  // Unused (remote server mode) but required by the CLI.
  webDir: "native/webdir",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
    // Anything outside these hosts opens in the system browser.
    allowNavigation: ["cryptopop.org", "*.cryptopop.org", "*.lovable.app"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0710",
  },
  ios: {
    backgroundColor: "#0B0710",
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#0B0710",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK", // dark UI => light content
      backgroundColor: "#0B0710",
      overlaysWebView: false,
    },
  },
};

export default config;
