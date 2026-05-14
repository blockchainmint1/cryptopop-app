import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ArrowLeft, Loader2, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { claimPop, type ClaimError } from "@/lib/qr.functions";
import { useEnsureWallet } from "@/hooks/use-ensure-wallet";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan to Earn — CryptoPOP" }] }),
  component: ScanPage,
});

const ERROR_COPY: Record<ClaimError, string> = {
  invalid_qr: "Not a CryptoPOP QR.",
  bad_signature: "QR signature invalid — possibly tampered.",
  event_not_found: "This event no longer exists.",
  event_not_started: "This event hasn't started yet.",
  event_ended: "This event has ended.",
  outside_geofence: "You're outside the event area.",
  low_gps_accuracy: "GPS signal too weak. Move outdoors and retry.",
  already_claimed: "You've already claimed POP for this event.",
  no_wallet: "Wallet setup interrupted. Open your wallet, then try again.",
};

function ScanPage() {
  const navigate = useNavigate();
  const claim = useServerFn(claimPop);
  const { address, settingUp: walletSettingUp, error: walletError, retry: retryWallet } = useEnsureWallet();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const handledRef = useRef(false);

  async function submit(qr: string) {
    if (handledRef.current || busy) return;
    if (!address) {
      toast.error(walletError ? "Wallet setup failed" : "Setting up your wallet…", {
        description: walletError ? "Tap retry, then scan again." : "Hold on a second, then scan again.",
      });
      return;
    }
    handledRef.current = true;
    setBusy(true);

    let coords: GeolocationPosition;
    try {
      coords = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
    } catch {
      toast.error("Location permission required");
      setBusy(false);
      handledRef.current = false;
      return;
    }

    try {
      const result = await claim({
        data: {
          qr,
          lat: coords.coords.latitude,
          lng: coords.coords.longitude,
          accuracy: coords.coords.accuracy,
        },
      });

      if (result.ok) {
        try {
          await navigate({
            to: "/scan/success",
            search: {
              event: result.eventName,
              reward: result.reward,
              balance: result.newBalance,
            },
          });
        } catch (navErr) {
          // Navigation failed (e.g. search validation) — recover instead of hanging
          toast.success(`+${result.reward} POP earned!`);
          await navigate({ to: "/app" });
        }
      } else {
        toast.error(ERROR_COPY[result.reason] ?? "Claim failed");
        setBusy(false);
        setTimeout(() => {
          handledRef.current = false;
        }, 2000);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      handledRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Wallet
          </Link>
          <span className="font-display text-sm font-semibold">Scan to Earn</span>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Manual entry"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-6">
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-square w-full bg-black">
            <Scanner
              onScan={(codes) => {
                const value = codes[0]?.rawValue;
                if (value) submit(value);
              }}
              onError={() => {}}
              constraints={{ facingMode: "environment" }}
              styles={{ container: { width: "100%", height: "100%" } }}
              components={{ finder: false }}
              sound={false}
            />
            {/* Reticle */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {!address && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center">
                {walletSettingUp ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Button onClick={retryWallet}>Retry wallet setup</Button>
                )}
                <p className="text-sm text-foreground">
                  {walletSettingUp ? "Setting up your wallet…" : "Wallet setup needs a retry."}
                </p>
              </div>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Point at the event QR. We'll verify your location automatically.
        </p>

        {showManual && (
          <Card className="mt-6 p-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Paste code
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="cryptopop://claim?e=..."
                className="font-mono text-xs"
              />
              <Button
                onClick={() => manual && submit(manual)}
                disabled={!manual || busy}
              >
                Claim
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
