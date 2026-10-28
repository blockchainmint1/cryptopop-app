import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Church, Heart, Loader2, Lock, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardScreen } from "@/components/wallet/onboard-screen";
import { UnlockScreen } from "@/components/wallet/unlock-screen";
import { QrScanDialog } from "@/components/wallet/qr-scan-dialog";
import { useWallet } from "@/lib/wallet/wallet-context";
import { deriveLegacyTxcAddress, deriveTxcAddress, isValidTxcAddress } from "@/lib/wallet";
import { splitGiving, givingMinimumUsd, validateSplitSend, type SplitIntent } from "@/lib/wallet/transaction-policy";
import { signSplitPsbt } from "@/lib/wallet/sign";
import { broadcastSignedTx, prepareSplitSend } from "@/lib/send.functions";
import { getAddressChainSummary } from "@/lib/chain-public.functions";
import { getGiveConfig } from "@/lib/give/config.functions";
import { configMatchesPinned, GIVE_CHURCH, GIVE_PLATFORM_ADDRESS } from "@/lib/give/constants";
import { selectNectarTsd } from "@/lib/nectarpay.functions";
import { parseScan } from "@/lib/wallet/scan-parse";
import { reservedOutpoints, reserveOutpoints } from "@/lib/wallet/spent-outpoints";

export const Route = createFileRoute("/give")({
  head: () => ({
    meta: [
      { title: "eGiving — Shop local, give to your church" },
      { name: "description", content: "eGiving turns everyday purchases at participating merchants into gifts for Christ Church of the Valley." },
      { property: "og:title", content: "eGiving — Shop local, give to your church" },
      { property: "og:description", content: "Every purchase at a participating merchant supports Christ Church of the Valley." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => getGiveConfig(),
  component: GivePage,
});

const GIVEN_KEY = "egiving.given";

function GivePage() {
  const { status } = useWallet();
  return (
    <div className="give-theme min-h-screen">
      {status === "loading" ? (
        <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : status === "none" ? (
        <Gate title="Create your giving wallet"><OnboardScreen /></Gate>
      ) : status === "locked" ? (
        <Gate title="Welcome back"><UnlockScreen /></Gate>
      ) : (
        <GiveDashboard />
      )}
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto max-w-md px-5 pt-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">eGiving</p>
        <h1 className="font-give mt-1 text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

type Review = { psbt: string; inputs: string[]; feeSats: number; intent: SplitIntent };

type Invoice = { id: string; nonce: string | null; discountPct: number; merchantMinimumUsd: number | null };

function GiveDashboard() {
  const serverCfg = Route.useLoaderData();
  const pinnedOk = configMatchesPinned(serverCfg);
  const cfg = { church: GIVE_CHURCH, platformAddress: GIVE_PLATFORM_ADDRESS };
  const selectTsd = useServerFn(selectNectarTsd);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const { address, mnemonic } = useWallet();
  const summary = useServerFn(getAddressChainSummary);
  const prepare = useServerFn(prepareSplitSend);
  const broadcast = useServerFn(broadcastSignedTx);
  const [tsd, setTsd] = useState<number | null>(null);
  const [given, setGiven] = useState(0);
  const [merchant, setMerchant] = useState("");
  const [merchantName, setMerchantName] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address) return;
    summary({ data: { address } }).then((s) => setTsd(s.tsd ?? 0)).catch(() => setTsd(null));
  }, [address, summary]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setGiven(Number(localStorage.getItem(GIVEN_KEY) ?? 0) || 0); }, []);

  const value = Number(amount);
  const split = useMemo(() => {
    const pct = invoice?.discountPct ?? serverCfg.defaultDiscountPct;
    try { return value > 0 ? splitGiving(value, pct) : null; } catch { return null; }
  }, [value, invoice, serverCfg.defaultDiscountPct]);

  async function loadInvoice(id: string, nonce: string | null) {
    setBusy(true);
    try {
      const res = await selectTsd({ data: { id, nonce } });
      const inv = res.invoice;
      if (!inv || !inv.address || !inv.tsdAmount) return toast.error(res.error ?? "This store isn't accepting TSD right now.");
      if (!inv.egiving.accepted || inv.egiving.discountPct == null)
        return toast.error(`${inv.merchant?.name ?? "This store"} doesn't accept eGiving payments yet. Pay from the main wallet instead.`);
      try { splitGiving(inv.tsdAmount, inv.egiving.discountPct); } catch { return toast.error("This store's eGiving discount isn't supported."); }
      setInvoice({ id, nonce, discountPct: inv.egiving.discountPct, merchantMinimumUsd: inv.egiving.merchantMinimumUsd ?? null });
      setMerchant(inv.address);
      setAmount(inv.tsdAmount.toFixed(2));
      setMerchantName(inv.merchant?.name ?? null);
    } finally { setBusy(false); }
  }

  function onScan(text: string) {
    setScan(false);
    setReview(null);
    setInvoice(null);
    const intent = parseScan(text);
    if (intent.kind === "nectarpay") {
      void loadInvoice(intent.invoiceId, intent.nonce);
    } else if (intent.kind === "payment") {
      if (intent.asset !== "tsd") return toast.error("eGiving only pays in TSD. This code asks for a different coin.");
      setMerchant(intent.to);
      if (intent.amount != null) setAmount(String(intent.amount));
      setMerchantName(intent.merchant);
    } else if (intent.kind === "address") {
      setMerchant(intent.address);
    } else toast.error("That code isn't a merchant payment request");
  }

  async function prepareReview() {
    if (!address || !mnemonic) return toast.error("Wallet is locked");
    if (!pinnedOk) return toast.error("eGiving settings from the server don't match this app. Payment blocked for your safety.");
    const to = merchant.trim();
    if (!isValidTxcAddress(to) || /^txc1/i.test(to)) return toast.error("Enter the merchant's T… address");
    if ([address, cfg.church.address, cfg.platformAddress].includes(to)) return toast.error("That address can't be the merchant");
    if (!split) return toast.error("Enter an amount (up to 2 decimals)");
    if (split.church <= 0 || split.platform <= 0) return toast.error(`Minimum purchase at a ${split.discountPct}% store is $${givingMinimumUsd(split.discountPct).toFixed(2)}`);
    if (invoice?.merchantMinimumUsd != null && split.merchant + 1e-9 < invoice.merchantMinimumUsd)
      return toast.error("The store's share doesn't match what NectarPay expects. Payment stopped before anything was sent.");
    if (tsd !== null && split.total > tsd) return toast.error(`You only have ${tsd.toFixed(2)} TSD`);
    const intent: SplitIntent = {
      from: address,
      recipients: [
        { to, amount: split.merchant },
        { to: cfg.church.address, amount: split.church },
        { to: cfg.platformAddress, amount: split.platform },
      ],
    };
    setBusy(true);
    try {
      const built = await prepare({ data: { ...intent, exclude: reservedOutpoints() } });
      const checked = validateSplitSend(built.psbtBase64, intent, [deriveTxcAddress(mnemonic), deriveLegacyTxcAddress(mnemonic)]);
      setReview({ psbt: built.psbtBase64, inputs: built.inputs, feeSats: checked.feeSats, intent });
    } catch (e) {
      toast.error((e as Error).message || "Couldn't prepare the payment");
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!review || !mnemonic || !split) return;
    setBusy(true);
    try {
      const raw = signSplitPsbt(review.psbt, mnemonic, review.intent);
      const res = await broadcast({ data: { rawHex: raw } });
      if (!res.ok) {
        if (res.spent !== undefined) reserveOutpoints(res.spent ?? review.inputs);
        setReview(null);
        throw new Error(res.error);
      }
      reserveOutpoints(review.inputs);
      const total = given + split.church;
      localStorage.setItem(GIVEN_KEY, String(total));
      setGiven(total);
      setTxid(res.txid);
      setReview(null);
      toast.success(`Paid — $${split.church.toFixed(2)} is on its way to ${cfg.church.short}`);
      setTimeout(load, 4000);
    } catch (e) {
      toast.error((e as Error).message || "Payment failed");
    } finally { setBusy(false); }
  }

  function reset() {
    setTxid(null); setAmount(""); setMerchant(""); setMerchantName(null); setInvoice(null);
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Heart className="h-4 w-4" /></span>
          <span className="font-give text-xl">eGiving</span>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Demo</span>
      </header>

      <section className="mt-6 rounded-3xl p-6 text-primary-foreground" style={{ background: "var(--gradient-give)", boxShadow: "var(--shadow-give)" }}>
        <p className="text-sm opacity-90">Your balance</p>
        <p className="font-give mt-1 text-5xl">${tsd === null ? "—" : tsd.toFixed(2)}</p>
        <p className="mt-1 text-xs opacity-80">Texas Stable Dollar</p>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-3xl border bg-card p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Church className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">You're supporting</p>
          <p className="font-give text-lg leading-tight">{cfg.church.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Part of every purchase at a participating merchant goes to {cfg.church.short}.
          </p>
          <p className="mt-2 text-sm"><span className="font-semibold text-primary">${given.toFixed(2)}</span> given from this phone</p>
        </div>
      </section>

      {txid ? (
        <section className="mt-4 rounded-3xl border bg-card p-6 text-center">
          <Heart className="mx-auto h-8 w-8 text-primary" />
          <h2 className="font-give mt-2 text-2xl">Thank you!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your purchase went through in one payment and part of it is now supporting {cfg.church.short}.</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild variant="outline"><Link to="/tx/$txid" params={{ txid }}>View payment details</Link></Button>
            <Button onClick={reset}>Make another purchase</Button>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-3xl border bg-card p-5">
          <h2 className="font-give text-xl">Pay a merchant</h2>
          {merchantName ? <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Store className="h-4 w-4" /> {merchantName}</p> : null}
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="give-merchant">Merchant address</Label>
              <div className="mt-1 flex gap-2">
                <Input id="give-merchant" value={merchant} readOnly={!!invoice} onChange={(e) => { setMerchant(e.target.value); setReview(null); }} placeholder="T…" autoComplete="off" />
                <Button type="button" variant="outline" size="icon" aria-label="Scan merchant QR" onClick={() => setScan(true)}><Camera className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label htmlFor="give-amount">Purchase amount ($)</Label>
              <Input id="give-amount" inputMode="decimal" value={amount} readOnly={!!invoice} onChange={(e) => { setAmount(e.target.value); setReview(null); }} placeholder="0.00" className="mt-1" />
            </div>
          </div>

          {split ? (
            <dl className="mt-4 space-y-2 rounded-2xl bg-muted p-4 text-sm">
              <Row label="Merchant" value={split.merchant} />
              <Row label={`${cfg.church.short} (church)`} value={split.church} accent />
              <Row label="eGiving" value={split.platform} />
              <div className="border-t pt-2"><Row label="You pay" value={split.total} bold /></div>
              <p className="pt-1 text-xs text-muted-foreground">
                {invoice ? `This store gives a ${split.discountPct}% community discount, so it counts this as paid in full.` : `Plain address payment with a ${split.discountPct}% split. Scan a NectarPay code so the store counts it as paid in full.`}
              </p>
            </dl>
          ) : null}

          {review ? (
            <div className="mt-4 space-y-2">
              <div className="space-y-1 rounded-2xl border p-3 font-mono text-[11px] break-all text-muted-foreground">
                <p>Merchant: {review.intent.recipients[0].to}</p>
                <p>{cfg.church.short}: {review.intent.recipients[1].to}</p>
                <p>eGiving: {review.intent.recipients[2].to}</p>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" /> Checked on this phone · network fee {(review.feeSats / 1e8).toFixed(5)} TXC</p>
              <Button className="w-full" disabled={busy} onClick={confirm}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Confirm & pay ${split?.total.toFixed(2)}</Button>
              <Button variant="ghost" className="w-full" onClick={() => setReview(null)}>Cancel</Button>
            </div>
          ) : (
            <Button className="mt-4 w-full" disabled={busy || !split || !merchant} onClick={prepareReview}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Review payment
            </Button>
          )}
        </section>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">Your keys stay on this phone. Part of the <a className="underline" href="https://honest.money" target="_blank" rel="noreferrer">honest.money</a> ecosystem.</p>
      <QrScanDialog open={scan} onOpenChange={setScan} onResult={onScan} title="Scan merchant QR" />
    </main>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: number; accent?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={accent ? "text-primary" : "text-muted-foreground"}>{label}</dt>
      <dd className={bold ? "font-semibold" : accent ? "font-medium text-primary" : ""}>${value.toFixed(2)}</dd>
    </div>
  );
}
