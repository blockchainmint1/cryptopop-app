import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — CryptoPOP" },
      {
        name: "description",
        content:
          "How CryptoPOP collects, uses, and protects your personal data under Singapore's PDPA.",
      },
      { property: "og:title", content: "Privacy Policy — CryptoPOP" },
      {
        property: "og:description",
        content: "How CryptoPOP handles your data, written for the PDPA.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const updated = "May 14, 2026";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition">
              Terms
            </Link>
            <Link to="/api" className="hover:text-foreground transition">
              API
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Legal · Singapore · PDPA
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>

        <p className="mt-6 text-muted-foreground">
          This policy explains how CryptoPOP collects, uses, and discloses personal
          data in accordance with Singapore's Personal Data Protection Act 2012
          ("PDPA"). It applies to the CryptoPOP website, wallet, and related
          services.
        </p>

        <Section title="1. What we collect">
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Account data</strong> — your email address and basic profile
              info from your sign-in provider (e.g. Google).
            </li>
            <li>
              <strong>Wallet data</strong> — your TXC wallet address. Private keys
              are stored encrypted; we do not access them in the clear.
            </li>
            <li>
              <strong>Location data</strong> — when you scan an event QR, your
              device's geolocation at that moment, used solely to verify you are
              within the event geofence.
            </li>
            <li>
              <strong>Event activity</strong> — which events you've claimed POP for,
              timestamps, and the resulting on-chain transaction IDs.
            </li>
            <li>
              <strong>Technical data</strong> — IP address, browser/device info, and
              error logs needed to operate and secure the service.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use it">
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>To create and operate your wallet and process POP grants.</li>
            <li>To verify event attendance via geofence and time window.</li>
            <li>To prevent fraud, abuse, and Sybil attacks.</li>
            <li>To respond to support requests and communicate service updates.</li>
            <li>To comply with legal obligations under Singapore law.</li>
          </ul>
        </Section>

        <Section title="3. On-chain data is public">
          <p>
            POP transactions live on the public TXC blockchain. Wallet addresses,
            transaction amounts, timestamps, and any on-chain memos are visible to
            anyone, forever, and cannot be deleted by us. Do not put information
            on-chain that you wouldn't want made public.
          </p>
        </Section>

        <Section title="4. Sharing">
          <p>We share personal data only with:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>
              <strong>Service providers</strong> we rely on to run CryptoPOP
              (authentication, database hosting, error monitoring), bound by
              confidentiality and processing agreements.
            </li>
            <li>
              <strong>Event organisers</strong> — aggregate counts of POP claimed at
              their events. We do not share your email or wallet address with
              organisers unless you explicitly opt in.
            </li>
            <li>
              <strong>Authorities</strong> when required by Singapore law or a valid
              legal process.
            </li>
          </ul>
          <p>We do not sell personal data.</p>
        </Section>

        <Section title="5. International transfers">
          <p>
            Some of our infrastructure providers are located outside Singapore. When
            we transfer personal data overseas, we take reasonable steps to ensure
            recipients provide a standard of protection comparable to the PDPA.
          </p>
        </Section>

        <Section title="6. Retention">
          <p>
            We retain personal data only as long as needed for the purposes above or
            as required by law. Account and event activity are retained while your
            account is active and for a reasonable period after closure for audit
            and fraud prevention. On-chain records cannot be deleted.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            We use industry-standard safeguards including TLS in transit, encryption
            at rest for wallet keys, row-level access controls on our database, and
            least-privilege server credentials. No system is perfectly secure;
            please report suspected vulnerabilities to{" "}
            <a className="underline hover:text-foreground" href="mailto:security@cryptopop.sg">
              security@cryptopop.sg
            </a>
            .
          </p>
        </Section>

        <Section title="8. Your PDPA rights">
          <p>You have the right to:</p>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Withdraw consent for our processing (which may end the service).</li>
            <li>Request deletion of off-chain data, subject to legal exceptions.</li>
          </ul>
          <p>
            To exercise these rights, email our Data Protection Officer at{" "}
            <a className="underline hover:text-foreground" href="mailto:dpo@cryptopop.sg">
              dpo@cryptopop.sg
            </a>
            . If you're unsatisfied with our response, you may contact the Personal
            Data Protection Commission of Singapore.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            We use only the cookies and local storage strictly necessary to keep you
            signed in and to remember your preferences. We do not use third-party
            advertising or cross-site tracking cookies.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            CryptoPOP is not directed to children under 13 and we do not knowingly
            collect their personal data.
          </p>
        </Section>

        <Section title="11. Changes">
          <p>
            We may update this policy. Material changes will be posted here with a
            new "Last updated" date.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Data Protection Officer · CryptoPOP · Singapore ·{" "}
            <a className="underline hover:text-foreground" href="mailto:dpo@cryptopop.sg">
              dpo@cryptopop.sg
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
