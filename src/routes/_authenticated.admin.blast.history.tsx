import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listBlastCampaigns,
  getBlastProgress,
  getBlastCampaign,
} from "@/lib/blast.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Eye, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/blast/history")({
  head: () => ({ meta: [{ title: "Blast History — CryptoPOP Admin" }] }),
  component: BlastHistory,
});

type Row = {
  campaign_id: string;
  subject: string;
  from_name: string;
  from_email: string;
  total_recipients: number;
  sent_at: string | null;
  finished_at: string | null;
  created_at: string;
  progress?: { counts: Record<string, number>; total: number };
};

function BlastHistory() {
  const list = useServerFn(listBlastCampaigns);
  const progressFn = useServerFn(getBlastProgress);
  const getCampaign = useServerFn(getBlastCampaign);
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<{
    subject: string;
    preview_text: string | null;
    html: string;
    from_name: string;
    from_email: string;
    reply_to: string | null;
    recipients_raw: string;
  } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function refresh() {
    const r = await list({ data: {} as never });
    const base = (r.rows ?? []) as Row[];
    const withProgress = await Promise.all(
      base.map(async (row) => {
        try {
          const p = await progressFn({ data: { campaignId: row.campaign_id } });
          return { ...row, progress: { counts: p.counts, total: p.total } };
        } catch {
          return row;
        }
      }),
    );
    setRows(withProgress);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 8000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleView(id: string) {
    setOpening(id);
    try {
      const c = await getCampaign({ data: { campaignId: id } });
      setViewing(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load email");
    } finally {
      setOpening(null);
    }
  }

  async function handleReuse(id: string) {
    setOpening(id);
    try {
      const c = await getCampaign({ data: { campaignId: id } });
      sessionStorage.setItem(
        "blast:prefill",
        JSON.stringify({
          subject: c.subject,
          previewText: c.preview_text ?? "",
          html: c.html,
          fromName: c.from_name,
          fromEmail: c.from_email,
          replyTo: c.reply_to ?? "",
          recipientsRaw: c.recipients_raw ?? "",
        }),
      );
      toast.success("Loaded into composer");
      navigate({ to: "/admin/blast" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reuse");
      setOpening(null);
    }
  }


  return (
    <Card className="p-4">
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No campaigns yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Sent</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3 text-right">Recipients</th>
                <th className="py-2 pr-3">Progress</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.progress?.counts ?? {};
                const sent = c.sent ?? 0;
                const pending = (c.pending ?? 0) + (c.sending ?? 0);
                const failed = c.failed ?? 0;
                const done = !!r.finished_at;
                return (
                  <tr key={r.campaign_id} className="border-b border-border/40">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {r.sent_at
                        ? new Date(r.sent_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 font-medium">{r.subject}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">
                      {r.from_email}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.total_recipients}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          sent {sent}
                        </Badge>
                        {pending > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            pending {pending}
                          </Badge>
                        )}
                        {failed > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            failed {failed}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {done ? (
                        <Badge variant="secondary" className="text-[10px]">
                          finished
                        </Badge>
                      ) : (
                        <Badge className="text-[10px]">sending</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleView(r.campaign_id)}
                          disabled={opening === r.campaign_id}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReuse(r.campaign_id)}
                          disabled={opening === r.campaign_id}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Reuse
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.subject}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground font-mono">
                From: {viewing.from_name} &lt;{viewing.from_email}&gt;
                {viewing.reply_to ? ` • Reply-To: ${viewing.reply_to}` : ""}
              </div>
              {viewing.preview_text && (
                <div className="text-xs text-muted-foreground italic">
                  Preview: {viewing.preview_text}
                </div>
              )}
              <iframe
                title="email preview"
                className="w-full h-[500px] rounded-md border border-border bg-white"
                srcDoc={viewing.html}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!viewing) return;
                sessionStorage.setItem(
                  "blast:prefill",
                  JSON.stringify({
                    subject: viewing.subject,
                    previewText: viewing.preview_text ?? "",
                    html: viewing.html,
                    fromName: viewing.from_name,
                    fromEmail: viewing.from_email,
                    replyTo: viewing.reply_to ?? "",
                    recipientsRaw: viewing.recipients_raw ?? "",
                  }),
                );
                toast.success("Loaded into composer");
                navigate({ to: "/admin/blast" });
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Reuse in composer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
