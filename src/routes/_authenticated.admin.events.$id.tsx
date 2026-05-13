import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signEventQr } from "@/lib/qr.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/events/$id")({
  head: () => ({ meta: [{ title: "Event QR — CryptoPOP Admin" }] }),
  component: EventQrPoster,
});

function EventQrPoster() {
  const { id } = Route.useParams();
  const sign = useServerFn(signEventQr);
  const [qr, setQr] = useState<string | null>(null);
  const [event, setEvent] = useState<{
    name: string;
    description: string | null;
    base_reward: number;
    end_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: ev }, signed] = await Promise.all([
          supabase
            .from("events")
            .select("name, description, base_reward, end_at")
            .eq("id", id)
            .maybeSingle(),
          sign({ data: { eventId: id } }),
        ]);
        if (!ev) {
          setError("Event not found");
          return;
        }
        setEvent(ev);
        setQr(signed.qr);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [id, sign]);

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <header className="border-b border-border/50 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to wallet
          </Link>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print poster
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {error ? (
          <Card className="p-8 text-center text-sm text-destructive">{error}</Card>
        ) : event && qr ? (
          <Card className="overflow-hidden p-0 print:border-0 print:shadow-none">
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background p-8 text-center print:bg-white">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">CryptoPOP Event</p>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{event.name}</h1>
              {event.description && (
                <p className="mt-3 text-sm text-muted-foreground">{event.description}</p>
              )}
            </div>

            <div className="flex flex-col items-center gap-6 p-10">
              <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-border">
                <QRCodeSVG value={qr} size={320} level="M" />
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-bold">+{event.base_reward} POP</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  Scan to claim · Proof of Presence
                </p>
              </div>
            </div>

            <div className="border-t border-border bg-muted/30 px-6 py-4 text-center text-xs text-muted-foreground print:hidden">
              <p>Open the CryptoPOP app and tap "Scan to earn"</p>
              <p className="mt-2 font-mono break-all opacity-60">{qr}</p>
            </div>
          </Card>
        ) : (
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        )}
      </main>
    </div>
  );
}
