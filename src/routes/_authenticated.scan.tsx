import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ArrowLeft, Loader2, Keyboard, Wallet, ScanLine, X } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { claimAtHub, type HubClaimError, type HubClaimResult } from "@/lib/pop-hub";
import { useEnsureWallet } from "@/hooks/use-ensure-wallet";
import logo from "@/assets/cryptopop-logo.png";

export const Route = createFileRoute("/_authenticated/scan")({
  validateSearch: (s: Record<string, unknown>) => ({
    qr: typeof s.qr === "string" ? s.qr : undefined,
  }),
  head: () => ({ meta: [{ title: "Scan to Earn — CryptoPOP" }] }),
  component: ScanPage,
});

const ERROR_COPY: Record<HubClaimError, string> = {
  invalid_qr: "Not a CryptoPOP QR.",
  bad_signature: "QR signature invalid — possibly tampered.",
  event_not_found: "This event no longer exists.",
  event_not_started: "This event hasn't started yet.",
  event_ended: "This event has ended.",
  outside_geofence: "You're outside the event area.",
  low_gps_accuracy: "GPS signal too weak. Move outdoors and retry.",
  already_claimed: "This wallet already claimed POP for this event.",
  no_wallet: "Wallet setup interrupted. Open your wallet, then try again.",
  hub_unreachable: "Couldn't reach CryptoPOP. Check your connection and retry.",
};

type Success = Extract<HubClaimResult, { ok: true }>;


const POP_COLORS = ["#ff3ea5", "#ff8a00", "#ffd400", "#3ad29f", "#3ec1ff", "#a855f7"];

function fireConfetti() {
  const base = { spread: 90, startVelocity: 55, scalar: 1.1, colors: POP_COLORS };
  confetti({ ...base, particleCount: 120, origin: { x: 0.5, y: 0.6 } });
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.7 } }), 350);
  setTimeout(() => confetti({ ...base, particleCount: 100, spread: 160, origin: { x: 0.5, y: 0.4 } }), 600);
}

function ScanPage() {
  const claim = useServerFn(claimPop);
  const { address, settingUp: walletSettingUp, error: walletError, retry: retryWallet } = useEnsureWallet();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const handledRef = useRef(false);
  const { qr: qrFromUrl } = Route.useSearch();

  // Deep-linked / routed-in QR (e.g. scanned from the wallet camera):
  // claim it as soon as the wallet is ready.
  useEffect(() => {
    if (!qrFromUrl || !address || handledRef.current) return;
    void submit(qrFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrFromUrl, address]);



  async function submit(qr: string) {
    if (handledRef.current || busy || success) return;

    // New-style QR codes (admin/codes) encode a URL like
    // https://cryptopop.sg/claim/<token>. Route those to the claim page,
    // which handles redemption + geofence on its own.
    const claimMatch = qr.match(/\/claim\/([A-Za-z0-9_-]{8,64})/);
    if (claimMatch) {
      handledRef.current = true;
      window.location.assign(`/claim/${claimMatch[1]}`);
      return;
    }

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
        // Inline celebration — no navigation, no route race, no cached-bundle
        // surprise. Scanner unmounts via conditional render below.
        setSuccess(result);
        setBusy(false);
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

  if (success) {
    return <Celebration result={success} />;
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
            {!busy && address ? (
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
            ) : null}
            {!busy && address && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-2/3 w-2/3 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            )}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-primary-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm">Claiming your POP…</p>
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

const REDIRECT_SECONDS = 8;

function Celebration({ result }: { result: Success }) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) fireConfetti();
  }, []);

  useEffect(() => {
    if (cancelled) return;
    if (secondsLeft <= 0) {
      window.location.assign("/app");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, cancelled]);

  const headline = "YOU GOT POP!";

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #ff3ea5, #ff8a00, #ffd400, #3ad29f, #3ec1ff, #a855f7)",
          backgroundSize: "300% 300%",
          animation: "pop-gradient 8s ease infinite",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-background/30 backdrop-blur-[2px]" />

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => {
          const left = (i * 37) % 100;
          const delay = (i % 7) * 0.7;
          const dur = 6 + (i % 5);
          const emoji = ["✨", "🎉", "💥", "⭐️", "🪙", "🎊"][i % 6];
          return (
            <span
              key={i}
              className="absolute text-3xl opacity-80"
              style={{
                left: `${left}%`,
                bottom: "-10%",
                animation: `pop-float ${dur}s linear ${delay}s infinite`,
              }}
            >
              {emoji}
            </span>
          );
        })}
      </div>

      <button
        onClick={() => setCancelled(true)}
        aria-label="Stay on this page"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-lg backdrop-blur transition hover:scale-110"
      >
        <X className="h-5 w-5" />
      </button>

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className="mb-6"
          style={{ animation: "pop-in 0.6s cubic-bezier(.34,1.56,.64,1) both, pop-wobble 3s ease-in-out 0.6s infinite" }}
        >
          <img
            src={logo}
            alt="CryptoPOP"
            className="h-32 w-32 drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          />
        </div>

        <h1 className="font-display text-5xl font-black tracking-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.15)] sm:text-6xl">
          {headline.split("").map((ch, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                color: POP_COLORS[i % POP_COLORS.length],
                animation: `pop-letter 0.5s cubic-bezier(.34,1.56,.64,1) both`,
                animationDelay: `${0.3 + i * 0.05}s`,
                WebkitTextStroke: "2px rgba(0,0,0,0.85)",
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        <div
          className="mt-8 inline-flex items-baseline gap-2 rounded-full bg-background px-8 py-4 shadow-2xl ring-4 ring-foreground/10"
          style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) 0.9s both" }}
        >
          <span className="font-display text-5xl font-black tabular-nums text-foreground">+{result.reward}</span>
          <span className="text-xl font-semibold text-muted-foreground">POP</span>
        </div>

        <p
          className="mt-4 max-w-xs font-display text-lg font-semibold text-foreground/90"
          style={{ animation: "pop-in 0.5s ease-out 1.1s both" }}
        >
          {result.eventName}
        </p>
        <p
          className="mt-1 text-sm text-foreground/80"
          style={{ animation: "pop-in 0.5s ease-out 1.2s both" }}
        >
          New balance · <span className="font-bold">{result.newBalance.toLocaleString()} POP</span>
        </p>

        <div className="mt-10 grid w-full grid-cols-2 gap-3">
          <Button asChild variant="secondary" size="lg" onClick={() => setCancelled(true)}>
            <a href="/scan">
              <ScanLine className="mr-2 h-4 w-4" /> Scan another
            </a>
          </Button>
          <Button asChild size="lg" onClick={() => setCancelled(true)}>
            <a href="/app">
              <Wallet className="mr-2 h-4 w-4" /> Wallet
            </a>
          </Button>
        </div>

        <p className="mt-6 h-5 text-xs uppercase tracking-widest text-foreground/70">
          {cancelled ? "Take your time" : `Returning to wallet in ${secondsLeft}…`}
        </p>
      </main>
    </div>
  );
}
