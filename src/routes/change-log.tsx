import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/change-log")({
  head: () => ({
    meta: [
      { title: "Change Log — CryptoPOP" },
      {
        name: "description",
        content:
          "A running log of what we're shipping at CryptoPOP — features, fixes, and the road to mainnet.",
      },
      { property: "og:title", content: "Change Log — CryptoPOP" },
      {
        property: "og:description",
        content: "Every version, every shipment. Watch CryptoPOP evolve in public.",
      },
    ],
  }),
  component: ChangeLogPage,
});

type Entry = {
  version: string;
  date: string;
  title: string;
  tag: "launch" | "feature" | "fix" | "infra" | "design";
  items: string[];
};

// Newest first
const ENTRIES: Entry[] = [
  {
    version: "0.9",
    date: "Jun 2026",
    title: "Telegram ops loop",
    tag: "infra",
    items: [
      "New event signups now post to the CryptoPOP Notifications group in real time.",
      "Hardened the notification helper with timeout + Lovable AI gateway proxy.",
      "Trimmed top-line nav — \"My POP\" is now the single entry point (Sign in removed).",
    ],
  },
  {
    version: "0.8",
    date: "Jun 2026",
    title: "Developer API + SEO polish",
    tag: "feature",
    items: [
      "Public /api page documenting the developer surface.",
      "sitemap.xml, JSON-LD, canonical tags and per-route OG metadata across the site.",
      "Mission page redesigned with wellness backdrop and clearer voice.",
    ],
  },
  {
    version: "0.7",
    date: "May 2026",
    title: "Transactional email pipeline",
    tag: "infra",
    items: [
      "pgmq queues for outbound mail (welcome, RSVP confirmation, scan receipts).",
      "Edge worker drains the queue with retry + DLQ handling.",
      "Unsubscribe route + footer compliance.",
    ],
  },
  {
    version: "0.6",
    date: "May 2026",
    title: "QR scan check-in",
    tag: "feature",
    items: [
      "/scan flow with HMAC-signed QR payloads.",
      "Scan success screen with POP receipt + share card.",
      "SCAN_REWARD configurable per event.",
    ],
  },
  {
    version: "0.5",
    date: "May 2026",
    title: "POP awards + on-chain mint",
    tag: "feature",
    items: [
      "pop_awards ledger captures every grant with source, status and tx hash.",
      "TXC minter integration via mintGrant — automatic on signup + scan.",
      "/my-pop dashboard shows balance, history and pending awards.",
    ],
  },
  {
    version: "0.4",
    date: "Apr 2026",
    title: "Events + RSVP",
    tag: "feature",
    items: [
      "Event detail pages with /events/$slug/rsvp signup flow.",
      "Admin signups view at /admin/signups with export.",
      "Per-event admin at /admin/events/$id with attendee roster.",
    ],
  },
  {
    version: "0.3",
    date: "Apr 2026",
    title: "Wallets, key custody, recovery",
    tag: "infra",
    items: [
      "TXC HD wallet derivation from master seed, KMS-encrypted at rest.",
      "Email-keyed wallets so first-time attendees can hold POP before signing up.",
      "/recover-wallet flow auto-claims pre-existing wallets on first login.",
    ],
  },
  {
    version: "0.2",
    date: "Mar 2026",
    title: "Auth + roles",
    tag: "feature",
    items: [
      "Email magic-link + Google OAuth via Lovable Cloud.",
      "user_roles table with has_role() security-definer for admin gating.",
      "Profile auto-provisioning on first sign-in.",
    ],
  },
  {
    version: "0.1",
    date: "Mar 2026",
    title: "Hello, CryptoPOP",
    tag: "launch",
    items: [
      "Brand system: Bebas Neue + Poppins, neon palette, coin + logo assets.",
      "Landing page with hero, mission teaser, footer.",
      "Lovable Cloud backend, TanStack Start template, edge deployment.",
    ],
  },
];

const TAG_STYLES: Record<Entry["tag"], string> = {
  launch: "bg-[var(--neon-pink)]/15 text-[var(--neon-pink)] border-[var(--neon-pink)]/40",
  feature: "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/40",
  fix: "bg-[var(--neon-lime)]/15 text-[var(--neon-lime)] border-[var(--neon-lime)]/40",
  infra: "bg-[var(--neon-purple)]/15 text-[var(--neon-purple)] border-[var(--neon-purple)]/40",
  design: "bg-bone/15 text-bone border-bone/40",
};

function ChangeLogPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient brand gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, color-mix(in oklch, var(--neon-purple) 35%, transparent), transparent 70%), radial-gradient(50% 40% at 90% 10%, color-mix(in oklch, var(--neon-pink) 25%, transparent), transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <header className="border-b border-border/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
            </Link>
            <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition">Home</Link>
              <Link to="/mission" className="hover:text-foreground transition">Mission</Link>
              <Link to="/api" className="hover:text-foreground transition">Developer API</Link>
              <Link to="/my-pop" className="hover:text-foreground transition">My POP</Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--neon-pink)]">
              Build log · public
            </p>
            <h1 className="mt-4 font-display text-5xl md:text-7xl leading-[0.95] uppercase">
              Change<span className="text-[var(--neon-pink)]">.</span> Log
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground">
              Every version we ship, in plain language. This is how CryptoPOP grows —
              live, in public, one POP at a time.
            </p>
          </div>
        </section>

        {/* Timeline */}
        <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <ol className="relative space-y-12">
            {/* Spine */}
            <div
              aria-hidden
              className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-[var(--neon-pink)]/60 via-[var(--neon-purple)]/40 to-transparent"
            />
            {ENTRIES.map((entry) => (
              <li key={entry.version} className="relative pl-8">
                <span
                  aria-hidden
                  className="absolute left-0 top-2 h-[14px] w-[14px] rounded-full bg-[var(--neon-pink)] shadow-[0_0_18px_2px_color-mix(in_oklch,var(--neon-pink)_60%,transparent)]"
                />
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-3xl md:text-4xl uppercase tracking-tight">
                    v{entry.version}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {entry.date}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${TAG_STYLES[entry.tag]}`}
                  >
                    {entry.tag}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  {entry.title}
                </h2>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-2 h-1 w-1 flex-none rounded-full bg-[var(--neon-cyan)]"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="mt-16 rounded-xl border border-border/60 bg-card/40 p-6 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Next up
            </p>
            <p className="mt-2 text-sm text-foreground">
              v1.0 — Admin reward rules, POP awards log, retry tooling, and email-to-user
              auto-claim for returning attendees.
            </p>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
