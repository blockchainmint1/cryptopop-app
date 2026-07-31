/**
 * Native shell bootstrap — status bar styling, splash hide, safe-area class.
 * Every call is a no-op in the browser / Lovable preview.
 */
import { isNative, nativePlatform } from "./platform";

let started = false;

export async function initNativeShell() {
  if (started || typeof document === "undefined") return;
  started = true;

  if (!isNative()) return;

  document.documentElement.classList.add("native", `native-${nativePlatform()}`);

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0B0710" });
    }
  } catch {
    /* plugin unavailable */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* plugin unavailable */
  }
}
