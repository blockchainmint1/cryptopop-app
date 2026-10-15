import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Copy, BookUser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/lib/wallet/wallet-context";
import { getAddressActivity, type WalletTx } from "@/lib/wallet-activity.functions";
import { loadTxLabels, setTxNote } from "@/lib/wallet/tx-labels";
import { getContact, saveContact, removeContact } from "@/lib/wallet/address-book";

export const Route = createFileRoute("/tx/$txid")({
  head: () => ({
    meta: [
      { title: "Transaction details — CryptoPOP Wallet" },
      { name: "description", content: "View a transaction, add a private note, and save the address." },
      { property: "og:title", content: "Transaction details — CryptoPOP Wallet" },
      { property: "og:description", content: "Transaction details in your CryptoPOP wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TxPage,
});

function TxPage() {
  const { txid } = Route.useParams();
  const { address } = useWallet();
  const [tx, setTx] = useState<WalletTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [merchant, setMerchant] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const l = loadTxLabels()[txid];
    setNote(l?.memo ?? "");
    setMerchant(l?.merchant ?? null);
  }, [txid]);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    getAddressActivity({ data: { address } })
      .then((r) => setTx(r.txs.find((t) => t.txid === txid) ?? null))
      .finally(() => setLoading(false));
  }, [address, txid]);

  useEffect(() => {
    if (!tx?.counterparty) return;
    const c = getContact(tx.counterparty);
    setName(c?.name ?? merchant ?? "");
    setSaved(Boolean(c));
  }, [tx?.counterparty, merchant]);

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast.success("Copied");
  };

  const title = tx
    ? `${tx.direction === "in" ? "Received" : "Sent"} ${tx.token?.symbol ?? "TXC"}`
    : "Transaction";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <Card className="space-y-2 border-white/12 bg-white/5 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
        {tx && (
          <p className="font-display text-4xl">
            {tx.direction === "in" ? "+" : "−"}
            {tx.token
              ? `${tx.token.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${tx.token.symbol}`
              : `${tx.txc.toFixed(8)} TXC`}
          </p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && !tx && (
          <p className="text-sm text-muted-foreground">
            {address ? "Couldn't load details right now." : "Unlock your wallet to see details."}
          </p>
        )}
        {tx && (
          <p className="text-sm text-muted-foreground">
            {tx.confirmed ? "Confirmed" : "Pending"} ·{" "}
            {tx.time ? new Date(tx.time * 1000).toLocaleString() : "just now"}
          </p>
        )}
        <div className="flex items-center gap-2 pt-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs">{txid}</p>
          <Button size="icon" variant="ghost" onClick={() => copy(txid)} aria-label="Copy transaction ID">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <Button asChild variant="outline" className="w-full rounded-full">
          <a href={`https://mempool.texitcoin.org/tx/${txid}`} target="_blank" rel="noreferrer">
            View on explorer <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </Card>

      <Card className="space-y-3 border-white/12 bg-white/5 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Private note
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Lunch with Sam"
          maxLength={280}
        />
        <Button
          className="w-full rounded-full"
          onClick={() => {
            setTxNote(txid, note);
            toast.success("Note saved");
          }}
        >
          Save note
        </Button>
        <p className="text-xs text-muted-foreground">Notes stay on this phone only.</p>
      </Card>

      {tx?.counterparty && (
        <Card className="space-y-3 border-white/12 bg-white/5 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {tx.direction === "in" ? "From" : "To"}
          </p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs">{tx.counterparty}</p>
            <Button size="icon" variant="ghost" onClick={() => copy(tx.counterparty!)} aria-label="Copy address">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Mom)" maxLength={60} />
          <Button
            className="w-full rounded-full"
            disabled={!name.trim()}
            onClick={() => {
              saveContact(tx.counterparty!, name);
              setSaved(true);
              toast.success("Saved to address book");
            }}
          >
            <BookUser className="mr-2 h-4 w-4" /> {saved ? "Update contact" : "Save to address book"}
          </Button>
          {saved && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                removeContact(tx.counterparty!);
                setSaved(false);
                toast("Removed from address book");
              }}
            >
              Remove from address book
            </Button>
          )}
        </Card>
      )}
    </main>
  );
}
