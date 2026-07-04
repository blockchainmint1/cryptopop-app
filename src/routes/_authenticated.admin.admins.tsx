import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Trash2, UserPlus, ArrowLeft, Loader2, DoorOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listAdmins,
  addAdminByEmail,
  removeAdmin,
  listGatekeepers,
  addGatekeeperByEmail,
  removeGatekeeper,
  type AdminRow,
} from "@/lib/admins-manage.functions";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  head: () => ({ meta: [{ title: "Manage admins — CryptoPOP" }] }),
  component: AdminsPage,
});

type RoleConfig = {
  key: "admin" | "gatekeeper";
  title: string;
  icon: typeof Shield;
  description: string;
  allowSelfRemove: boolean;
  listFn: typeof listAdmins;
  addFn: typeof addAdminByEmail;
  removeFn: typeof removeAdmin;
};

function AdminsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin">
          <ArrowLeft className="h-4 w-4 mr-1" /> Admin
        </Link>
      </Button>

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
          Access control
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" /> Roles
        </h1>
        <p className="text-sm text-muted-foreground">
          Grant roles to users who already have a CryptoPOP account.
        </p>
      </header>

      <RoleSection
        config={{
          key: "admin",
          title: "Admins",
          icon: Shield,
          description:
            "Global admins can access the entire /admin console and manage other admins and gatekeepers.",
          allowSelfRemove: false,
          listFn: listAdmins,
          addFn: addAdminByEmail,
          removeFn: removeAdmin,
        }}
      />

      <RoleSection
        config={{
          key: "gatekeeper",
          title: "Gatekeepers",
          icon: DoorOpen,
          description:
            "Gatekeepers can ONLY reach the door check-in scanner (/admin/checkin) to authorize event entry. No other admin access.",
          allowSelfRemove: true,
          listFn: listGatekeepers,
          addFn: addGatekeeperByEmail,
          removeFn: removeGatekeeper,
        }}
      />
    </div>
  );
}

function RoleSection({ config }: { config: RoleConfig }) {
  const fetchList = useServerFn(config.listFn);
  const addFn = useServerFn(config.addFn);
  const removeFn = useServerFn(config.removeFn);

  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    fetchList()
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [fetchList]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await addFn({ data: { email } });
      toast.success(`Granted ${config.key} to ${email}`);
      setEmail("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to add ${config.key}`);
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (row: AdminRow) => {
    if (row.isSelf && !config.allowSelfRemove) return;
    if (!confirm(`Remove ${config.key} from ${row.email ?? row.userId}?`)) return;
    try {
      await removeFn({ data: { userId: row.userId } });
      toast.success(`${config.title.slice(0, -1)} removed`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const Icon = config.icon;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary" /> {config.title}
        </h2>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Grant {config.key}
        </h3>
        <form onSubmit={onAdd} className="flex gap-2 flex-wrap">
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[240px]"
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Grant {config.key}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="font-display text-base font-semibold">
            Current {config.title.toLowerCase()}{" "}
            {rows && <span className="text-muted-foreground">({rows.length})</span>}
          </h3>
        </div>
        {err && <div className="p-5 text-sm text-destructive bg-destructive/5">{err}</div>}
        {!rows && !err && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
            Loading…
          </div>
        )}
        {rows && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No {config.title.toLowerCase()} yet.
          </div>
        )}
        {rows && rows.length > 0 && (
          <ul className="divide-y divide-border/50">
            {rows.map((r) => (
              <li key={r.userId} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {r.displayName || r.email || r.userId}
                    {r.isSelf && (
                      <span className="ml-2 text-xs uppercase font-mono text-primary">you</span>
                    )}
                  </p>
                  {r.email && r.displayName && (
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 font-mono truncate">{r.userId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={r.isSelf && !config.allowSelfRemove}
                  onClick={() => onRemove(r)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
