import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getDirectoryStatus, syncDirectoryNow, type DirectoryStatus } from "@/lib/directory-admin.functions";

export const Route = createFileRoute("/admin/directory")({
  head: () => ({
    meta: [
      { title: "Store directory — POP manager" },
      {
        name: "description",
        content: "Check how fresh our copy of the NectarPay merchant directory is and pull it now.",
      },
      { property: "og:title", content: "Store directory — POP manager" },
      { property: "og:description", content: "Directory sync status for the POP Wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectoryAdmin,
});

function when(value: string | null) {
  if (!value) return "never";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  const mins = Math.round((Date.now() - t) / 60_000);
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `${new Date(t).toLocaleString()} (${ago})`;
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold uppercase">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DirectoryAdmin() {
  const { isAdmin, loading } = useIsAdmin();
  const status = useServerFn(getDirectoryStatus);
  const sync = useServerFn(syncDirectoryNow);
  const [data, setData] = useState<DirectoryStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    status()
      .then(setData)
      .catch((e) => toast.error((e as Error).message));
  }, [status]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function pull() {
    setBusy(true);
    try {
      const r = await sync();
      if (r.status === "ok") toast.success(`${r.count ?? 0} stores checked, ${r.written ?? 0} updated`);
      else if (r.status === "busy") toast.message("A sync is already running");
      else if (r.status === "error") toast.error(r.error ?? "Sync failed");
      else toast.message("Synced moments ago already");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Checking access…</p>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="font-display text-xl font-semibold uppercase">Not for you</p>
        <p className="mt-1 text-sm text-muted-foreground">This page is for POP managers.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          to="/"
          aria-label="Back to wallet"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 font-display text-2xl font-bold tracking-tight">STORE DIRECTORY</h1>
        <Button size="sm" onClick={pull} disabled={busy} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Syncing…" : "Sync now"}
        </Button>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-5">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last pull</p>
          <p className="mt-1 text-sm">{when(data?.lastRunAt ?? null)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: {data?.lastStatus ?? "never"} · {data?.lastCount ?? 0} stores in the feed · {data?.lastRemoved ?? 0} retired
          </p>
          {data?.lastError ? <p className="mt-2 text-xs text-destructive">{data.lastError}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            An hourly database timer pulls NectarPay's public feed. NectarPay stays the source of truth —
            we never edit a store here, merchants change their own listing.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Stores we hold" value={data?.active ?? 0} hint="active in our copy" />
          <Stat label="Shopper-ready" value={data?.named ?? 0} hint="name + details, shown in the app" />
          <Stat label="City pin only" value={data?.cityOnly ?? 0} hint="merchant hasn't turned on a full listing" />
          <Stat label="Have a map pin" value={data?.withPin ?? 0} hint="from the feed or our address lookup" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold uppercase">{data?.acceptsTsd ?? 0} take TSD</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Stores that accept Texas Stable Dollar. Only the shopper-ready ones (named, with a pin) appear in
            the wallet's SPEND TSD list — the rest are waiting on their merchant to publish details in
            NectarPay.
          </p>
        </div>
      </main>
    </div>
  );
}
