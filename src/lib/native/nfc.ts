/**
 * Read one NFC card's ID. In the Android/iOS app this uses the native reader;
 * in Chrome on Android it uses Web NFC. Returns a normalized ID.
 * The native plugin is imported lazily so the web build never loads it.
 */
import { isNative } from "./platform";
import { normalizeUid } from "@/lib/wallet/nfc-cards";

const toHex = (bytes: number[]) => bytes.map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");

export function nfcReadAvailable(): boolean {
  return isNative() || (typeof window !== "undefined" && "NDEFReader" in window);
}

export async function readCardId(timeoutMs = 30000): Promise<string> {
  if (isNative()) {
    const { CapacitorNfc } = await import("@capgo/capacitor-nfc");
    const { status } = await CapacitorNfc.getStatus();
    if (status === "NO_NFC") throw new Error("This phone has no NFC reader");
    if (status === "NFC_DISABLED") throw new Error("Turn on NFC in your phone settings, then try again");
    return new Promise<string>((resolve, reject) => {
      let done = false;
      const handles: { remove: () => Promise<void> }[] = [];
      const finish = async (fn: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        await Promise.all(handles.map((h) => h.remove().catch(() => {})));
        await CapacitorNfc.stopScanning().catch(() => {});
        fn();
      };
      const timer = setTimeout(() => finish(() => reject(new Error("No card detected"))), timeoutMs);
      CapacitorNfc.addListener("nfcEvent", (e) => {
        const id = normalizeUid(toHex(e.tag?.id ?? []));
        finish(() => (id ? resolve(id) : reject(new Error("Card has no readable ID"))));
      }).then((h) => handles.push(h));
      CapacitorNfc.startScanning({ invalidateAfterFirstRead: true, iosSessionType: "tag" }).catch((err) =>
        finish(() => reject(err instanceof Error ? err : new Error("Couldn't start NFC"))),
      );
    });
  }

  const Reader = (window as unknown as { NDEFReader?: new () => any }).NDEFReader;
  if (!Reader) throw new Error("Card reading isn't available on this device");
  const reader = new Reader();
  const ctrl = new AbortController();
  await reader.scan({ signal: ctrl.signal });
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error("No card detected"));
    }, timeoutMs);
    reader.onreading = (e: { serialNumber?: string }) => {
      clearTimeout(timer);
      ctrl.abort();
      resolve(normalizeUid(e.serialNumber ?? ""));
    };
    reader.onreadingerror = () => {
      clearTimeout(timer);
      ctrl.abort();
      reject(new Error("Couldn't read that card — try again"));
    };
  });
}
