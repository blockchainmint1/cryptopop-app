import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RotateCw, ExternalLink, Coins } from "lucide-react";
import { toast } from "sonner";
import { listPopAwards, retryPopAward, manualAwardPop } from "@/lib/pop-awards-admin.functions";

type Award = {
  id: string;
  email: string;
  wallet_address: string;
  amount: number;
  source: string;
  source_id: string | null;
  status: "pending" | "sent" | "failed";
  tx_hash: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type Summary = {
  total: number;
  totalPop: number;
  sent: number;
  sentPop: number;
  pending: number;
  failed: number;
};

export const Route = createFileRoute("/_authenticated/admin/pop-awards")({
  head: () => ({ meta: [{ title: "POP Awards — CryptoPOP Admin" }] }),
  component: AdminPopAwards,
});

function AdminPopAwards() {
  const list = useServerFn(listPopAwards);
  const retry = useServerFn(retryPopAward);
  const manual = useServerFn(manualAwardPop);
  const [rows, setRows] = useState<Award[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("10");
  const [memo, setMemo] = useState("");
  const [minting, setMinting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list({ data: { status, q: q || undefined } });
      setRows(res.awards as Award[]);
      setSummary(res.summary as Summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function doRetry(id: string) {
    setRetrying(id);
    try {
      const res = await retry({ data: { id } });
      if (res.alreadySent) toast.message("Already sent.");
      else toast.success(`Sent! tx ${res.txHash?.slice(0, 10)}…`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  async function doMint(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!recipient.trim() || !Number.isInteger(amt) || amt <= 0) {
      toast.error("Enter a recipient and a positive whole POP amount");
      return;
    }
    setMinting(true);
    try {
      const res = await manual({
        data: { recipient: recipient.trim(), amount: amt, memo: memo.trim() || undefined },
      });
      toast.success(
        res.status === "duplicate"
          ? "Already minted (duplicate)"
          : `Minted ${amt} POP to ${res.mode}`,
      );
      setRecipient("");
      setMemo("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            to="/admin/signups"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Admin
          </Link>
          <h1 className="font-display text-lg font-bold">POP Awards Log</h1>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total awards" value={summary.total} />
            <Stat label="POP minted" value={summary.sentPop} accent />
            <Stat label="Pending" value={summary.pending} />
            <Stat label="Failed" value={summary.failed} danger={summary.failed > 0} />
          </div>
        )}

        <form
          onSubmit={doMint}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div>
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" /> Manual mint
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Send POP to an email (uses the custodial wallet for that email) or directly to a TXC wallet address.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto]">
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="email@example.com or TXC wallet address"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              maxLength={200}
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="POP"
              inputMode="numeric"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Memo (optional, ≤60 chars)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              maxLength={60}
            />
            <button
              type="submit"
              disabled={minting}
              className="rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {minting ? "Minting…" : "Mint POP"}
            </button>
          </div>
        </form>



        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "sent", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest ${
                status === s
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              refresh();
            }}
            className="ml-auto flex gap-2"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email / wallet / tx"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
              maxLength={120}
            />
            <button
              type="submit"
              className="rounded-full bg-foreground px-3 py-1.5 font-display text-xs font-semibold text-background"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No awards.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2 text-right">POP</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tx / Error</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate font-medium">{r.email}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {r.wallet_address.slice(0, 12)}…
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">
                          {r.source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-display font-bold">
                        {r.amount}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        {r.tx_hash ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                            {r.tx_hash.slice(0, 18)}…
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        ) : r.error ? (
                          <span className="font-mono text-[10px] text-destructive break-words">
                            {r.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status !== "sent" && (
                          <button
                            onClick={() => doRetry(r.id)}
                            disabled={retrying === r.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-display text-[11px] hover:bg-background disabled:opacity-50"
                          >
                            <RotateCw
                              className={`h-3 w-3 ${
                                retrying === r.id ? "animate-spin" : ""
                              }`}
                            />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Coins className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          danger ? "text-destructive" : accent ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "sent"
      ? "bg-emerald-500/15 text-emerald-600"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : status === "sending"
          ? "bg-sky-500/15 text-sky-500"
          : "bg-amber-500/15 text-amber-600";

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${styles}`}
    >
      {status}
    </span>
  );
}
