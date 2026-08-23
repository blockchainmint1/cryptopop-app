import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AMOUNT_CHIPS,
  DISCLAIMERS,
  HANDOFF_ASSETS,
  ORDER_MAX_USD,
  ORDER_MIN_USD,
  quoteOrder,
  saveOrder,
  type OrderSide,
} from "@/lib/handoff";
import { getHandoffStatus, startHandoffOrder } from "@/lib/handoff.functions";

type Step = "intro" | "amount" | "details" | "review" | "handoff";

export function TopUpSheet({
  open,
  onOpenChange,
  address,
  side = "buy",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string | null;
  side?: OrderSide;
}) {
  const status = useServerFn(getHandoffStatus);
  const startOrder = useServerFn(startHandoffOrder);

  const [ready, setReady] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [amount, setAmount] = useState("100");
  const assetIdx = 0;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    orderId: string;
    feeUsd: number;
    registered: boolean;
    detail: string | null;
    handoffUrl: string | null;
  } | null>(null);

  const picked = HANDOFF_ASSETS[assetIdx]!;

  useEffect(() => {
    if (!open) return;
    setStep("intro");
    setResult(null);
    setAccepted([]);
    status()
      .then((s) => setReady(s.ready))
      .catch(() => setReady(false));
  }, [open, status]);

  const usd = Number(amount);
  const valid = Number.isFinite(usd) && usd >= ORDER_MIN_USD && usd <= ORDER_MAX_USD;
  const quote = useMemo(() => quoteOrder(side, valid ? usd : 0), [side, usd, valid]);
  const allAccepted = DISCLAIMERS.every((d) => accepted.includes(d.id));
  const detailsValid = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function place() {
    if (!valid || !detailsValid || !allAccepted) return;
    setBusy(true);
    try {
      const res = await startOrder({
        data: {
          side,
          usd,
          asset: picked.asset,
          chain: picked.chain,
          assetAmount: quote.assetAmount.toFixed(2),
          address: side === "buy" ? address : null,
          name: name.trim(),
          email: email.trim(),
          acceptedDisclaimers: accepted,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      setResult(res);
      saveOrder({
        reference: res.orderId,
        side,
        status: res.registered ? "submitted" : "not_registered",
        usd,
        feeUsd: res.feeUsd,
        settlementUsd: quote.settlementUsd,
        asset: picked.asset,
        chain: picked.chain,
        address: side === "buy" ? address : null,
        name: name.trim(),
        email: email.trim(),
        checkoutUrl: res.handoffUrl,
        registered: res.registered,
        createdAt: Date.now(),
      });
      setStep("handoff");
      if (!res.registered && res.detail) toast.error(res.detail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place your order");
    } finally {
      setBusy(false);
    }
  }

  const title = side === "buy" ? "Top up" : "Cash out";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display uppercase">
            {step !== "intro" && step !== "handoff" && (
              <button
                type="button"
                aria-label="Back"
                onClick={() =>
                  setStep(step === "review" ? "details" : step === "details" ? "amount" : "intro")
                }
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {title}
          </SheetTitle>
          <SheetDescription>
            {side === "buy"
              ? "Buy stablecoins with a bank transfer. Delivered straight to your self-custody wallet."
              : "Sell stablecoins back to your bank account."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {ready === false && (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
              {title} is being switched on. Check back shortly.
            </p>
          )}

          {step === "intro" && (
            <div className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• VectorPay, our licensed partner, handles identity checks and your bank.</li>
                <li>• CryptoPOP never holds your crypto or your bank credentials.</li>
                <li>• Service fee is 1% of the order.</li>
                <li>• Bank settlement takes 1–3 business days.</li>
                <li>
                  • Orders from ${ORDER_MIN_USD} to ${ORDER_MAX_USD}. Larger amounts go through our
                  trade desk — email desk@cryptopop.org.
                </li>
              </ul>
              <Button
                className="h-12 w-full rounded-full"
                disabled={ready === false}
                onClick={() => setStep("amount")}
              >
                Get started
              </Button>
            </div>
          )}

          {step === "amount" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {AMOUNT_CHIPS.map((p) => (
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

              <div className="rounded-2xl border border-primary/40 bg-primary/10 px-3 py-3 text-sm">
                <span className="block font-display uppercase">{picked.asset}</span>
                <span className="text-[11px] text-muted-foreground">{picked.label}</span>
              </div>


              <Breakdown side={side} quote={quote} asset={picked.asset} />

              {!valid && (
                <p className="text-xs text-muted-foreground">
                  Enter an amount between ${ORDER_MIN_USD} and ${ORDER_MAX_USD}.
                </p>
              )}

              <Button
                className="h-12 w-full rounded-full"
                disabled={!valid}
                onClick={() => setStep("details")}
              >
                Continue
              </Button>
            </div>
          )}

          {step === "details" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Full legal name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used to match your order with our payments partner.
                </p>
              </div>
              {side === "buy" && (
                <div className="space-y-1.5">
                  <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Delivery address
                  </label>
                  <p className="break-all rounded-xl border border-white/12 bg-white/5 p-3 font-mono text-xs">
                    {address ?? "—"}
                  </p>
                </div>
              )}
              <Button
                className="h-12 w-full rounded-full"
                disabled={!detailsValid || (side === "buy" && !address)}
                onClick={() => setStep("review")}
              >
                Continue
              </Button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <Breakdown side={side} quote={quote} asset={picked.asset} />
              <div className="space-y-3">
                {DISCLAIMERS.map((d) => (
                  <label key={d.id} className="flex items-start gap-2.5 text-xs leading-relaxed">
                    <Checkbox
                      checked={accepted.includes(d.id)}
                      onCheckedChange={(v) =>
                        setAccepted((prev) =>
                          v ? [...new Set([...prev, d.id])] : prev.filter((x) => x !== d.id),
                        )
                      }
                      className="mt-0.5"
                    />
                    <span>
                      {d.text}
                      {d.id === "terms" && (
                        <>
                          {" "}
                          <Link to="/terms" className="underline">
                            Terms
                          </Link>{" "}
                          ·{" "}
                          <Link to="/privacy" className="underline">
                            Privacy
                          </Link>
                        </>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                className="h-12 w-full rounded-full"
                disabled={!allAccepted || busy}
                onClick={place}
              >
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {busy ? "Placing order…" : "Place order"}
              </Button>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Identity verification and bank linking happen on VectorPay — we never see your bank
                login.
              </p>
            </div>
          )}

          {step === "handoff" && result && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <p className="font-display text-2xl uppercase">Order started</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.orderId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="mx-auto flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Ref {result.orderId}
              </button>
              <p className="text-sm text-muted-foreground">
                Service fee ${result.feeUsd.toFixed(2)} (1%). Settlement takes 1–3 business days.
              </p>
              {result.detail && (
                <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
                  {result.detail}
                </p>
              )}
              {result.handoffUrl && (
                <Button asChild className="h-12 w-full rounded-full">
                  <a href={result.handoffUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Continue at VectorPay
                  </a>
                </Button>
              )}
              <Button variant="ghost" asChild className="w-full rounded-full">
                <Link to="/wallet/order/$id" params={{ id: result.orderId }}>
                  View order
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Breakdown({
  side,
  quote,
  asset,
}: {
  side: OrderSide;
  quote: ReturnType<typeof quoteOrder>;
  asset: string;
}) {
  return (
    <div className="space-y-1.5 rounded-2xl border border-white/12 bg-white/5 p-4 text-sm">
      <Row label="Order" value={`$${quote.usd.toFixed(2)}`} />
      <Row label="Service fee (1%)" value={`$${quote.feeUsd.toFixed(2)}`} />
      {side === "buy" ? (
        <>
          <Row label="You receive" value={`${quote.assetAmount.toFixed(2)} ${asset}`} />
          <Row label="Total from your bank" value={`$${quote.settlementUsd.toFixed(2)}`} strong />
        </>
      ) : (
        <>
          <Row label="You send" value={`${quote.assetAmount.toFixed(2)} ${asset}`} />
          <Row label="Estimated to your bank" value={`$${quote.settlementUsd.toFixed(2)}`} strong />
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-display text-base" : ""}>{value}</span>
    </div>
  );
}
