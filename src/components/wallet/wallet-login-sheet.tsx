import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NECTARPAY_TRUSTED_HOSTS } from "@/lib/nectarpay";
import { derivePrivateKey } from "@/lib/wallet/sign";
import { signTxcMessage } from "@/lib/wallet/txc-message";

export type WalletLoginRequest = {
  host: string;
  nonce: string;
  callback: string;
  id: string | null;
  message: string | null;
  expiresAt: number | null;
};

function buildMessage(host: string, nonce: string) {
  return [
    `${host} wants you to sign in with your TXC wallet.`,
    ``,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    `By signing, you authorize a sign-in session for payHME.`,
    `This signature does not authorize any payment.`,
  ].join("\n");
}

function isTrusted(host: string) {
  const h = host.toLowerCase();
  return NECTARPAY_TRUSTED_HOSTS.some((t) => h === t || h.endsWith(`.${t}`));
}

export function WalletLoginSheet({
  request,
  onClose,
  address,
  mnemonic,
}: {
  request: WalletLoginRequest | null;
  onClose: () => void;
  address: string | null;
  mnemonic: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const cbHost = (() => {
    try {
      return request ? new URL(request.callback).hostname : "";
    } catch {
      return "";
    }
  })();
  const trusted = !!request && isTrusted(cbHost);
  const expired = !!request?.expiresAt && request.expiresAt < Date.now();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  async function approve() {
    if (!request || !address || !mnemonic) return toast.error("Unlock your wallet first");
    setBusy(true);
    try {
      const message = request.message ?? buildMessage(request.host, request.nonce);
      if (!message.includes(`Nonce: ${request.nonce}`)) throw new Error("Sign-in request looks wrong");
      const signature = signTxcMessage(derivePrivateKey(mnemonic), message);
      const body = request.id
        ? { id: request.id, address, signature, message }
        : { chain: "txc", address, signature, message, nonce: request.nonce };
      const res = await fetch(request.callback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Sign-in failed (${res.status})`);
      }
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setDone(false);
    onClose();
  }

  return (
    <Sheet open={!!request} onOpenChange={(v) => !v && close()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase">Sign in with wallet</SheetTitle>
          <SheetDescription>This proves you own your wallet. It can't move any money.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 pb-6 pt-2">
          {done ? (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-xl font-bold uppercase">Signed in</p>
              <p className="mt-1 text-sm text-muted-foreground">Head back to {request?.host}.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <KeyRound className="h-5 w-5 text-primary" /> {request?.host}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in as <span className="font-mono text-foreground">{short}</span>?
                </p>
              </div>
              {!trusted && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This request is from {cbHost || "an unknown site"}, which isn't a known NectarPay
                  site. Only continue if you trust it.
                </p>
              )}
              {expired && (
                <p className="text-sm text-destructive">This code has expired — refresh the page and scan again.</p>
              )}
              <Button
                className="h-12 w-full rounded-full"
                disabled={busy || expired}
                onClick={() => void approve()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve sign-in"}
              </Button>
            </>
          )}
          <Button variant="secondary" className="w-full rounded-full" onClick={close}>
            {done ? "Done" : "Cancel"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
