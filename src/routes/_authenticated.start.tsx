import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Rocket, Check, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkSlugAvailability, createCommunity } from "@/lib/create-org.functions";
import { getMyActiveOrg } from "@/lib/mint-token.functions";

export const Route = createFileRoute("/_authenticated/start")({
  head: () => ({ meta: [{ title: "Create your community — CryptoPOP" }] }),
  component: StartCommunityWizard,
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type SlugState = "idle" | "checking" | "ok" | "taken" | "invalid";

function StartCommunityWizard() {
  const navigate = useNavigate();
  const fetchOrg = useServerFn(getMyActiveOrg);
  const checkSlug = useServerFn(checkSlugAvailability);
  const create = useServerFn(createCommunity);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [tagline, setTagline] = useState("");
  const [accent, setAccent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // If user already owns/manages an org, send them to /admin instead.
  useEffect(() => {
    fetchOrg()
      .then((r) => {
        if (r.org) {
          navigate({ to: "/admin", replace: true });
        } else {
          setBootstrapping(false);
        }
      })
      .catch(() => setBootstrapping(false));
  }, [fetchOrg, navigate]);

  // Auto-derive slug from name until the user edits it manually.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Debounced slug availability check.
  const candidateSlug = useMemo(() => slugify(slug), [slug]);
  useEffect(() => {
    if (!candidateSlug || candidateSlug.length < 2) {
      setSlugState("idle");
      return;
    }
    setSlugState("checking");
    const t = setTimeout(() => {
      checkSlug({ data: { slug: candidateSlug } })
        .then((r) => {
          if (r.reason === "ok") setSlugState("ok");
          else if (r.reason === "taken") setSlugState("taken");
          else setSlugState("invalid");
        })
        .catch(() => setSlugState("idle"));
    }, 350);
    return () => clearTimeout(t);
  }, [candidateSlug, checkSlug]);

  const canStep1 = name.trim().length >= 2 && slugState === "ok";
  const accentValid = accent === "" || /^#[0-9a-fA-F]{6}$/.test(accent);

  async function handleCreate() {
    setErr(null);
    setSubmitting(true);
    try {
      const res = await create({
        data: {
          name: name.trim(),
          slug: candidateSlug,
          tagline: tagline.trim() || null,
          accentColor: accent.trim() || null,
        },
      });
      if (res.ok) {
        navigate({ to: "/admin", replace: true });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Step {step} of 3
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            Create your community
          </h1>
          <p className="text-sm text-muted-foreground">
            Spin up your own POP-powered community. You'll mint your token next.
          </p>
        </header>

        {err && (
          <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{err}</span>
          </Card>
        )}

        <Card className="p-6 space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Community name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lakehouse Crew"
                  maxLength={60}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-mono">cryptopop.org/o/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    placeholder="lakehouse-crew"
                    className="font-mono"
                    maxLength={40}
                  />
                </div>
                <div className="text-xs h-4">
                  {slugState === "checking" && (
                    <span className="text-muted-foreground">Checking…</span>
                  )}
                  {slugState === "ok" && (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Available
                    </span>
                  )}
                  {slugState === "taken" && (
                    <span className="text-destructive">Already taken — try another</span>
                  )}
                  {slugState === "invalid" && (
                    <span className="text-destructive">
                      Lowercase letters, numbers, and dashes only
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button disabled={!canStep1} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline (optional)</Label>
                <Textarea
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="One line about what brings your people together."
                  maxLength={140}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">{tagline.length}/140</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent">Accent color (optional)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="accent"
                    type="text"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    placeholder="#FF3DBE"
                    maxLength={7}
                    className="font-mono w-32"
                  />
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#FF3DBE"}
                    onChange={(e) => setAccent(e.target.value.toUpperCase())}
                    className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
                    aria-label="Pick accent color"
                  />
                </div>
                {!accentValid && (
                  <p className="text-xs text-destructive">Use a #RRGGBB hex color or leave blank</p>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={!accentValid} onClick={() => setStep(3)}>
                  Review
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{name}</span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">URL</span>
                  <span className="font-mono text-xs">cryptopop.org/o/{candidateSlug}</span>
                </div>
                {tagline && (
                  <div className="flex justify-between border-b border-border/40 pb-2 gap-4">
                    <span className="text-muted-foreground shrink-0">Tagline</span>
                    <span className="text-right">{tagline}</span>
                  </div>
                )}
                {accent && (
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <span className="text-muted-foreground">Accent</span>
                    <span className="flex items-center gap-2 font-mono text-xs">
                      <span
                        className="inline-block h-4 w-4 rounded border border-border"
                        style={{ background: accent }}
                      />
                      {accent.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                After creating, you'll mint your community's POP token — that unlocks events,
                rewards, and the rest of the admin dashboard.
              </p>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Create community"
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
