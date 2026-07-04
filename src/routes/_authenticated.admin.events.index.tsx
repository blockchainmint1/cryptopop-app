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
  UserPlus,
  Mail,
} from "lucide-react";

import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  type AdminEventRow,
} from "@/lib/events-admin.functions";
import { adminAddGuest } from "@/lib/signups.functions";

import { GeofenceMapPicker } from "@/components/geofence-map-picker";
import {
  COMMON_TIMEZONES,
  browserTimeZone,
  utcIsoToZonedWallTime,
  zonedWallTimeToUtcIso,
  tzAbbreviation,
} from "@/lib/tz";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/events/")({
  head: () => ({ meta: [{ title: "Events — CryptoPOP Admin" }] }),
  component: AdminEventsList,
});

function toLocalInputValue(iso: string | undefined, tz: string) {
  const isoStr = iso ?? new Date().toISOString();
  return utcIsoToZonedWallTime(isoStr, tz);
}

function formatDate(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  });
}

function usaPreview(local: string, tz: string) {
  if (!local) return "—";
  // Treat `local` as wall-clock in `tz`; show ISO date + pretty in that tz.
  try {
    const utc = zonedWallTimeToUtcIso(local, tz);
    const d = new Date(utc);
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const pretty = d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
    return `${ymd} · ${pretty} ${tzAbbreviation(tz, d)}`;
  } catch {
    return "—";
  }
}

function AdminEventsList() {
  const list = useServerFn(listAdminEvents);
  const create = useServerFn(createAdminEvent);
  const update = useServerFn(updateAdminEvent);
  const addGuest = useServerFn(adminAddGuest);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [guestFor, setGuestFor] = useState<AdminEventRow | null>(null);
  const [guestForm, setGuestForm] = useState({
    full_name: "",
    email: "",
    mobile_number: "",
    guest_count: "0",
  });
  const [guestSaving, setGuestSaving] = useState(false);


  const emptyForm = () => {
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const tz = browserTimeZone();
    return {
      name: "",
      description: "",
      cover_url: "",
      lat: "1.3521",
      lng: "103.8198",
      radius_m: "200",
      time_zone: tz,
      start_at: toLocalInputValue(now.toISOString(), tz),
      end_at: toLocalInputValue(inTwoHours.toISOString(), tz),
      base_reward: "100",
      referral_reward: "25",
      qr_active_minutes_before: "60",
    };
  };
  const [form, setForm] = useState(emptyForm);

  function startEdit(e: AdminEventRow) {
    setEditingId(e.id);
    setShowCreate(true);
    const tz = e.time_zone || browserTimeZone();
    setForm({
      name: e.name,
      description: e.description ?? "",
      cover_url: e.cover_url ?? "",
      lat: String(e.lat),
      lng: String(e.lng),
      radius_m: String(e.radius_m),
      time_zone: tz,
      start_at: toLocalInputValue(e.start_at, tz),
      end_at: toLocalInputValue(e.end_at, tz),
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
        time_zone: form.time_zone,
        start_at: zonedWallTimeToUtcIso(form.start_at, form.time_zone),
        end_at: zonedWallTimeToUtcIso(form.end_at, form.time_zone),
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

  function openGuestDialog(ev: AdminEventRow) {
    setGuestFor(ev);
    setGuestForm({ full_name: "", email: "", mobile_number: "", guest_count: "0" });
  }

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!guestFor) return;
    setGuestSaving(true);
    try {
      await addGuest({
        data: {
          event_id: guestFor.id,
          full_name: guestForm.full_name.trim(),
          email: guestForm.email.trim(),
          mobile_number: guestForm.mobile_number.trim() || null,
          guest_count: Math.max(0, Number(guestForm.guest_count) || 0),
        },
      });
      toast.success(`${guestForm.full_name || "Guest"} added — confirmation email sent.`);
      setGuestFor(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add guest");
    } finally {
      setGuestSaving(false);
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
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="time_zone">Time zone</Label>
              <Select
                value={form.time_zone}
                onValueChange={(v) => setForm({ ...form, time_zone: v })}
              >
                <SelectTrigger id="time_zone">
                  <SelectValue placeholder="Select a time zone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label} ({tzAbbreviation(tz.value)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="font-mono text-[10px] text-muted-foreground">
                Start & end times are interpreted in this zone.
              </p>
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
              <p className="font-mono text-[10px] text-muted-foreground">
                {usaPreview(form.start_at, form.time_zone)}
              </p>
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
              <p className="font-mono text-[10px] text-muted-foreground">
                {usaPreview(form.end_at, form.time_zone)}
              </p>
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
          <EventSection
            title="Upcoming & active"
            rows={upcoming}
            onEdit={startEdit}
            onAddGuest={openGuestDialog}
          />
          <EventSection title="Past events" rows={past} muted onEdit={startEdit} />
        </div>
      )}

      <Dialog open={!!guestFor} onOpenChange={(o) => !o && setGuestFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add guest</DialogTitle>
            <DialogDescription>
              {guestFor
                ? `Manually register a late arrival for ${guestFor.name}. They'll get a confirmation email with their pass QR and event info.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitGuest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest_name">Full name</Label>
              <Input
                id="guest_name"
                required
                autoFocus
                value={guestForm.full_name}
                onChange={(e) =>
                  setGuestForm({ ...guestForm, full_name: e.target.value })
                }
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input
                id="guest_email"
                type="email"
                required
                value={guestForm.email}
                onChange={(e) =>
                  setGuestForm({ ...guestForm, email: e.target.value })
                }
                placeholder="jane@example.com"
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                Confirmation email + pass link go here.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guest_mobile">Mobile (optional)</Label>
                <Input
                  id="guest_mobile"
                  value={guestForm.mobile_number}
                  onChange={(e) =>
                    setGuestForm({ ...guestForm, mobile_number: e.target.value })
                  }
                  placeholder="+1 555 …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_plus">+ guests</Label>
                <Input
                  id="guest_plus"
                  type="number"
                  min={0}
                  max={20}
                  value={guestForm.guest_count}
                  onChange={(e) =>
                    setGuestForm({ ...guestForm, guest_count: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGuestFor(null)}
                disabled={guestSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={guestSaving}>
                {guestSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Add & send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function EventSection({
  title,
  rows,
  muted,
  onEdit,
  onAddGuest,
}: {
  title: string;
  rows: AdminEventRow[];
  muted?: boolean;
  onEdit: (e: AdminEventRow) => void;
  onAddGuest?: (e: AdminEventRow) => void;
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
                    {formatDate(e.start_at, e.time_zone)} → {formatDate(e.end_at, e.time_zone)} {tzAbbreviation(e.time_zone, new Date(e.start_at))}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {e.lat.toFixed(4)}, {e.lng.toFixed(4)} · {e.radius_m}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {e.signup_count} signups
                    {e.guest_count > 0 && (
                      <> +{e.guest_count} guests ({e.signup_count + e.guest_count} total)</>
                    )}
                    {" · "}{e.claim_count} claims
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
            <div className="flex flex-wrap gap-2 mt-4">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/events/$id" params={{ id: e.id }}>
                  <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR poster
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(e)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              {onAddGuest && (
                <Button size="sm" onClick={() => onAddGuest(e)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add guest
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

    </section>
  );
}
