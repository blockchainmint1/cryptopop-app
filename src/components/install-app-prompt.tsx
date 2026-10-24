import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isNative } from "@/lib/native/platform";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "cp-install-dismissed";
const MODAL_SHOWN_KEY = "cp-install-modal-shown";

let deferred: BIPEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    window.dispatchEvent(new Event("cp-install-ready"));
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function platform(): "ios" | "android" | "other" {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** Chad-style modal: manual install instructions when the browser won't offer its own prompt. */
function InstallInstructionsDialog({ os, onClose }: { os: "ios" | "android"; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add POP Wallet to your home screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-neon-lime/40 bg-card p-6 shadow-[0_0_60px_-10px_var(--neon-purple)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neon-purple/25">
            <Download className="h-7 w-7 text-neon-lime" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl uppercase leading-tight tracking-wide text-neon-lime">
              Add POP Wallet to your home screen
            </p>
            {os === "android" ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                In Chrome, open the browser menu and choose{" "}
                <span className="font-semibold text-foreground">Install app</span>. Do not choose{" "}
                <span className="font-semibold text-foreground">Create shortcut</span> — that only makes a
                bookmark and may show the wrong icon.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                In Safari, tap <Share className="inline h-3.5 w-3.5" />{" "}
                <span className="font-semibold text-foreground">Share</span>, then{" "}
                <span className="font-semibold text-foreground">Add to Home Screen</span>.
              </p>
            )}
          </div>
        </div>
        <Button className="mt-6 w-full rounded-full font-display text-lg uppercase tracking-wide" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

/** "Add POP Wallet to your home screen" card for iPhone and Android browsers. */
export function InstallAppPrompt({ dismissible = true }: { dismissible?: boolean }) {
  const [mode, setMode] = useState<"hidden" | "android" | "ios" | "other">("hidden");
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (isNative()) return;
    if (isStandalone()) return;
    if (dismissible) {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* ignore */
      }
    }
    const os = platform();
    const pick = () => setMode(deferred ? "android" : os === "ios" ? "ios" : os === "android" ? "other" : "hidden");
    pick();
    window.addEventListener("cp-install-ready", pick);

    // No beforeinstallprompt (e.g. no service worker yet): show the how-to popup once per device.
    let timer: number | undefined;
    if (dismissible && os === "android" && !deferred) {
      timer = window.setTimeout(() => {
        if (deferred || isStandalone()) return;
        try {
          if (localStorage.getItem(MODAL_SHOWN_KEY)) return;
          localStorage.setItem(MODAL_SHOWN_KEY, "1");
        } catch {
          /* ignore */
        }
        setShowDialog(true);
      }, 1500);
    }
    return () => {
      window.removeEventListener("cp-install-ready", pick);
      if (timer) window.clearTimeout(timer);
    };
  }, [dismissible]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setMode("hidden");
  };

  const dialogOs = platform() === "ios" ? "ios" : "android";

  return (
    <>
      {showDialog && <InstallInstructionsDialog os={dialogOs} onClose={() => setShowDialog(false)} />}
      {mode !== "hidden" && (
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
            <>
              <p className="mt-1 text-muted-foreground">
                In Safari, tap <Share className="inline h-3.5 w-3.5" /> Share, then{" "}
                <span className="font-semibold text-foreground">Add to Home Screen</span>.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full rounded-full"
                onClick={() => setShowDialog(true)}
              >
                Show me how
              </Button>
            </>
          )}
          {mode === "other" && (
            <>
              <p className="mt-1 text-muted-foreground">
                In Chrome, tap the ⋮ menu, then <span className="font-semibold text-foreground">Install app</span>{" "}
                (not “Create shortcut”).
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full rounded-full"
                onClick={() => setShowDialog(true)}
              >
                Show me how
              </Button>
            </>
          )}
        </Card>
      )}
    </>
  );
}
