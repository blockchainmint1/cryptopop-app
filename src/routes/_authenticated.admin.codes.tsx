import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  QrCode as QrIcon,
  Plus,
  X,
  Copy,
  Trash2,
  Power,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createQrCode,
  listQrCodes,
  updateQrCode,
  deleteQrCode,
} from "@/lib/qr-codes.functions";
import { listAdminEvents } from "@/lib/events-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/codes")({
  head: () => ({ meta: [{ title: "QR Codes — CryptoPOP Admin" }] }),
  component: AdminCodes,
});

type CodeRow = {
  id: string;
  token: string;
  label: string;
  pop_reward: number;
  event_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  expires_at: string;
  single_use: boolean;
  use_count: number;
  active: boolean;
  created_at: string;
  events: { name: string } | null;
};

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scanUrl(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/claim/${token}`;
}

function AdminCodes() {
  const list = useServerFn(listQrCodes);
  const create = useServerFn(createQrCode);
  const update = useServerFn(updateQrCode);
  const remove = useServerFn(deleteQrCode);
  const fetchEvents = useServerFn(listAdminEvents);

  const [rows, setRows] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "expired">(
    "all",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [showQrFor, setShowQrFor] = useState<CodeRow | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list({ data: { status } });
      setRows(res.codes as CodeRow[]);
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

  useEffect(() => {
    fetchEvents()
      .then((r) =>
        setEvents(
          (r.events ?? []).map((e: { id: string; name: string }) => ({
            id: e.id,
            name: e.name,
          })),
        ),
      )
      .catch(() => {});
  }, [fetchEvents]);

  async function doToggle(row: CodeRow) {
    try {
      await update({ data: { id: row.id, active: !row.active } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function doDelete(row: CodeRow) {
    if (!confirm(`Delete "${row.label}"? This removes the code and its scans.`))
      return;
    try {
      await remove({ data: { id: row.id } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Admin
          </Link>
          <h1 className="font-display text-lg font-bold">QR Codes</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New code
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "inactive", "expired"] as const).map((s) => (
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
        </div>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No codes yet. Create one to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const expired = new Date(r.expires_at).getTime() <= Date.now();
                const exhausted = r.single_use && r.use_count >= 1;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display font-semibold">
                          {r.label}
                        </p>
                        {r.single_use && (
                          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest">
                            single-use
                          </span>
                        )}
                        {r.lat !== null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest">
                            <MapPin className="h-3 w-3" />
                            {r.radius_m}m
                          </span>
                        )}
                        {!r.active && (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-destructive">
                            disabled
                          </span>
                        )}
                        {expired && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-600">
                            expired
                          </span>
                        )}
                        {exhausted && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-600">
                            used
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {r.pop_reward} POP
                        </span>
                        <span>Scans: {r.use_count}</span>
                        {r.events && <span>Event: {r.events.name}</span>}
                        <span>Expires: {new Date(r.expires_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                        {scanUrl(r.token)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(scanUrl(r.token));
                          toast.success("Link copied");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-display text-[11px] hover:bg-muted"
                      >
                        <Copy className="h-3 w-3" /> Link
                      </button>
                      <button
                        onClick={() => setShowQrFor(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-display text-[11px] hover:bg-muted"
                      >
                        <QrIcon className="h-3 w-3" /> QR
                      </button>
                      <button
                        onClick={() => doToggle(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-display text-[11px] hover:bg-muted"
                      >
                        <Power className="h-3 w-3" />
                        {r.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => doDelete(r)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-display text-[11px] text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>

      {showCreate && (
        <CreateCodeDialog
          events={events}
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            try {
              const res = await create({ data: input });
              toast.success("Code created");
              setShowCreate(false);
              refresh();
              setShowQrFor(res.code as CodeRow);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Create failed");
            }
          }}
        />
      )}

      {showQrFor && <QrDialog code={showQrFor} onClose={() => setShowQrFor(null)} />}
    </div>
  );
}

function CreateCodeDialog({
  events,
  onClose,
  onCreate,
}: {
  events: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreate: (input: {
    label: string;
    pop_reward: number;
    event_id: string | null;
    geofence: { lat: number; lng: number; radius_m: number } | null;
    expires_at: string;
    single_use: boolean;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [pop, setPop] = useState("10");
  const [eventId, setEventId] = useState<string>("");
  const [geofenced, setGeofenced] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("200");
  const [expires, setExpires] = useState(toLocalInput());
  const [singleUse, setSingleUse] = useState(false);
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        toast.success("Location set");
      },
      (e) => toast.error(e.message),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const popN = Number(pop);
    if (!label.trim() || !Number.isInteger(popN) || popN <= 0) {
      toast.error("Label and POP amount required");
      return;
    }
    let geofence: { lat: number; lng: number; radius_m: number } | null = null;
    if (geofenced) {
      const la = Number(lat),
        ln = Number(lng),
        ra = Number(radius);
      if (!Number.isFinite(la) || !Number.isFinite(ln) || !Number.isInteger(ra)) {
        toast.error("Set a valid lat, lng and radius");
        return;
      }
      geofence = { lat: la, lng: ln, radius_m: ra };
    }
    const expiresIso = new Date(expires).toISOString();
    if (new Date(expiresIso).getTime() <= Date.now()) {
      toast.error("Expiry must be in the future");
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        label: label.trim(),
        pop_reward: popN,
        event_id: eventId || null,
        geofence,
        expires_at: expiresIso,
        single_use: singleUse,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">New QR code</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Booth A — Friday"
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pop">POP reward</Label>
              <Input
                id="pop"
                value={pop}
                onChange={(e) => setPop(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label htmlFor="event">Event (optional)</Label>
              <select
                id="event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer" htmlFor="geo">
                Geofence this code
              </Label>
              <Switch id="geo" checked={geofenced} onCheckedChange={setGeofenced} />
            </div>
            {geofenced && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="lat">Latitude</Label>
                    <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="1.3521" />
                  </div>
                  <div>
                    <Label htmlFor="lng">Longitude</Label>
                    <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="103.8198" />
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="radius">Radius (meters)</Label>
                    <Input
                      id="radius"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={useMyLocation}>
                    <MapPin className="h-4 w-4 mr-1" /> Use my location
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="exp">Expires</Label>
            <Input
              id="exp"
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="single" className="cursor-pointer">
                Single-use
              </Label>
              <p className="text-xs text-muted-foreground">
                First successful scan locks the code globally. Otherwise each user can scan once.
              </p>
            </div>
            <Switch id="single" checked={singleUse} onCheckedChange={setSingleUse} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function QrDialog({ code, onClose }: { code: CodeRow; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = useMemo(() => scanUrl(code.token), [code.token]);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 320, margin: 2 }).catch(() => {});
  }, [url]);

  function download() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${code.label.replace(/[^a-z0-9]+/gi, "-")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold truncate">{code.label}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-center bg-white p-4 rounded-lg">
          <canvas ref={canvasRef} />
        </div>
        <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">{url}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Copy link
          </Button>
          <Button onClick={download}>Download PNG</Button>
        </div>
      </Card>
    </div>
  );
}
