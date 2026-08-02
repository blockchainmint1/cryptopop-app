/**
 * Push notifications (native only).
 *
 * Everything here is a no-op in the browser / Lovable preview — `isNative()`
 * is false, so the web build never touches the Capacitor plugin.
 */
import { isNative, nativePlatform } from "./platform";

const PREF_KEY = "cryptopop.push.enabled.v1";

export function pushPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREF_KEY) !== "off";
}

export function setPushPreference(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function pushAvailable(): boolean {
  return isNative();
}

type RegisterOpts = {
  onToken: (token: string, platform: "ios" | "android") => void | Promise<void>;
  onTap?: (url: string) => void;
};

let wired = false;

/** Ask for permission, register with APNs/FCM, and report the device token. */
export async function registerPush({ onToken, onTap }: RegisterOpts): Promise<boolean> {
  if (!isNative()) return false;
  const platform = nativePlatform();
  if (platform === "web") return false;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return false;

    if (!wired) {
      wired = true;
      await PushNotifications.addListener("registration", (t) => {
        void onToken(t.value, platform);
      });
      await PushNotifications.addListener("registrationError", (e) => {
        console.error("push registration error", e);
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const url = (a.notification.data as Record<string, string> | undefined)?.["url"];
        if (url && onTap) onTap(url);
      });
    }

    await PushNotifications.register();
    return true;
  } catch (e) {
    console.error("push setup failed", e);
    return false;
  }
}

export async function unregisterPush() {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
    wired = false;
  } catch {
    /* ignore */
  }
}
