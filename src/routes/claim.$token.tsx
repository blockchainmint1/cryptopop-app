import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, CheckCircle2, AlertCircle, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lookupQrCode, redeemQrCode } from "@/lib/qr-codes.functions";
import { maybeRedirectToWalletApp } from "@/lib/wallet-app";

export const Route = createFileRoute("/claim/$token")({
  beforeLoad: ({ location }) => maybeRedirectToWalletApp(location),
  head: () => ({
    meta: [
      { title: "Claim POP — CryptoPOP" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClaimPage,
});

type Lookup = Awaited<ReturnType<typeof lookupQrCode>>;

function ClaimPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const lookup = useServerFn(lookupQrCode);
  const redeem = useServerFn(redeemQrCode);

  const [info, setInfo] = useState<Lookup | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; popReward: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lookup({ data: { token } })
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Lookup failed"));
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setAuthed(!!session?.user),
    );
    return () => sub.subscription.unsubscribe();
  }, [token, lookup]);

  async function doRedeem() {
    if (!info || !info.found) return;
    setBusy(true);
    setError(null);
    try {
      let coords: { lat: number; lng: number } | undefined;
      if (info.requiresLocation) {
        coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported on this device"));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            (e) => reject(new Error(e.message || "Could not get your location")),
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
      }
      const res = await redeem({ data: { token, ...(coords ?? {}) } });
      navigate({
        to: "/scan/success",
        search: {
          event: info.found ? (info.eventName || info.label) : "Reward",
          reward: res.popReward,
          balance: res.balance ?? 0,
        },
      });
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (!info && !error) {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (error && !info) {
    return (
      <Centered>
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="font-display text-lg">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </Centered>
    );
  }

  if (info && !info.found) {
    return (
      <Centered>
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-display text-lg">Code not found</p>
          <p className="text-sm text-muted-foreground">
            This QR may have been removed.
          </p>
        </Card>
      </Centered>
    );
  }

  if (info && info.found && (info.expired || info.disabled || info.exhausted)) {
    const msg = info.expired
      ? "This code has expired."
      : info.disabled
        ? "This code has been disabled."
        : "This code has already been claimed.";
    return (
      <Centered>
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="font-display text-xl">{info.label}</p>
          <p className="text-sm text-muted-foreground">{msg}</p>
        </Card>
      </Centered>
    );
  }

  if (result) {
    return (
      <Centered>
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <p className="font-display text-3xl font-bold">+{result.popReward} POP</p>
          <p className="text-sm text-muted-foreground">
            Added to your wallet from <strong>{info && info.found ? info.label : ""}</strong>.
          </p>
          <Button onClick={() => navigate({ to: "/app" })} className="w-full">
            View wallet
          </Button>
        </Card>
      </Centered>
    );
  }

  return (
    <Centered>
      <Card className="max-w-md w-full p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Scan reward
          </p>
          <p className="font-display text-2xl font-bold">{info!.found && info!.label}</p>
          {info!.found && info!.eventName && (
            <p className="text-xs text-muted-foreground">{info!.eventName}</p>
          )}
        </div>

        <div className="rounded-xl bg-muted/40 p-4 text-center">
          <p className="flex items-center justify-center gap-2 font-display text-3xl font-bold text-primary">
            <Coins className="h-6 w-6" />
            {info!.found && info!.popReward} POP
          </p>
          {info!.found && info!.requiresLocation && (
            <p className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> Location required
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        {authed === null ? (
          <Button disabled className="w-full">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…
          </Button>
        ) : authed ? (
          <Button onClick={doRedeem} disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Claiming…
              </>
            ) : (
              "Claim POP"
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              Sign in to claim this reward.
            </p>
            <Button asChild className="w-full">
              <Link
                to="/login"
                search={{ redirect: `/claim/${token}` } as never}
              >
                Sign in to claim
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
