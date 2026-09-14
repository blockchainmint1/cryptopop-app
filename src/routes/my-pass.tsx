import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/site-footer";
import { getMyEventMemberships, type MyEventMembership } from "@/lib/my-events.functions";
import { getSignupById } from "@/lib/signups.functions";

const searchSchema = z.object({ id: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/my-pass")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "My Pass — CryptoPOP" },
      { name: "description", content: "Your CryptoPOP event passes and check-in QR codes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPassPage,
});

type DetailSignup = {
  id: string;
  full_name: string;
  pop_credits: number;
  status: string;
  signed_up_at: string | null;
  checked_in_at: string | null;
};

function formatWhen(startAt: string, endAt: string, timeZone: string) {
  try {
    const day = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(new Date(startAt));
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(startAt));
    const endTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(endAt));
    return `${day} · ${time}–${endTime}`;
  } catch {
    return new Date(startAt).toLocaleString();
  }
}

function formatDay(startAt: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(new Date(startAt));
  } catch {
    return new Date(startAt).toLocaleDateString();
  }
}

function formatTimeRange(startAt: string, endAt: string, timeZone: string) {
  try {
    const start = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(startAt));
    const end = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(endAt));
    return `${start}–${end}`;
  } catch {
    return "";
  }
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function MyPassPage() {
  const { id: idFromUrl } = Route.useSearch();
  const { user } = useAuth();
  const fetchMemberships = useServerFn(getMyEventMemberships);
  const fetchSignup = useServerFn(getSignupById);

  const [memberships, setMemberships] = useState<MyEventMembership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl ?? null);
  const [detailSignup, setDetailSignup] = useState<DetailSignup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve initial selected id from URL or localStorage.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("cryptopop_signup_id")
        : null;
    const resolved = idFromUrl ?? stored ?? null;
    if (resolved && idFromUrl && idFromUrl !== stored) {
      try {
        localStorage.setItem("cryptopop_signup_id", idFromUrl);
      } catch {
        /* ignore */
      }
    }
    setSelectedId(resolved);
  }, [idFromUrl]);

  // Fetch all memberships for the signed-in user.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMemberships({})
      .then((res) => {
        if (cancelled) return;
        setMemberships(res.memberships);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your passes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchMemberships]);

  // Fetch detail signup for the selected id.
  useEffect(() => {
    if (!selectedId) {
      setDetailSignup(null);
      return;
    }
    let cancelled = false;
    fetchSignup({ data: { id: selectedId } })
      .then((res) => {
        if (cancelled) return;
        if (!res.signup) setDetailSignup(null);
        else setDetailSignup(res.signup as unknown as DetailSignup);
      })
      .catch(() => {
        if (!cancelled) setDetailSignup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fetchSignup]);

  const selectedMembership = useMemo(() => {
    return memberships.find((m) => m.signup_id === selectedId) ?? null;
  }, [memberships, selectedId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          to="/"
          aria-label="Back to wallet"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">My Pass</h1>
      </header>

      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        {loading ? (
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading your passes…
          </p>
        ) : error ? (
          <EmptyPass title="Couldn't load passes" message={error} />
        ) : !user ? (
          <GuestPass id={selectedId} signup={detailSignup} />
        ) : selectedId && selectedMembership && detailSignup ? (
          <PassDetail
            membership={selectedMembership}
            signup={detailSignup}
            onBack={() => setSelectedId(null)}
          />
        ) : memberships.length === 0 ? (
          <EmptyPass
            title="No passes yet"
            message="Sign up for an event to get your first CryptoPOP pass."
          />
        ) : (
          <PassList memberships={memberships} onSelect={setSelectedId} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function PassList({
  memberships,
  onSelect,
}: {
  memberships: MyEventMembership[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {memberships.length} {memberships.length === 1 ? "event" : "events"}
      </p>
      <div className="space-y-4">
        {memberships.map((m) => (
          <EventTile key={m.signup_id} membership={m} onClick={() => onSelect(m.signup_id)} />
        ))}
      </div>
    </div>
  );
}

function EventTile({
  membership,
  onClick,
}: {
  membership: MyEventMembership;
  onClick: () => void;
}) {
  const ev = membership.event;
  const checkedIn = !!membership.checked_in_at;
  return (
    <button
      onClick={onClick}
      className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40"
    >
      {ev?.cover_url ? (
        <div className="relative h-32 w-full">
          <img
            src={ev.cover_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <span className="absolute right-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow">
            {checkedIn ? "Checked in" : "Going"}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            CryptoPOP event
          </span>
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            {checkedIn ? "Checked in" : "Going"}
          </span>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-display text-lg font-semibold leading-tight">
          {ev?.name ?? "CryptoPOP event"}
        </h3>
        {ev ? (
          <p className="mt-2 flex items-start gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {formatDay(ev.start_at, ev.time_zone)} · {formatTimeRange(ev.start_at, ev.end_at, ev.time_zone)}
          </p>
        ) : null}
        {ev && (ev.lat !== 0 || ev.lng !== 0) ? (
          <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Location on Google Maps</span>
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {membership.guest_count > 0 ? `${membership.guest_count + 1} going` : "1 going"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary transition group-hover:translate-x-0.5">
            Details <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

function PassDetail({
  membership,
  signup,
  onBack,
}: {
  membership: MyEventMembership;
  signup: DetailSignup;
  onBack: () => void;
}) {
  const ev = membership.event;
  const checkedIn = !!signup.checked_in_at;
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to passes
      </button>

      <div className="text-center">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight">
          {ev?.name ?? "CryptoPOP event"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Show this QR at the door to check in.
        </p>
      </div>

      {ev ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-start gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {formatWhen(ev.start_at, ev.end_at, ev.time_zone)}
          </p>
          {(ev.lat !== 0 || ev.lng !== 0) ? (
            <a
              href={mapsUrl(ev.lat, ev.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-primary transition hover:underline"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Open location in Google Maps</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              CryptoPOP pass
            </p>
            <p className="mt-1 font-display text-xl font-bold">{signup.full_name}</p>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
              checkedIn
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {checkedIn ? "Checked in" : signup.status}
          </div>
        </div>

        <div className="my-6 flex justify-center rounded-2xl bg-white p-5">
          <QRCodeSVG value={signup.id} size={224} level="M" includeMargin={false} />
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          ID · {signup.id}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Stat
            icon={<Coins className="h-4 w-4 text-primary" />}
            label="POP"
            value={String(signup.pop_credits)}
          />
          <Stat
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
            label="Signed up"
            value={signup.signed_up_at ? new Date(signup.signed_up_at).toLocaleDateString() : "—"}
          />
        </div>
      </div>
    </div>
  );
}

function GuestPass({ id, signup }: { id: string | null; signup: DetailSignup | null }) {
  if (!id) {
    return (
      <EmptyPass
        title="Sign in to see your passes"
        message="Sign in on this device to see all your CryptoPOP event passes in one place."
      />
    );
  }
  if (!signup) {
    return <EmptyPass title="Pass not found" message="We couldn't find that pass." />;
  }
  const checkedIn = !!signup.checked_in_at;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-display text-3xl font-bold">You're in!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Show this QR at the party to check in.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              CryptoPOP pass
            </p>
            <p className="mt-1 font-display text-xl font-bold">{signup.full_name}</p>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
              checkedIn
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            {checkedIn ? "Checked in" : signup.status}
          </div>
        </div>

        <div className="my-6 flex justify-center rounded-2xl bg-white p-5">
          <QRCodeSVG value={signup.id} size={224} level="M" includeMargin={false} />
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          ID · {signup.id}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Stat
            icon={<Coins className="h-4 w-4 text-primary" />}
            label="POP"
            value={String(signup.pop_credits)}
          />
          <Stat
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
            label="Signed up"
            value={signup.signed_up_at ? new Date(signup.signed_up_at).toLocaleDateString() : "—"}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function EmptyPass({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/events"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
      >
        Sign up
      </Link>
    </div>
  );
}
