import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listRewardRules,
  upsertRewardRule,
  deleteRewardRule,
} from "@/lib/reward-rules.functions";

type Rule = {
  id: string;
  action_key: string;
  label: string;
  description: string | null;
  pop_amount: number;
  enabled: boolean;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/rewards")({
  head: () => ({ meta: [{ title: "Reward Rules — CryptoPOP Admin" }] }),
  component: AdminRewards,
});

function emptyDraft(): Rule {
  return {
    id: "",
    action_key: "",
    label: "",
    description: "",
    pop_amount: 0,
    enabled: true,
    updated_at: "",
  };
}

function AdminRewards() {
  const list = useServerFn(listRewardRules);
  const upsert = useServerFn(upsertRewardRule);
  const remove = useServerFn(deleteRewardRule);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list();
      setRules(res.rules as Rule[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!editing) return;
    try {
      await upsert({
        data: {
          id: editing.id || undefined,
          action_key: editing.action_key.trim(),
          label: editing.label.trim(),
          description: editing.description?.trim() || null,
          pop_amount: Number(editing.pop_amount),
          enabled: editing.enabled,
        },
      });
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function del(r: Rule) {
    if (!confirm(`Delete rule "${r.label}"?`)) return;
    try {
      await remove({ data: { id: r.id } });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            to="/admin/signups"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Admin
          </Link>
          <h1 className="font-display text-lg font-bold">Reward Rules</h1>
          <button
            onClick={() => setEditing(emptyDraft())}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <p className="text-sm text-muted-foreground">
          Set how many POP are awarded for each action. The signup flow reads{" "}
          <code className="font-mono text-xs">event_signup</code>; the scan flow
          reads <code className="font-mono text-xs">scan_checkin</code>.
        </p>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold">{r.label}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                        {r.pop_amount} POP
                      </span>
                      {!r.enabled && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          disabled
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {r.action_key}
                    </p>
                    {r.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditing({ ...r })}
                      className="rounded-full border border-border px-3 py-1.5 font-display text-xs hover:bg-background"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => del(r)}
                      className="rounded-full border border-destructive/40 px-3 py-1.5 font-display text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {editing.id ? "Edit rule" : "New rule"}
              </h2>
              <button onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Action key (lowercase, no spaces)">
                <input
                  value={editing.action_key}
                  onChange={(e) => setEditing({ ...editing, action_key: e.target.value })}
                  disabled={!!editing.id}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm disabled:opacity-50"
                  placeholder="event_signup"
                />
              </Field>
              <Field label="Label">
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="POP amount">
                <input
                  type="number"
                  min={0}
                  value={editing.pop_amount}
                  onChange={(e) =>
                    setEditing({ ...editing, pop_amount: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-full border border-border px-4 py-2 font-display text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
