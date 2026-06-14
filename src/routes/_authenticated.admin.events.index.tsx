import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  MapPin,
  Users,
  Plus,
  QrCode,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  type AdminEventRow,
} from "@/lib/events-admin.functions";
import { GeofenceMapPicker } from "@/components/geofence-map-picker";

export const Route = createFileRoute("/_authenticated/admin/events/")({
  head: () => ({ meta: [{ title: "Events — CryptoPOP Admin" }] }),
  component: AdminEventsList,
});

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminEventsList() {
  const list = useServerFn(listAdminEvents);
  const create = useServerFn(createAdminEvent);
  const update = useServerFn(updateAdminEvent);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = () => {
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return {
      name: "",
      description: "",
      cover_url: "",
      lat: "1.3521",
      lng: "103.8198",
      radius_m: "200",
      start_at: toLocalInputValue(now.toISOString()),
      end_at: toLocalInputValue(inTwoHours.toISOString()),
      base_reward: "100",
      referral_reward: "25",
      qr_active_minutes_before: "60",
    };
  };
  const [form, setForm] = useState(emptyForm);

  function startEdit(e: AdminEventRow) {
    setEditingId(e.id);
    setShowCreate(true);
    setForm({
      name: e.name,
      description: e.description ?? "",
      cover_url: e.cover_url ?? "",
      lat: String(e.lat),
      lng: String(e.lng),
      radius_m: String(e.radius_m),
      start_at: toLocalInputValue(e.start_at),
      end_at: toLocalInputValue(e.end_at),
      base_reward: String(e.base_reward),
      referral_reward: String(e.referral_reward),
      qr_active_minutes_before: String(e.qr_active_minutes_before ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await list();
      setEvents(res.events);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        cover_url: form.cover_url.trim() || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        radius_m: Math.round(Number(form.radius_m)),
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        base_reward: Number(form.base_reward),
        referral_reward: Number(form.referral_reward),
        qr_active_minutes_before: Math.round(Number(form.qr_active_minutes_before) || 0),
      };
      if (editingId) {
        await update({ data: { id: editingId, ...payload } });
        toast.success("Event updated");
      } else {
        await create({ data: payload });
        toast.success("Event created");
      }
      cancelForm();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const nowTs = Date.now();
  const upcoming = events.filter((e) => new Date(e.end_at).getTime() >= nowTs);
  const past = events.filter((e) => new Date(e.end_at).getTime() < nowTs);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Events
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight mt-1">
            All events
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Create events, view signups & claims, and print QR posters.
          </p>
        </div>
        <Button onClick={() => (showCreate ? cancelForm() : setShowCreate(true))}>
          {showCreate ? (
            <>
              <X className="h-4 w-4 mr-2" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> New event
            </>
          )}
        </Button>
      </header>

      {showCreate && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 -mt-2 mb-2">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {editingId ? "Editing event" : "New event"}
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="July 4 BBQ"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown on the QR poster & app"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="cover_url">Cover image URL (optional)</Label>
              <Input
                id="cover_url"
                type="url"
                value={form.cover_url}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_at">Starts</Label>
              <Input
                id="start_at"
                type="datetime-local"
                required
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_at">Ends</Label>
              <Input
                id="end_at"
                type="datetime-local"
                required
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Location & geofence</Label>
              <GeofenceMapPicker
                lat={Number(form.lat) || null}
                lng={Number(form.lng) || null}
                radiusM={Number(form.radius_m) || 200}
                onChange={(lat, lng) =>
                  setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                required
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                required
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius_m">Geofence radius (m)</Label>
              <Input
                id="radius_m"
                type="number"
                min={20}
                max={20000}
                required
                value={form.radius_m}
                onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr_active_minutes_before">
                QR active before start (minutes)
              </Label>
              <Input
                id="qr_active_minutes_before"
                type="number"
                min={0}
                max={1440}
                required
                value={form.qr_active_minutes_before}
                onChange={(e) =>
                  setForm({ ...form, qr_active_minutes_before: e.target.value })
                }
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                e.g. 60 = QR works 1 hour before start. 0 = only after start.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_reward">Base POP reward</Label>
              <Input
                id="base_reward"
                type="number"
                min={0}
                required
                value={form.base_reward}
                onChange={(e) => setForm({ ...form, base_reward: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral_reward">Referral POP reward</Label>
              <Input
                id="referral_reward"
                type="number"
                min={0}
                required
                value={form.referral_reward}
                onChange={(e) => setForm({ ...form, referral_reward: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={cancelForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : editingId ? (
                  <Pencil className="h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {editingId ? "Save changes" : "Create event"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
          Loading events…
        </Card>
      ) : (
        <div className="space-y-8">
          <EventSection title="Upcoming & active" rows={upcoming} onEdit={startEdit} />
          <EventSection title="Past events" rows={past} muted onEdit={startEdit} />
        </div>
      )}
    </div>
  );
}

function EventSection({
  title,
  rows,
  muted,
  onEdit,
}: {
  title: string;
  rows: AdminEventRow[];
  muted?: boolean;
  onEdit: (e: AdminEventRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">{title}</h2>
        <Card className="p-6 text-sm text-muted-foreground">No events.</Card>
      </section>
    );
  }
  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-3">
        {title} <span className="text-muted-foreground font-mono text-sm">({rows.length})</span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rows.map((e) => (
          <Card
            key={e.id}
            className={`p-5 ${muted ? "opacity-80" : ""} hover:border-primary/50 transition-colors`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold truncate">{e.name}</h3>
                {e.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {e.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(e.start_at)} → {formatDate(e.end_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {e.lat.toFixed(4)}, {e.lng.toFixed(4)} · {e.radius_m}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {e.signup_count} signups · {e.claim_count} claims
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-2xl font-bold text-primary">
                  +{Number(e.base_reward)}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  POP
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/events/$id" params={{ id: e.id }}>
                  <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR poster
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(e)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
