import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Wallet, CheckCircle2, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminWallets, type AdminWalletRow } from "@/lib/wallets-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/wallets")({
  head: () => ({ meta: [{ title: "Wallets — CryptoPOP Admin" }] }),
  component: AdminWalletsPage,
});

function shortAddr(a: string) {
  if (a.length <= 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

function fmtNum(n: number | null, digits = 4) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function AdminWalletsPage() {
  const list = useServerFn(listAdminWallets);
  const [rows, setRows] = useState<AdminWalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await list();
        setRows(res.wallets);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load wallets");
      } finally {
        setLoading(false);
      }
    })();
  }, [list]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(t) ||
        r.wallet_address.toLowerCase().includes(t) ||
        (r.display_name ?? "").toLowerCase().includes(t),
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    const txc = rows.reduce((s, r) => s + (r.txc ?? 0), 0);
    const pop = rows.reduce((s, r) => s + r.pop_sent, 0);
    const claimed = rows.filter((r) => r.claimed).length;
    return { txc, pop, claimed };
  }, [rows]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
          Wallets
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight mt-1">
          All wallets
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Every email-derived wallet, with on-chain TXC and POP balances.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Wallets" value={rows.length.toString()} sub={`${totals.claimed} claimed`} />
        <StatCard label="Total TXC" value={fmtNum(totals.txc, 4)} sub="sum of balances" />
        <StatCard label="Total POP sent" value={fmtNum(totals.pop, 0)} sub="across all wallets" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email, name, or address…"
            className="max-w-md"
          />
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {filtered.length} / {rows.length}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
            Loading wallets…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Wallet className="mx-auto h-6 w-6 mb-2 opacity-50" />
            No wallets found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">TXC</TableHead>
                  <TableHead className="text-right">POP sent</TableHead>
                  <TableHead className="text-right">POP pending</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.wallet_address}>
                    <TableCell className="font-mono text-xs">{r.email}</TableCell>
                    <TableCell className="text-sm">
                      {r.display_name ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copy(r.wallet_address)}
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title={r.wallet_address}
                      >
                        {shortAddr(r.wallet_address)}
                        <Copy className="h-3 w-3" />
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {fmtNum(r.txc, 4)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-primary">
                      {fmtNum(r.pop_sent, 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {r.pop_pending > 0 ? fmtNum(r.pop_pending, 0) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.claimed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3 w-3" /> Claimed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Unclaimed
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
        {label}
      </p>
      <p className="font-display text-3xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
