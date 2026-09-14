import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Coins, Minus, Plus, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SiteFooter } from "@/components/site-footer";
import { getPublicEventBySlug } from "@/lib/public-event.functions";
import { createEventSignup } from "@/lib/signups.functions";
import { useWallet } from "@/lib/wallet/wallet-context";

export const Route = createFileRoute("/events/$slug")({
  head: () => ({
    meta: [
      { title: "RSVP — CryptoPOP Event" },
      {
        name: "description",
        content:
          "Reserve your spot for this CryptoPOP event and get your check-in pass in the POP Wallet.",
      },
      { property: "og:title", content: "RSVP — CryptoPOP Event" },
      {
        property: "og:description",
        content:
          "Reserve your spot for this CryptoPOP event and get your check-in pass in the POP Wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventRsvpPage,
});

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

function EventRsvpPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { address } = useWallet();
  const fetchEvent = useServerFn(getPublicEventBySlug);
  const submit = useServerFn(createEventSignup);

  const { data: event, isLoading } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => fetchEvent({ data: { slug } }),
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [bringing, setBringing] = useState(false);
  const [guests, setGuests] = useState(1);
  const [saving, setSaving] = useState(false);

  // Prefill from the last pass created on this device.
  useEffect(() => {
    try {
      const cached = localStorage.getItem("cryptopop_signup_contact");
      if (cached) {
        const c = JSON.parse(cached) as { name?: string; email?: string; mobile?: string };
        if (c.name) setFullName(c.name);
        if (c.email) setEmail(c.email);
        if (c.mobile) setMobile(c.mobile);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await submit({
        data: {
          full_name: fullName.trim(),
          email: email.trim(),
          mobile_number: mobile.trim(),
          is_friend: bringing,
          guest_count: bringing ? guests : 0,
          event_slug: slug,
          external_wallet: address ?? null,
        },
      });
      try {
        localStorage.setItem("cryptopop_signup_id", res.id);
        localStorage.setItem(
          "cryptopop_signup_contact",
          JSON.stringify({ name: fullName.trim(), email: email.trim(), mobile: mobile.trim() }),
        );
      } catch {
        /* ignore */
      }
      toast.success(
        res.popAwarded > 0
          ? `You're in — ${res.popAwarded} POP is on its way to your wallet.`
          : "You're in! Check in at the door to earn POP.",
      );
      navigate({ to: "/my-pass", search: { id: res.id } });
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("duplicate_signup")) {
        toast.error("That email or number is already registered.");
      } else if (msg.includes("invalid_wallet_address")) {
        toast.error("Your wallet address couldn't be verified. Try again after unlocking.");
      } else {
        toast.error("We couldn't complete your RSVP. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          to="/events"
          aria-label="Back to events"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">RSVP</h1>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading event…</p>
        ) : !event ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="font-display text-lg font-semibold">Event not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have been removed. Browse the full calendar instead.
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/events">See all events</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-xl font-bold tracking-tight">{event.name}</h2>
              <p className="mt-2 flex items-start gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {formatWhen(event.start_at, event.end_at, event.time_zone)}
              </p>
              {event.description ? (
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
              {event.spotsLeft != null && event.rsvpOpen ? (
                <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {event.spotsLeft} spots left
                </p>
              ) : null}
            </section>

            {!event.rsvpOpen ? (
              <div className="mt-5 rounded-2xl border border-border bg-card p-6 text-center">
                <p className="font-display text-lg font-semibold">RSVPs are closed</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This event is full or has already happened.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={120}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile">Mobile number</Label>
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                  <span className="text-sm">Bringing guests?</span>
                  <Switch
                    checked={bringing}
                    onCheckedChange={setBringing}
                    aria-label="Bringing guests"
                  />
                </div>
                {bringing ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                    <span className="text-sm">How many guests?</span>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full"
                        aria-label="Fewer guests"
                        onClick={() => setGuests((g) => Math.max(1, g - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center font-display text-lg">{guests}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full"
                        aria-label="More guests"
                        onClick={() => setGuests((g) => Math.min(20, g + 1))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> POP goes to
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {address ?? "Unlock your wallet to receive POP on this device"}
                  </p>
                </div>

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Registration POP is a one-time welcome reward for your first event. After that,
                  you earn POP by showing up and checking in at the door.
                </p>

                <Button type="submit" disabled={saving} className="h-12 w-full rounded-full">
                  {saving ? "Reserving…" : "RSVP & get my pass"}
                </Button>
              </form>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
