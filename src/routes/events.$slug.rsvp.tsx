import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import bbqHero from "@/assets/usa-250-bbq.png";
import lakehouseAsset from "@/assets/lakehouse.jpg.asset.json";
import { SiteFooter } from "@/components/site-footer";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createEventSignup } from "@/lib/signups.functions";
import { getPublicEventBySlug } from "@/lib/public-event.functions";

type EventInfo = {
  slug: string;
  name: string;
  date: string;
  location: string;
  mapUrl: string;
  blurb: string;
};

const EVENT_STATIC: Record<string, { location: string; mapUrl: string }> = {
  "4th-at-bobbys": {
    location: "The Lakehouse",
    mapUrl: "https://www.google.com/maps",
  },
};

const EVENT_FALLBACK: Record<string, EventInfo> = {
  "4th-at-bobbys": {
    slug: "4th-at-bobbys",
    name: "4th of July at The Lakehouse",
    date: "Saturday, July 4, 2026 · 3pm–dark",
    location: "The Lakehouse",
    mapUrl: "https://www.google.com/maps",
    blurb:
      "Join us for the 4th at The Lakehouse — play the CryptoPOP scavenger hunt for fun & prizes, bring your favorite dish to share with the community, and let's have a blast!",
  },
};

// Always render in the event's configured tz so server (UTC) and client render
// the same string. Example output: "Sat Jun 28 · 3pm–6pm Central".
function formatEventDate(startIso: string, endIso: string, tz: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dayLabel = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = (d: Date) =>
    d
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
      .replace(":00 ", " ")
      .toLowerCase()
      .replace(/\s(am|pm)/, "$1");
  return `${dayLabel} · ${timeFmt(start)}–${timeFmt(end)} ${tzFriendlyName(tz, start)}`;
}


function mapUrlFor(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export const Route = createFileRoute("/events/$slug/rsvp")({
  loader: async ({ params }) => {
    const row = await getPublicEventBySlug({ data: { slug: params.slug } });
    return { dbEvent: row };
  },
  head: ({ params, loaderData }) => {
    const fallback = EVENT_FALLBACK[params.slug];
    const name = loaderData?.dbEvent?.name ?? fallback?.name;
    const dateLabel = loaderData?.dbEvent
      ? formatEventDate(loaderData.dbEvent.start_at, loaderData.dbEvent.end_at, loaderData.dbEvent.time_zone)
      : fallback?.date;
    const title = name ? `Sign up — ${name}` : "Sign up — CryptoPOP";
    const desc = name
      ? `Reserve your spot at ${name}${dateLabel ? ` on ${dateLabel}` : ""}. Free, family-friendly, education-only.`
      : "Sign up to the next CryptoPOP event.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: SignupPage,
});

const signupSchema = z
  .object({
    full_name: z.string().trim().min(1, "Your name is required").max(120),
    email: z.string().trim().email("Enter a valid email").max(254),
    mobile_number: z
      .string()
      .trim()
      .min(3, "Mobile number is too short")
      .max(32, "Mobile number is too long"),
    instagram_handle: z.string().trim().max(64).optional().or(z.literal("")),
    telegram_handle: z.string().trim().max(64).optional().or(z.literal("")),
    external_wallet: z.string().trim().max(48).optional().or(z.literal("")),
    is_friend: z.enum(["yes", "no"]),
    guest_count: z.number().int().min(0).max(20),
  })
  .refine((d) => d.is_friend === "no" || d.guest_count >= 1, {
    message: "How many guests are you bringing?",
    path: ["guest_count"],
  });

function SignupPage() {
  const { slug } = Route.useParams();
  const { dbEvent } = Route.useLoaderData();
  const fallback = EVENT_FALLBACK[slug];
  const staticBits = EVENT_STATIC[slug];
  // Render in the event's tz on the server (stable for hydration), then swap
  // to the viewer's local tz on the client so people see their own clock.
  const [viewerTz, setViewerTz] = useState<string | null>(null);
  useEffect(() => {
    try {
      setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      // ignore
    }
  }, []);
  const ev: EventInfo | undefined = dbEvent
    ? {
        slug: dbEvent.slug,
        name: dbEvent.name,
        date: formatEventDate(
          dbEvent.start_at,
          dbEvent.end_at,
          viewerTz ?? dbEvent.time_zone,
        ),
        location: staticBits?.location ?? fallback?.location ?? "",
        mapUrl: mapUrlFor(dbEvent.lat, dbEvent.lng),
        blurb: dbEvent.description ?? fallback?.blurb ?? "",
      }
    : fallback;
  const navigate = useNavigate();
  const saveSignup = useServerFn(createEventSignup);
  const [submitting, setSubmitting] = useState(false);
  const [isFriend, setIsFriend] = useState<"yes" | "no">("no");
  const [guestCount, setGuestCount] = useState(1);

  if (!ev) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-display text-3xl font-bold">Event not found</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn't find that event.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 font-display"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ev) return;
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: form.get("full_name"),
      email: form.get("email"),
      mobile_number: form.get("mobile_number"),
      instagram_handle: form.get("instagram_handle"),
      telegram_handle: form.get("telegram_handle"),
      external_wallet: form.get("external_wallet"),
      is_friend: form.get("is_friend"),
      guest_count: Number(form.get("guest_count") ?? 0),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      const inserted = await saveSignup({
        data: {
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          mobile_number: parsed.data.mobile_number,
          instagram_handle: parsed.data.instagram_handle || null,
          telegram_handle: parsed.data.telegram_handle || null,
          is_friend: parsed.data.is_friend === "yes",
          guest_count:
            parsed.data.is_friend === "yes" ? parsed.data.guest_count : 0,
          event_slug: slug,
          external_wallet: parsed.data.external_wallet || null,
        },
      });
      try {
        localStorage.setItem("cryptopop_signup_id", inserted.id);
      } catch {
        // ignore storage failures
      }
      toast.success("You're in! 10 POP added.");
      navigate({ to: "/my-pass", search: { id: inserted.id } });
    } catch (error) {
      if (error instanceof Error && error.message === "duplicate_signup") {
        toast.error("That email or mobile number is already signed up.");
        return;
      }
      if (error instanceof Error && error.message === "invalid_wallet_address") {
        toast.error("That doesn't look like a valid TXC address.");
        return;
      }
      toast.error("Couldn't save your signup. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
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

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1.1fr]">
        <aside>
          <div className="mb-6 overflow-hidden rounded-3xl border border-border">
            <img
              src={lakehouseAsset.url}
              alt="The Lakehouse — aerial view of the venue"
              width={1536}
              height={1024}
              className="h-48 w-full object-cover md:h-64"
            />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            CryptoPOP event
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {ev.slug === "july4-marina-bbq" ? (
              <>
                <span className="text-red-500">Red</span>, White & <span className="text-blue-400">Barbecue</span> — USA 250ᵗʰ
              </>
            ) : (
              ev.name
            )}
          </h1>
          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {ev.date}
            </p>
            <a
              href={ev.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-4 w-4 text-primary" />
              {ev.location} — open in Google Maps
            </a>
          </div>
          <p className="mt-6 text-muted-foreground">{ev.blurb}</p>
          <p className="mt-6 rounded-2xl border border-border bg-card p-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Education-only event. POP are a participation record.
          </p>
        </aside>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px] shadow-foreground/20 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <header>
                <h2 className="font-display text-2xl font-bold">Sign up</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free signup. You'll earn <span className="font-semibold text-foreground">10 POP</span> the moment you join.
                </p>
              </header>

              <Field label="Full name" htmlFor="full_name">
                <input
                  id="full_name"
                  name="full_name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={inputCls}
                  placeholder="John Smith"
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    className={inputCls}
                    placeholder="jane@example.com"
                  />
                </Field>
                <Field label="Mobile number" htmlFor="mobile_number">
                  <input
                    id="mobile_number"
                    name="mobile_number"
                    required
                    maxLength={32}
                    autoComplete="tel"
                    inputMode="tel"
                    className={inputCls}
                    placeholder="(555) 123-4567"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Instagram handle (optional)" htmlFor="instagram_handle">
                  <input
                    id="instagram_handle"
                    name="instagram_handle"
                    maxLength={64}
                    className={inputCls}
                    placeholder="@cryptopop"
                  />
                </Field>
                <Field label="Telegram handle (optional)" htmlFor="telegram_handle">
                  <input
                    id="telegram_handle"
                    name="telegram_handle"
                    maxLength={64}
                    className={inputCls}
                    placeholder="@cryptopop"
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Bringing a friend?
                </legend>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <label
                      key={v}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm capitalize transition has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-foreground"
                    >
                      <input
                        type="radio"
                        name="is_friend"
                        value={v}
                        required
                        checked={isFriend === v}
                        onChange={() => setIsFriend(v)}
                        className="sr-only"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </fieldset>

              {isFriend === "yes" && (
                <Field label="How many guests?" htmlFor="guest_count">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
                      className="h-11 w-11 rounded-xl border border-border bg-background font-display text-lg transition hover:border-primary hover:text-primary"
                      aria-label="Decrease guests"
                    >
                      −
                    </button>
                    <input
                      id="guest_count"
                      name="guest_count"
                      type="number"
                      min={1}
                      max={20}
                      value={guestCount}
                      onChange={(e) =>
                        setGuestCount(
                          Math.max(
                            1,
                            Math.min(20, Number(e.target.value) || 1),
                          ),
                        )
                      }
                      className={`${inputCls} text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => setGuestCount((n) => Math.min(20, n + 1))}
                      className="h-11 w-11 rounded-xl border border-border bg-background font-display text-lg transition hover:border-primary hover:text-primary"
                      aria-label="Increase guests"
                    >
                      +
                    </button>
                  </div>
                </Field>
              )}

              <Field label="TXC wallet address (optional)" htmlFor="external_wallet">
                <input
                  id="external_wallet"
                  name="external_wallet"
                  maxLength={48}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputCls} font-mono`}
                  placeholder="Tnnnnn… — leave blank & we'll spin one up for you"
                />
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Already have a TXC wallet? Drop your address & we'll mint POP straight to it.
                </p>
              </Field>



              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Signing you up…" : "Sign up & claim 10 POP"}
              </button>
              <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                We'll only use your details to confirm this signup.
              </p>
            </form>

        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
