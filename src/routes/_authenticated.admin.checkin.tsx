import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserPlus,
  X,
  Sparkles,
  Minus,
  Plus,
} from "lucide-react";
import {
  checkInSignup,
  adminAddGuest,
  listCheckinEvents,
} from "@/lib/signups.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in Scanner — CryptoPOP Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinScannerPage,
});

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type LastResult =
  | { kind: "success"; name: string; already: boolean; heads: number; pop: number }
  | { kind: "error"; message: string };

type CheckinEvent = {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  live: boolean;
};

function CheckinScannerPage() {
  const checkIn = useServerFn(checkInSignup);
  const addGuest = useServerFn(adminAddGuest);
  const fetchEvents = useServerFn(listCheckinEvents);

  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastResult | null>(null);
  const [count, setCount] = useState(0);
  const [heads, setHeads] = useState(0); // extra guests present at the door (0 = solo)
  const lockRef = useRef(false);
  const lastValueRef = useRef<{ v: string; at: number } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [events, setEvents] = useState<CheckinEvent[] | null>(null);
  const [eventsErr, setEventsErr] = useState<string | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestForm, setGuestForm] = useState({
    event_id: "",
    full_name: "",
    email: "",
    mobile_number: "",
    guest_count: "0",
  });

  const handleScan = useCallback(
    async (raw: string) => {
      if (lockRef.current || showAdd) return;
      const now = Date.now();
      if (
        lastValueRef.current &&
        lastValueRef.current.v === raw &&
        now - lastValueRef.current.at < 3000
      ) {
        return;
      }
      lastValueRef.current = { v: raw, at: now };

      const match = raw.match(UUID_RE);
      if (!match) {
        setLast({ kind: "error", message: "Not a valid pass QR." });
        return;
      }
      const id = match[0];
      lockRef.current = true;
      setBusy(true);
      try {
        const res = await checkIn({
          data: { id, guest_count: heads },
        });
        setLast({
          kind: "success",
          name: res.fullName ?? "Attendee",
          already: res.alreadyCheckedIn,
          heads: res.heads ?? 1 + heads,
          pop: res.popAwarded ?? 0,
        });
        if (!res.alreadyCheckedIn) {
          setCount((c) => c + (res.heads ?? 1 + heads));
          setHeads(0); // reset for the next attendee
        }
      } catch (e) {
        setLast({
          kind: "error",
          message: e instanceof Error ? e.message : "Check-in failed",
        });
      } finally {
        setBusy(false);
        setTimeout(() => {
          lockRef.current = false;
        }, 1500);
      }
    },
    [checkIn, showAdd, heads],
  );


  const openAddGuest = useCallback(() => {
    setShowAdd(true);
    setEventsErr(null);
    if (!events) {
      fetchEvents()
        .then((res) => {
          setEvents(res.events);
          // Pre-select the top event (live > upcoming).
          setGuestForm((f) => ({
            ...f,
            event_id: f.event_id || res.events[0]?.id || "",
          }));
        })
        .catch((e) =>
          setEventsErr(e instanceof Error ? e.message : "Failed to load events"),
        );
    }
  }, [events, fetchEvents]);

  const closeAddGuest = () => {
    if (guestBusy) return;
    setShowAdd(false);
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guestBusy) return;
    if (!guestForm.event_id) {
      toast.error("Select an event");
      return;
    }
    if (!guestForm.full_name.trim() || !guestForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setGuestBusy(true);
    try {
      await addGuest({
        data: {
          event_id: guestForm.event_id,
          full_name: guestForm.full_name.trim(),
          email: guestForm.email.trim(),
          mobile_number: guestForm.mobile_number.trim() || null,
          guest_count: Math.max(0, Number(guestForm.guest_count) || 0),
        },
      });
      toast.success(
        `${guestForm.full_name || "Guest"} added — pass emailed. They can scan in when it arrives.`,
      );
      setGuestForm((f) => ({
        ...f,
        full_name: "",
        email: "",
        mobile_number: "",
        guest_count: "0",
      }));
      setShowAdd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add guest");
    } finally {
      setGuestBusy(false);
    }
  };

  // Focus name input when sheet opens.
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (showAdd) setTimeout(() => nameRef.current?.focus(), 100);
  }, [showAdd]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>
        <div className="text-center">
          <p className="font-display text-sm font-semibold leading-none">Check-in</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-white/60">
            Scan attendee pass
          </p>
        </div>
        <div className="min-w-[3.5rem] text-right">
          <p className="font-display text-lg font-black tabular-nums leading-none">
            {count}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-white/60">
            in
          </p>
        </div>
      </header>

      {/* Scanner viewport */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <Scanner
          onScan={(codes) => {
            const value = codes[0]?.rawValue;
            if (value) handleScan(value);
          }}
          onError={() => {}}
          constraints={{ facingMode: "environment" }}
          styles={{
            container: { width: "100%", height: "100%" },
            video: { width: "100%", height: "100%", objectFit: "cover" },
          }}
          components={{ finder: false }}
          sound={false}
          paused={showAdd}
        />

        {/* Reticle overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[72vw] max-w-[420px]">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-primary/90" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-primary/90" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-primary/90" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-primary/90" />
          </div>
        </div>

        {busy && (
          <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking in…</span>
            </div>
          </div>
        )}
      </div>

      {/* Result banner + Add Guest button */}
      <footer className="border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3">
        {!last ? (
          <p className="text-center text-sm text-white/70">
            Point the camera at an attendee's pass QR.
          </p>
        ) : last.kind === "success" ? (
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              last.already
                ? "bg-amber-500/15 text-amber-200"
                : "bg-emerald-500/15 text-emerald-200"
            }`}
          >
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-tight truncate">
                {last.name}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-80">
                {last.already ? "Already checked in" : "Checked in ✓"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-red-500/15 px-4 py-3 text-red-200">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold leading-tight">
                Couldn't check in
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-80 truncate">
                {last.message}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={openAddGuest}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-display text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition"
        >
          <UserPlus className="h-4 w-4" />
          Not on the list? Add guest
        </button>
      </footer>

      {/* Add Guest bottom sheet */}
      {showAdd && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/80 backdrop-blur">
          <button
            type="button"
            onClick={closeAddGuest}
            aria-label="Close"
            className="flex-1"
          />
          <form
            onSubmit={submitGuest}
            className="rounded-t-3xl bg-neutral-950 border-t border-white/10 shadow-2xl px-5 pt-5 pb-6 supports-[padding:max(0px)]:pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Add walk-in guest
                </p>
                <p className="text-[11px] font-mono uppercase tracking-widest text-white/50 mt-0.5">
                  Bypasses RSVP deadline · Pass emailed instantly
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddGuest}
                disabled={guestBusy}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                Event
              </span>
              {eventsErr ? (
                <p className="text-sm text-red-300">{eventsErr}</p>
              ) : !events ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-white/60">
                  No live or upcoming events found.
                </p>
              ) : (
                <select
                  value={guestForm.event_id}
                  onChange={(e) =>
                    setGuestForm((f) => ({ ...f, event_id: e.target.value }))
                  }
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-neutral-900">
                      {ev.live ? "🟢 LIVE · " : ""}
                      {ev.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                Full name
              </span>
              <input
                ref={nameRef}
                type="text"
                value={guestForm.full_name}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, full_name: e.target.value }))
                }
                required
                autoCapitalize="words"
                className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Alex Chen"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                Email
              </span>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                value={guestForm.email}
                onChange={(e) =>
                  setGuestForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="alex@example.com"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                  Mobile (optional)
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={guestForm.mobile_number}
                  onChange={(e) =>
                    setGuestForm((f) => ({ ...f, mobile_number: e.target.value }))
                  }
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 555…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                  +guests
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={guestForm.guest_count}
                  onChange={(e) =>
                    setGuestForm((f) => ({ ...f, guest_count: e.target.value }))
                  }
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={guestBusy || !events || events.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-display text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 active:scale-[0.99] transition"
            >
              {guestBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Add guest & email pass
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-white/50 leading-snug">
              They'll get a confirmation email with their pass QR. Scan it when
              they show it to check them in.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
