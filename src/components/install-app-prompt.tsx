import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isNative } from "@/lib/native/platform";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "cp-install-dismissed";
let deferred: BIPEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    window.dispatchEvent(new Event("cp-install-ready"));
  });
}

/** "Add POP Wallet to your home screen" card for iPhone and Android browsers. */
export function InstallAppPrompt({ dismissible = true }: { dismissible?: boolean }) {
  const [mode, setMode] = useState<"hidden" | "android" | "ios" | "other">("hidden");

  useEffect(() => {
    if (isNative()) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (dismissible) {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* ignore */
      }
    }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    const pick = () => setMode(deferred ? "android" : ios ? "ios" : android ? "other" : "hidden");
    pick();
    window.addEventListener("cp-install-ready", pick);
    return () => window.removeEventListener("cp-install-ready", pick);
  }, [dismissible]);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setMode("hidden");
  };

  return (
    <Card className="relative border-primary/30 bg-primary/10 p-4 text-sm">
      {dismissible && (
        <button
          type="button"
          aria-label="Hide"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <p className="flex items-center gap-2 pr-8 font-display text-base uppercase">
        <Download className="h-4 w-4 text-primary" /> Put POP Wallet on your home screen
      </p>
      {mode === "android" && (
        <>
          <p className="mt-1 text-muted-foreground">Opens full-screen like an app. No download store needed.</p>
          <Button
            size="sm"
            className="mt-3 w-full rounded-full"
            onClick={async () => {
              if (!deferred) return;
              await deferred.prompt();
              const c = await deferred.userChoice;
              deferred = null;
              if (c.outcome === "accepted") setMode("hidden");
            }}
          >
            Install app
          </Button>
        </>
      )}
      {mode === "ios" && (
        <p className="mt-1 text-muted-foreground">
          In Safari, tap <Share className="inline h-3.5 w-3.5" /> Share, then{" "}
          <span className="font-semibold text-foreground">Add to Home Screen</span>.
        </p>
      )}
      {mode === "other" && (
        <p className="mt-1 text-muted-foreground">
          In Chrome, tap the ⋮ menu, then <span className="font-semibold text-foreground">Install app</span>{" "}
          (not “Create shortcut”).
        </p>
      )}
    </Card>
  );
}
