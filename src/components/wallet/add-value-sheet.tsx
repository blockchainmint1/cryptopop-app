import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createOnrampLinkToken,
  fundWithAch,
  getOnrampStatus,
} from "@/lib/onramp.functions";

const PRESETS = [25, 50, 100, 250];
const PLAID_SRC = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

declare global {
  interface Window {
    Plaid?: {
      create: (opts: Record<string, unknown>) => { open: () => void; exit: () => void };
    };
  }
}

function loadPlaid(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Plaid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAID_SRC}"]`);
    const el = existing ?? document.createElement("script");
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error("Could not load the bank connector")));
    if (!existing) {
      el.src = PLAID_SRC;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

type Done = {
  reference: string;
  status: string;
  amountUsd: number;
  bankName: string | null;
  mask: string | null;
};

export function AddValueSheet({
  open,
  onOpenChange,
  address,
  onFunded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string | null;
  onFunded?: () => void;
}) {
  const status = useServerFn(getOnrampStatus);
  const makeLinkToken = useServerFn(createOnrampLinkToken);
  const fund = useServerFn(fundWithAch);

  const [ready, setReady] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    status()
      .then((s) => setReady(s.ready))
      .catch(() => setReady(false));
  }, [open, status]);

  const usd = Number(amount);
  const valid = Number.isFinite(usd) && usd >= 1 && usd <= 10_000;

  async function start() {
    if (!address || !valid) return;
    setBusy(true);
    try {
      await loadPlaid();
      const { linkToken } = await makeLinkToken({ data: { address } });
      const handler = window.Plaid!.create({
        token: linkToken,
        onSuccess: async (publicToken: string, metadata: { accounts?: Array<{ id: string }> }) => {
          try {
            const res = await fund({
              data: {
                address,
                publicToken,
                accountId: metadata?.accounts?.[0]?.id ?? null,
                amountUsd: usd,
              },
            });
            setDone(res);
            toast.success("Bank transfer started");
            onFunded?.();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not start the transfer");
          } finally {
            setBusy(false);
          }
        },
        onExit: () => setBusy(false),
      });
      handler.open();
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not open your bank");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase">Add value</SheetTitle>
          <SheetDescription>
            Buy TSD (Texas Stable Dollar) with a bank transfer. 1 TSD = $1.
          </SheetDescription>
        </SheetHeader>

        {done ? (
          <div className="space-y-4 pb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-2xl uppercase">
              ${done.amountUsd.toFixed(2)} on the way
            </p>
            <p className="text-sm text-muted-foreground">
              {done.bankName ? `${done.bankName}${done.mask ? ` ••${done.mask}` : ""} · ` : ""}
              ACH transfers usually settle in 1–3 business days. Your TSD lands in this wallet as
              soon as funds clear.
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Ref {done.reference}
            </p>
            <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`flex-1 rounded-full border px-2 py-2 font-display text-sm transition ${
                    amount === String(p)
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-white/15 text-muted-foreground"
                  }`}
                >
                  ${p}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl text-muted-foreground">
                $
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="h-16 pl-9 text-right font-display text-3xl"
                aria-label="Amount in dollars"
              />
            </div>

            {ready === false && (
              <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
                Bank onramp is being switched on. Check back shortly.
              </p>
            )}

            <Button
              className="h-12 w-full rounded-full"
              disabled={!valid || busy || !address || ready === false}
              onClick={start}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-1.5 h-4 w-4" />
              )}
              {busy ? "Connecting…" : "Link bank & add value"}
            </Button>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bank linking is handled by Plaid — we never see your login. Onramp services provided
              by VectorPay LLC. ACH transfers settle in 1–3 business days.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
