import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ArrowLeft,
  Coins,
  Sparkles,
  CheckCircle2,
  Calendar,
  QrCode,
  Trophy,
  Flame,
} from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import myPopBg from "@/assets/my-pop-bg.jpg";
import { SiteFooter } from "@/components/site-footer";
import { getSignupById } from "@/lib/signups.functions";

const searchSchema = z.object({ id: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/my-pop")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "My POP — CryptoPOP" },
      {
        name: "description",
        content: "Your POP balance, activity history and event check-ins.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPopPage,
});

type Signup = {
  id: string;
  full_name: string;
  email: string;
  pop_credits: number;
  status: string;
  signed_up_at: string;
  checked_in_at: string | null;
  completed_activities: string[] | null;
};

// Master list of activities — earned ones come from completed_activities[]
const ACTIVITY_CATALOG: Record<
  string,
  { label: string; reward: number; description: string }
> = {
  signup: {
    label: "Joined CryptoPOP",
    reward: 10,
    description: "Welcome bonus for signing up.",
  },
  check_in: {
    label: "Event check-in",
    reward: 25,
    description: "Scanned in at the marina.",
  },
  quiz: {
    label: "POP quiz",
    reward: 10,
    description: "Answered an on-site quiz.",
  },
  referral: {
    label: "Brought a friend",
    reward: 25,
    description: "Friend signed up using your link.",
  },
};

function MyPopPage() {
  const { id: idFromUrl } = Route.useSearch();
  const fetchSignup = useServerFn(getSignupById);
  const [id, setId] = useState<string | null>(null);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("cryptopop_signup_id")
        : null;
    if (idFromUrl && idFromUrl !== stored) {
      try {
        localStorage.setItem("cryptopop_signup_id", idFromUrl);
      } catch {
        /* ignore */
      }
    }
    setId(idFromUrl ?? stored ?? null);
  }, [idFromUrl]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSignup({ data: { id } })
      .then((res) => {
        if (cancelled) return;
        if (!res.signup) setError("We couldn't find your POP account.");
        else setSignup(res.signup as Signup);
      })
      .catch(() =>
        !cancelled && setError("Something went wrong loading your POP."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, fetchSignup]);

  return (
    <div className="relative min-h-screen text-foreground">
      <img
        src={myPopBg}
        alt=""
        aria-hidden
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
        loading="lazy"
        width={1080}
        height={1920}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,20,0.78) 0%, rgba(8,5,20,0.85) 50%, rgba(8,5,20,0.95) 100%)",
        }}
      />
      <div className="relative">
        <header className="border-b border-border/60 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-xl space-y-6 px-6 py-10">
          {loading ? (
            <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Loading your POP…
            </p>
          ) : !id ? (
            <Empty
              title="No POP account on this device"
              message="Sign up to start collecting POP at the next CryptoPOP event."
            />
          ) : error || !signup ? (
            <Empty title="Account not found" message={error ?? "We couldn't find your POP."} />
          ) : (
            <Dashboard signup={signup} />
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}


function Dashboard({ signup }: { signup: Signup }) {
  const earned = new Set(signup.completed_activities ?? []);
  if (signup.checked_in_at) earned.add("check_in");

  const earnedActivities = Array.from(earned)
    .filter((k) => ACTIVITY_CATALOG[k])
    .map((k) => ({ key: k, ...ACTIVITY_CATALOG[k] }));

  const lockedActivities = Object.entries(ACTIVITY_CATALOG)
    .filter(([k]) => !earned.has(k))
    .map(([k, v]) => ({ key: k, ...v }));

  return (
    <>
      {/* Balance hero */}
      <section className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 shadow-[0_30px_80px_-30px] shadow-primary/30">
        <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
          My POP balance
        </p>
        <div className="mt-2 flex items-end gap-3">
          <p className="font-display text-6xl font-bold leading-none tracking-tight">
            {signup.pop_credits}
          </p>
          <p className="pb-1 font-display text-xl font-semibold text-muted-foreground">
            POP
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Welcome back, <span className="text-foreground">{signup.full_name}</span>.
          You've earned <span className="font-semibold text-foreground">{earnedActivities.length}</span>{" "}
          of {Object.keys(ACTIVITY_CATALOG).length} activities.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StatPill icon={<Trophy className="h-3.5 w-3.5" />} label="Earned" value={earnedActivities.length} />
          <StatPill icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={signup.checked_in_at ? 1 : 0} />
          <StatPill
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Status"
            value={signup.checked_in_at ? "On-site" : "Confirmed"}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/my-pass"
            search={{ id: signup.id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 font-display text-sm font-semibold text-background hover:opacity-90"
          >
            <QrCode className="h-3.5 w-3.5" /> Show my pass
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 font-display text-sm hover:bg-card"
          >
            Event details
          </Link>
        </div>
      </section>

      {/* Earned activities */}
      <Section title="Activity history" subtitle="Every POP you've collected.">
        {earnedActivities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No activities yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {/* Synthesize timestamped events. Real timestamps live in `claims`
                long-term; for now, signup and check-in use signup row dates. */}
            {earnedActivities.map((a) => {
              const when =
                a.key === "signup"
                  ? signup.signed_up_at
                  : a.key === "check_in"
                    ? signup.checked_in_at
                    : null;
              return (
                <li key={a.key} className="flex items-center gap-3 p-4">
                  <div className="rounded-full bg-primary/15 p-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold">{a.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.description}
                    </p>
                    {when && (
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(when).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-600">
                    +{a.reward} POP
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Locked / available activities */}
      {lockedActivities.length > 0 && (
        <Section
          title="Earn more POP"
          subtitle="Complete these at the event to collect more credits."
        >
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {lockedActivities.map((a) => (
              <li
                key={a.key}
                className="flex items-center gap-3 p-4 opacity-80"
              >
                <div className="rounded-full bg-muted p-2 text-muted-foreground">
                  <Coins className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.description}
                  </p>
                </div>
                <div className="shrink-0 rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  +{a.reward} POP
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        POP are a participation record. Education only, no monetary value.
      </p>
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-2.5">
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-0.5 font-display text-sm font-bold">{value}</p>
    </div>
  );
}

function Empty({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/events/$slug/rsvp"
        params={{ slug: "july4-marina-bbq" }}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
      >
        Sign up
      </Link>
    </div>
  );
}
