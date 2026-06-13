import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, FileText } from "lucide-react";
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/lib/blast.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/email-templates")({
  head: () => ({ meta: [{ title: "Email Templates — CryptoPOP Admin" }] }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  name: string;
  subject: string | null;
  preview_text: string | null;
  html: string;
  notes: string | null;
};

function TemplatesPage() {
  const list = useServerFn(listEmailTemplates);
  const create = useServerFn(createEmailTemplate);
  const update = useServerFn(updateEmailTemplate);
  const del = useServerFn(deleteEmailTemplate);

  const [items, setItems] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template>({
    id: "",
    name: "",
    subject: "",
    preview_text: "",
    html: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await list({ data: {} as never });
    setItems(r.rows as Template[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectNew() {
    setSelectedId(null);
    setDraft({
      id: "",
      name: "",
      subject: "",
      preview_text: "",
      html: "",
      notes: "",
    });
  }

  function selectExisting(t: Template) {
    setSelectedId(t.id);
    setDraft({
      id: t.id,
      name: t.name,
      subject: t.subject ?? "",
      preview_text: t.preview_text ?? "",
      html: t.html,
      notes: t.notes ?? "",
    });
  }

  async function save() {
    if (!draft.name || !draft.html) {
      return toast.error("Name and HTML are required");
    }
    setBusy(true);
    try {
      if (selectedId) {
        await update({
          data: {
            id: selectedId,
            name: draft.name,
            subject: draft.subject || undefined,
            previewText: draft.preview_text || undefined,
            html: draft.html,
            notes: draft.notes || undefined,
          },
        });
        toast.success("Template updated");
      } else {
        const r = await create({
          data: {
            name: draft.name,
            subject: draft.subject || undefined,
            previewText: draft.preview_text || undefined,
            html: draft.html,
            notes: draft.notes || undefined,
          },
        });
        setSelectedId(r.id);
        toast.success("Template created");
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    if (!confirm("Delete this template?")) return;
    setBusy(true);
    try {
      await del({ data: { id: selectedId } });
      toast.success("Deleted");
      selectNew();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <header className="mb-4">
        <h1 className="font-display text-3xl">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reusable HTML for blasts. Load any template into the blast composer.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <Card className="p-3 space-y-2 h-fit">
          <Button onClick={selectNew} variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" /> New template
          </Button>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => selectExisting(t)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                      selectedId === t.id
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{t.name}</span>
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-xs text-muted-foreground px-3 py-2">
                  No templates yet.
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={draft.subject ?? ""}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Preview text</Label>
              <Input
                value={draft.preview_text ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, preview_text: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Input
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>HTML</Label>
            <Textarea
              className="font-mono text-xs h-80"
              value={draft.html}
              onChange={(e) => setDraft({ ...draft, html: e.target.value })}
            />
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={!selectedId || busy}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {selectedId ? "Save changes" : "Create template"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
