import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Docs — CryptoPOP" },
      {
        name: "description",
        content:
          "How to use CryptoPOP — guides for event-goers earning POP and for admins running events.",
      },
    ],
  }),
  component: DocsIndex,
});

function DocsIndex() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <BookOpen className="mr-1.5 inline h-3 w-3" /> Docs
      </p>
      <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">How CryptoPOP works</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        CryptoPOP is a Proof-of-Participation system. People show up to real-world events,
        prove they were there, and earn POP — a tiny on-chain record of attendance on TXC.
        These guides walk through it from both sides.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Link
          to="/docs/users"
          className="group rounded-3xl border border-border bg-card p-6 transition hover:border-primary"
        >
          <Users className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-bold">For event-goers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up, claim POP at events, refer friends, and find your wallet.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-primary group-hover:underline">
            Read user guide →
          </p>
        </Link>

        <Link
          to="/docs/admin"
          className="group rounded-3xl border border-border bg-card p-6 transition hover:border-primary"
        >
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-bold">For admins</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create events, print QR codes, run blasts, and reconcile POP awards.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-primary group-hover:underline">
            Read admin guide →
          </p>
        </Link>
      </div>
    </main>
  );
}
