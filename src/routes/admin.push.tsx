import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Bell, Loader2, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getPushOverview, sendPushCampaign } from "@/lib/push.functions";

export const Route = createFileRoute("/admin/push")({
  head: () => ({
    meta: [
      { title: "Push notifications — POP Wallet admin" },
      { name: "description", content: "Compose and send push notifications to POP Wallet devices." },
      { property: "og:title", content: "Push notifications — POP Wallet admin" },
      { property: "og:description", content: "Send push notifications to POP Wallet devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PushAdmin,
});

type Campaign = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience: string;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};

function PushAdmin() {
  const { isAdmin, loading } = useIsAdmin();
  const fetchOverview = useServerFn(getPushOverview);
  const send = useServerFn(sendPushCampaign);

  const [data, setData] = useState<{
    devices: number;
    activeDevices: number;
    campaigns: Campaign[];
    configured: boolean;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<"all" | "ios" | "android">("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchOverview()
      .then((d) => setData(d as never))
      .catch((e) => toast.error((e as Error).message));
  }, [fetchOverview]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function onSend() {
    setBusy(true);
    try {
      const res = await send({ data: { title, body, url: url || null, audience } });
      toast.success(`Sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`);
      setTitle("");
      setBody("");
      setUrl("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Admins only</h1>
        <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to wallet
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Wallet
        </Link>

        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight">
          Push notifications
        </h1>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="border-white/12 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Devices
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{data?.devices ?? "—"}</p>
          </Card>
          <Card className="border-white/12 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Opted in
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{data?.activeDevices ?? "—"}</p>
          </Card>
        </div>

        {data && !data.configured && (
          <p className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            Delivery is not configured yet — add the Firebase service-account key
            (FCM_SERVICE_ACCOUNT_JSON) and sends will start going out.
          </p>
        )}

        <Card className="mt-5 space-y-3 border-white/12 bg-white/5 p-5">
          <p className="font-display text-lg font-semibold uppercase">Compose</p>
          <Input
            placeholder="Title"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
          />
          <Textarea
            placeholder="Message"
            value={body}
            maxLength={240}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <Input
            placeholder="Link (optional) — e.g. /events"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11"
          />
          <div className="flex gap-2">
            {(["all", "ios", "android"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`flex-1 rounded-full border px-3 py-2 font-mono text-[11px] uppercase tracking-widest ${
                  audience === a
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-white/12 text-muted-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <Button
            className="h-12 w-full rounded-full"
            disabled={busy || !title || !body}
            onClick={onSend}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send notification
          </Button>
        </Card>

        <div className="mt-6 space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">History</p>
          {(data?.campaigns ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          )}
          {(data?.campaigns ?? []).map((c) => (
            <Card key={c.id} className="border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold uppercase">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.body}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> {c.audience}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bell className="h-3 w-3" /> {c.sent_count} sent
                </span>
                {c.failed_count > 0 && <span className="text-destructive">{c.failed_count} failed</span>}
              </p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
