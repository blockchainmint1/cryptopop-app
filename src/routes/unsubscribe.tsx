import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";

const searchSchema = z.object({ token: z.string().optional() }).partial();

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Unsubscribe — CryptoPOP" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

type Status =
  | "loading"
  | "ready"
  | "already"
  | "invalid"
  | "submitting"
  | "done"
  | "error";

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setStatus("invalid");
          return;
        }
        if (body.valid === false && body.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (body.valid) {
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg("Couldn't process — try again.");
        setStatus("error");
        return;
      }
      if (body.success === false && body.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("done");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-border bg-card p-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Email preferences
          </p>

          {status === "loading" && (
            <h1 className="mt-3 font-display text-3xl">Checking your link…</h1>
          )}

          {status === "ready" && (
            <>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Unsubscribe from CryptoPOP emails?
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                You'll stop receiving event confirmations and updates. You can
                always sign up again from cryptopop.asia.
              </p>
              <button
                onClick={handleConfirm}
                className="mt-6 w-full rounded-full bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Confirm unsubscribe
              </button>
            </>
          )}

          {status === "submitting" && (
            <h1 className="mt-3 font-display text-3xl">Processing…</h1>
          )}

          {status === "done" && (
            <>
              <h1 className="mt-3 font-display text-3xl font-bold">
                You're unsubscribed.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We won't email you anymore. Changed your mind? Just sign up to
                another event.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Already unsubscribed
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                This email is already off our list.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Invalid link
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                This unsubscribe link isn't valid or has expired.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Something went wrong
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {errorMsg ?? "Please try again in a moment."}
              </p>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
