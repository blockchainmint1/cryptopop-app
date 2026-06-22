import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/cryptopop-logo.png";
import privacyBg from "@/assets/privacy-cinematic-bg.jpg";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CryptoPOP" },
      {
        name: "description",
        content:
          "How CryptoPOP collects, uses, and protects your personal data.",
      },
      { property: "og:title", content: "Privacy Policy — CryptoPOP" },
      {
        property: "og:description",
        content: "How CryptoPOP handles your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const updated = "May 14, 2026";
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Cinematic fixed background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src={privacyBg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover hero-zoom"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,5,20,0.78) 0%, rgba(8,5,20,0.88) 60%, rgba(8,5,20,0.96) 100%)",
          }}
        />
        {/* Aurora glows */}
        <div
          aria-hidden
          className="absolute -top-1/4 -left-1/4 h-[90vh] w-[90vh] rounded-full blur-3xl opacity-60 hero-aurora-a"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,40,0.45), rgba(255,61,190,0.22) 45%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-1/3 -right-1/4 h-[100vh] w-[100vh] rounded-full blur-3xl opacity-55 hero-aurora-b"
          style={{
            background:
              "radial-gradient(circle, rgba(255,220,90,0.4), rgba(255,61,190,0.18) 50%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative z-10">
        <header className="border-b border-white/10 backdrop-blur-xl bg-black/20">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
            </Link>
            <nav className="flex items-center gap-4 font-mono text-xs text-white/70">
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link to="/api" className="hover:text-white transition-colors">
                API
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <div className="hero-fade-up">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/60">
              Legal · Singapore · PDPA
            </p>
            <h1
              className="mt-4 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-7xl"
              style={{
                background:
                  "linear-gradient(90deg, #ffb066 0%, #ff7a28 45%, #ff3dbe 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Privacy Policy
            </h1>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-white/50">
              Last updated · {updated}
            </p>

            <div
              className="mt-8 rounded-3xl border border-white/15 bg-white/5 p-7 text-white/80 backdrop-blur-xl md:p-9"
              style={{
                boxShadow:
                  "0 30px 80px -25px rgba(255,61,190,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset",
              }}
            >
              <p className="leading-relaxed">
                This policy explains how CryptoPOP collects, uses, and discloses
                personal data in accordance with Singapore's Personal Data
                Protection Act 2012 ("PDPA"). It applies to the CryptoPOP
                website, wallet, and related services.
              </p>
            </div>
          </div>

          <Section title="1. What we collect">
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-white">Account data</strong> — your email
                address and basic profile info from your sign-in provider (e.g.
                Google).
              </li>
              <li>
                <strong className="text-white">Wallet data</strong> — your TXC
                wallet address. Private keys are stored encrypted; we do not
                access them in the clear.
              </li>
              <li>
                <strong className="text-white">Location data</strong> — when you
                scan an event QR, your device's geolocation at that moment, used
                solely to verify you are within the event geofence.
              </li>
              <li>
                <strong className="text-white">Event activity</strong> — which
                events you've claimed POP for, timestamps, and the resulting
                on-chain transaction IDs.
              </li>
              <li>
                <strong className="text-white">Technical data</strong> — IP
                address, browser/device info, and error logs needed to operate
                and secure the service.
              </li>
            </ul>
          </Section>

          <Section title="2. How we use it">
            <ul className="ml-5 list-disc space-y-2">
              <li>To create and operate your wallet and process POP grants.</li>
              <li>To verify event attendance via geofence and time window.</li>
              <li>To prevent fraud, abuse, and Sybil attacks.</li>
              <li>
                To respond to support requests and communicate service updates.
              </li>
              <li>To comply with legal obligations under Singapore law.</li>
            </ul>
          </Section>

          <Section title="3. On-chain data is public">
            <p>
              POP transactions live on the public TXC blockchain. Wallet
              addresses, transaction amounts, timestamps, and any on-chain memos
              are visible to anyone, forever, and cannot be deleted by us. Do
              not put information on-chain that you wouldn't want made public.
            </p>
          </Section>

          <Section title="4. Sharing">
            <p>We share personal data only with:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong className="text-white">Service providers</strong> we rely
                on to run CryptoPOP (authentication, database hosting, error
                monitoring), bound by confidentiality and processing agreements.
              </li>
              <li>
                <strong className="text-white">Event organisers</strong> —
                aggregate counts of POP claimed at their events. We do not share
                your email or wallet address with organisers unless you
                explicitly opt in.
              </li>
              <li>
                <strong className="text-white">Authorities</strong> when required
                by Singapore law or a valid legal process.
              </li>
            </ul>
            <p>We do not sell personal data.</p>
          </Section>

          <Section title="5. International transfers">
            <p>
              Some of our infrastructure providers are located outside
              Singapore. When we transfer personal data overseas, we take
              reasonable steps to ensure recipients provide a standard of
              protection comparable to the PDPA.
            </p>
          </Section>

          <Section title="6. Retention">
            <p>
              We retain personal data only as long as needed for the purposes
              above or as required by law. Account and event activity are
              retained while your account is active and for a reasonable period
              after closure for audit and fraud prevention. On-chain records
              cannot be deleted.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use industry-standard safeguards including TLS in transit,
              encryption at rest for wallet keys, row-level access controls on
              our database, and least-privilege server credentials. No system is
              perfectly secure; please report suspected vulnerabilities to{" "}
              <BrandLink href="mailto:security@cryptopop.sg">
                security@cryptopop.sg
              </BrandLink>
              .
            </p>
          </Section>

          <Section title="8. Your PDPA rights">
            <p>You have the right to:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>
                Withdraw consent for our processing (which may end the service).
              </li>
              <li>
                Request deletion of off-chain data, subject to legal exceptions.
              </li>
            </ul>
            <p>
              To exercise these rights, email our Data Protection Officer at{" "}
              <BrandLink href="mailto:dpo@cryptopop.sg">
                dpo@cryptopop.sg
              </BrandLink>
              . If you're unsatisfied with our response, you may contact the
              Personal Data Protection Commission of Singapore.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              We use only the cookies and local storage strictly necessary to
              keep you signed in and to remember your preferences. We do not use
              third-party advertising or cross-site tracking cookies.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              CryptoPOP is not directed to children under 13 and we do not
              knowingly collect their personal data.
            </p>
          </Section>

          <Section title="11. Changes">
            <p>
              We may update this policy. Material changes will be posted here
              with a new "Last updated" date.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Data Protection Officer · CryptoPOP · Singapore ·{" "}
              <BrandLink href="mailto:dpo@cryptopop.sg">
                dpo@cryptopop.sg
              </BrandLink>
            </p>
          </Section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hero-fade-up mt-10 group">
      <div
        aria-hidden
        className="mb-6 h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,61,190,0.4), rgba(255,122,40,0.3), transparent)",
        }}
      />
      <div
        className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.04] p-7 backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/[0.06] md:p-9"
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-0 transition-opacity duration-700 group-hover:opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,40,0.5), rgba(255,61,190,0.25) 55%, transparent 75%)",
          }}
        />
        <div className="relative">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
            {title}
          </h2>
          <div className="mt-4 space-y-3 leading-relaxed text-white/75">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="font-medium text-white underline decoration-[#ff3dbe]/60 decoration-2 underline-offset-4 transition-all hover:decoration-[#ff7a28] hover:[text-shadow:0_0_18px_rgba(255,61,190,0.55)]"
    >
      {children}
    </a>
  );
}
