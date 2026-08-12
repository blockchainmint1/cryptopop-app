
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Sparkles, Coins, Calendar } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { getSignupById } from "@/lib/signups.functions";

const searchSchema = z.object({ id: z.string().uuid().optional() }).partial();

export const Route = createFileRoute("/my-pass")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "My Pass — CryptoPOP" },
      { name: "description", content: "Your CryptoPOP event pass and check-in QR code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPassPage,
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

function MyPassPage() {
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
    const resolved = idFromUrl ?? stored;
    if (resolved && idFromUrl && idFromUrl !== stored) {
      try {
        localStorage.setItem("cryptopop_signup_id", idFromUrl);
      } catch {
        /* ignore */
      }
    }
    setId(resolved ?? null);
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
        if (!res.signup) setError("We couldn't find that pass.");
        else setSignup(res.signup as Signup);
      })
      .catch(() => !cancelled && setError("Something went wrong loading your pass."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, fetchSignup]);

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
            Loading your pass…
          </p>
        ) : !id ? (
          <EmptyPass
            title="No pass on this device"
            message="Open the link from your signup confirmation, or sign up to get a pass."
          />
        ) : error || !signup ? (
          <EmptyPass title="Pass not found" message={error ?? "We couldn't find that pass."} />
        ) : (
          <PassCard signup={signup} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function PassCard({ signup }: { signup: Signup }) {
  const checkedIn = !!signup.checked_in_at;
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 font-display text-3xl font-bold">You're in!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You've earned your first <span className="font-semibold text-foreground">10 POP</span>.
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
          <QRCodeSVG
            value={signup.id}
            size={224}
            level="M"
            includeMargin={false}
          />
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
            icon={<Calendar className="h-4 w-4 text-primary" />}
            label="Signed up"
            value={new Date(signup.signed_up_at).toLocaleDateString()}
          />
        </div>




        <Link
          to="/app"
          className="mt-4 block w-full rounded-full bg-primary px-6 py-3 text-center font-display font-semibold text-primary-foreground hover:opacity-90"
        >
          View my POP & activities →
        </Link>
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
      <a
        href={mainSiteEventsUrl()}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground"
      >
        Sign up
      </a>
    </div>
  );
}
