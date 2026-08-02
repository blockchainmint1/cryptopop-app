import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Offline gate for the native shell.
 *
 * The app loads the live site, so a dropped connection would otherwise show a
 * blank webview. This renders a branded retry screen instead.
 */
export function OfflineGate() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/5">
        <WifiOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold uppercase tracking-tight">You're offline</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        POP Wallet needs a connection to check balances and scan in. Your keys stay safe on this
        device.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
