import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, CreditCard, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet/wallet-context";
import { nfcListCards } from "@/lib/nfc-cards.functions";
import { getAddressChainSummary } from "@/lib/chain-public.functions";
import { ownerEnvelope } from "@/lib/wallet/nfc-cards";

type Row = { id: string; label: string; enabled: boolean; tsd: number | null; spends: number };

/** Wallet-home "Tap to Pay" section: each linked card with its pocket balance. */
export function TapToPayCard() {
  const { mnemonic } = useWallet();
  const list = useServerFn(nfcListCards);
  const summary = useServerFn(getAddressChainSummary);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!mnemonic) return;
    let live = true;
    (async () => {
      try {
        const res = await list({ data: ownerEnvelope(mnemonic, "list", {}) });
        const out = await Promise.all(
          res.cards.map(async (c) => {
            let tsd: number | null = null;
            try {
              tsd = (await summary({ data: { address: c.address } })).tsd;
            } catch { /* balance unavailable */ }
            return { id: c.id, label: c.label, enabled: c.enabled, tsd, spends: c.payments.length };
          }),
        );
        if (live) setRows(out);
      } catch {
        if (live) setRows([]);
      }
    })();
    return () => { live = false; };
  }, [mnemonic, list, summary]);

  return (
    <Card className="space-y-2 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Tap to Pay</p>
        <Link to="/nfc" className="inline-flex items-center gap-1 text-xs text-primary">
          <Plus className="h-3 w-3" /> Add card
        </Link>
      </div>
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading cards…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Link a tap-to-pay card and spend TSD at NectarPay stores.</p>
      ) : (
        rows.map((r) => (
          <Link key={r.id} to="/nfc/$cardId" params={{ cardId: r.id }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 transition hover:bg-white/10">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {r.enabled ? "On" : "Off"} · {r.spends} spend{r.spends === 1 ? "" : "s"}
              </p>
            </div>
            <p className="font-mono text-sm">{r.tsd == null ? "—" : r.tsd.toFixed(2)} TSD</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))
      )}
    </Card>
  );
}
