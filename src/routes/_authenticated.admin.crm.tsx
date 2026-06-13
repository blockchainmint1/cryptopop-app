import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Download,
  Send,
  Wallet,
  UserCheck,
  Mail,
  Loader2,
  ShieldOff,
} from "lucide-react";
import { listCrmContacts, type CrmContact } from "@/lib/crm.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  head: () => ({ meta: [{ title: "CRM — CryptoPOP Admin" }] }),
  component: AdminCrm,
});

type Filter = "all" | "signup" | "rsvp" | "account" | "wallet" | "checked-in";

function AdminCrm() {
  const fetchContacts = useServerFn(listCrmContacts);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchContacts({ data: { limit: 2000 } })
      .then((res) => {
        if (cancel) return;
        setContacts(res.contacts);
        setTotal(res.total);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter === "signup" && c.signup_count === 0) return false;
      if (filter === "rsvp" && c.rsvp_count === 0) return false;
      if (filter === "account" && !c.has_account) return false;
      if (filter === "wallet" && !c.has_wallet) return false;
      if (filter === "checked-in" && c.checked_in_count === 0) return false;
      if (!s) return true;
      return (
        c.email.includes(s) ||
        (c.full_name ?? "").toLowerCase().includes(s) ||
        (c.mobile_number ?? "").toLowerCase().includes(s)
      );
    });
  }, [contacts, filter, search]);

  function downloadCsv() {
    const headers = [
      "email",
      "full_name",
      "mobile_number",
      "has_account",
      "has_wallet",
      "signup_count",
      "rsvp_count",
      "checked_in_count",
      "suppressed",
      "sources",
      "last_seen_at",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((c) =>
      [
        c.email,
        c.full_name,
        c.mobile_number,
        c.has_account,
        c.has_wallet,
        c.signup_count,
        c.rsvp_count,
        c.checked_in_count,
        c.suppressed,
        c.sources.join("|"),
        c.last_seen_at,
      ]
        .map(escape)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cryptopop-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => {
    const all = contacts.length;
    const signup = contacts.filter((c) => c.signup_count > 0).length;
    const rsvp = contacts.filter((c) => c.rsvp_count > 0).length;
    const account = contacts.filter((c) => c.has_account).length;
    const wallet = contacts.filter((c) => c.has_wallet).length;
    const checkedIn = contacts.filter((c) => c.checked_in_count > 0).length;
    return { all, signup, rsvp, account, wallet, checkedIn };
  }, [contacts]);

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">CRM — Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unified, deduped contact list from signups, RSVPs, accounts, and
            wallet claims.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/blast">
              <Send className="h-4 w-4 mr-2" /> New blast
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            ["all", "All", counts.all],
            ["signup", "Signed up", counts.signup],
            ["rsvp", "RSVP'd", counts.rsvp],
            ["account", "Has account", counts.account],
            ["wallet", "Has wallet", counts.wallet],
            ["checked-in", "Checked in", counts.checkedIn],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key as Filter)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              filter === key
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/60"
            }`}
          >
            <div className="text-2xl font-display">{count}</div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              {label}
            </div>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} / {total}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading contacts…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Mobile</th>
                  <th className="py-2 pr-3">Tags</th>
                  <th className="py-2 pr-3 text-right">Signups</th>
                  <th className="py-2 pr-3 text-right">RSVPs</th>
                  <th className="py-2 pr-3 text-right">Checked in</th>
                  <th className="py-2 pr-3">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((c) => (
                  <tr
                    key={c.email}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="py-2 pr-3 font-mono text-xs">{c.email}</td>
                    <td className="py-2 pr-3">{c.full_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {c.mobile_number ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {c.has_account && (
                          <Badge variant="secondary" className="text-[10px]">
                            <UserCheck className="h-3 w-3 mr-1" /> account
                          </Badge>
                        )}
                        {c.has_wallet && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Wallet className="h-3 w-3 mr-1" /> wallet
                          </Badge>
                        )}
                        {c.suppressed && (
                          <Badge variant="destructive" className="text-[10px]">
                            <ShieldOff className="h-3 w-3 mr-1" /> suppressed
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right">{c.signup_count}</td>
                    <td className="py-2 pr-3 text-right">{c.rsvp_count}</td>
                    <td className="py-2 pr-3 text-right">
                      {c.checked_in_count}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {c.last_seen_at
                        ? new Date(c.last_seen_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Mail className="h-6 w-6" />
                <p className="text-sm">No contacts match this filter.</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
