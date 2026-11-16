import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet/wallet-context";
import { getBiometricStatus, unlockWithBiometric } from "@/lib/native/biometric";
import { hasPasskeyUnlock } from "@/lib/wallet/passkey-unlock";
import logo from "@/assets/cryptopop-logo.png";

/** Password / biometric unlock for an existing on-device vault. */
export function UnlockScreen() {
  const { unlock, unlockPasskey, forget } = useWallet();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState<{ available: boolean; enabled: boolean; kind: "native" | "passkey" }>({
    available: false,
    enabled: false,
    kind: "native",
  });

  useEffect(() => {
    getBiometricStatus()
      .then(setBio)
      .catch(() => undefined);
  }, []);

  const tryBiometric = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (bio.kind === "passkey") {
        await unlockPasskey();
        return;
      }
      const pw = await unlockWithBiometric();
      if (!pw) return;
      const ok = await unlock(pw);
      if (!ok) setError("Saved biometric password no longer works. Use your password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Face ID / fingerprint unlock didn't work. Use your password.");
      if (bio.kind === "passkey") setBio((b) => ({ ...b, enabled: hasPasskeyUnlock() }));
    } finally {
      setBusy(false);
    }
  }, [unlock, unlockPasskey, bio.kind]);

  // Auto-prompt once in the native app. Phone browsers only allow the face /
  // fingerprint prompt straight after a tap, so the web app shows a button.
  useEffect(() => {
    if (bio.enabled && bio.kind === "native") void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio.enabled]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const ok = await unlock(password);
    setBusy(false);
    if (!ok) setError("Wrong password.");
    else setPassword("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="text-center">
          <img src={logo} alt="CryptoPOP" className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 font-display text-4xl font-bold uppercase tracking-tight">
            Unlock your wallet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the password you set on this device.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl"
        >
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-12 w-full rounded-full" disabled={busy || !password}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
          {bio.enabled && (
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-full"
              onClick={tryBiometric}
              disabled={busy}
            >
              <Fingerprint className="mr-1.5 h-4 w-4" /> Unlock with Face ID / fingerprint
            </Button>
          )}
        </form>

        <button
          onClick={() => {
            if (
              window.confirm(
                "Remove this wallet from this device? You can only get it back with your Cold Storage Coin or recovery phrase.",
              )
            ) {
              forget();
              toast.success("Wallet removed from this device");
            }
          }}
          className="mt-6 text-center text-xs text-muted-foreground underline underline-offset-4"
        >
          Set up a different wallet
        </button>
        <Link to="/help" className="mt-4 block text-center text-xs text-muted-foreground underline underline-offset-4">
          How CryptoPOP works (Help)
        </Link>
      </main>
    </div>
  );
}
