import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Coins,
  Copy,
  Loader2,
  Wallet,
  Zap,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  getMyActiveOrg,
  createOrgMinterWallet,
  getMinterFundingStatus,
  issueOrgPopToken,
  pollIssuanceConfirmation,
} from "@/lib/mint-token.functions";

export const Route = createFileRoute("/_authenticated/admin/mint-token")({
  head: () => ({ meta: [{ title: "Mint your POP token — CryptoPOP Admin" }] }),
  component: MintTokenWizard,
});

type Step = "name" | "review" | "fund" | "issue" | "done";

function satsToTxc(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

function MintTokenWizard() {
  const navigate = useNavigate();
  const fetchOrg = useServerFn(getMyActiveOrg);
  const createWallet = useServerFn(createOrgMinterWallet);
  const fetchFunding = useServerFn(getMinterFundingStatus);
  const issueToken = useServerFn(issueOrgPopToken);
  const pollIssuance = useServerFn(pollIssuanceConfirmation);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [org, setOrg] = useState<Awaited<ReturnType<typeof getMyActiveOrg>>["org"]>(null);

  const [step, setStep] = useState<Step>("name");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [funding, setFunding] = useState<Awaited<ReturnType<typeof getMinterFundingStatus>> | null>(
    null,
  );

  const [issueTxHash, setIssueTxHash] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [issuing, setIssuing] = useState(false);

  // Load org + reset wizard to the right step on mount
  useEffect(() => {
    let cancelled = false;
    fetchOrg()
      .then((res) => {
        if (cancelled) return;
        setOrg(res.org);
        if (res.org?.mintComplete) {
          setStep("done");
          setPropertyId(res.org.txc_property_id);
          setTokenName(res.org.pop_token_name ?? "");
          setTokenSymbol(res.org.pop_token_symbol ?? "");
          setWalletAddress(res.org.minter_wallet_address);
        } else if (res.org?.hasMinterWallet) {
          setWalletAddress(res.org.minter_wallet_address);
          setTokenName(res.org.pop_token_name ?? "");
          setTokenSymbol(res.org.pop_token_symbol ?? "");
          setStep("fund");
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load your community"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchOrg]);

  // Funding poll
  useEffect(() => {
    if (step !== "fund" || !org) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const f = await fetchFunding({ data: { orgId: org.id } });
        if (cancelled) return;
        setFunding(f);
        if (f.address && !walletAddress) setWalletAddress(f.address);
      } catch (e) {
        if (!cancelled) console.error(e);
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, org, fetchFunding, walletAddress]);

  // Issuance confirmation poll
  useEffect(() => {
    if (step !== "issue" || !org || !issueTxHash) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await pollIssuance({ data: { orgId: org.id, txHash: issueTxHash } });
        if (cancelled) return;
        if (res.confirmed && res.propertyId) {
          setPropertyId(res.propertyId);
          setStep("done");
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, org, issueTxHash, pollIssuance]);

  const handleStartWallet = useCallback(async () => {
    if (!org) return;
    setErr(null);
    setLoading(true);
    try {
      const { address } = await createWallet({ data: { orgId: org.id } });
      setWalletAddress(address);
      setStep("fund");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create minter wallet");
    } finally {
      setLoading(false);
    }
  }, [org, createWallet]);

  const handleIssue = useCallback(async () => {
    if (!org) return;
    setErr(null);
    setIssuing(true);
    try {
      const res = await issueToken({
        data: { orgId: org.id, tokenName: tokenName.trim(), tokenSymbol: tokenSymbol.trim() },
      });
      if (res.alreadyIssued && res.propertyId) {
        setPropertyId(res.propertyId);
        setStep("done");
      } else if (res.txHash) {
        setIssueTxHash(res.txHash);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Issuance failed");
    } finally {
      setIssuing(false);
    }
  }, [org, tokenName, tokenSymbol, issueToken]);

  const copy = (text: string) => navigator.clipboard.writeText(text);

  const symbolValid = useMemo(
    () => /^[A-Z0-9]{2,8}$/.test(tokenSymbol.trim()),
    [tokenSymbol],
  );
  const nameValid = tokenName.trim().length >= 2 && tokenName.trim().length <= 40;
  const canProceedFromName = nameValid && symbolValid;

  if (loading && !org) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            You don't manage any communities yet.{" "}
            <Link to="/admin" className="underline">
              Back to admin
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: "name", label: "Name" },
    { id: "review", label: "Review" },
    { id: "fund", label: "Fund" },
    { id: "issue", label: "Issue" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);
  const progress = step === "done" ? 100 : ((stepIndex + 1) / (steps.length + 1)) * 100;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
          {org.name}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight mt-1">
          Mint your POP token
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          POP is your community's on-chain reward token. Once issued on TEXITcoin, it's permanent
          and you can mint it to attendees as proof-of-presence at every event.
        </p>
      </header>

      <div className="space-y-2">
        <Progress value={progress} />
        <div className="flex justify-between text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={i <= stepIndex || step === "done" ? "text-primary" : ""}
            >
              {i + 1}. {s.label}
            </span>
          ))}
          <span className={step === "done" ? "text-primary" : ""}>5. Done</span>
        </div>
      </div>

      {err && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{err}</span>
        </Card>
      )}

      {step === "name" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Name your token</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              placeholder={`${org.name} POP`}
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground">
              Shown on block explorers and in wallets. 2–40 characters.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-symbol">Symbol</Label>
            <Input
              id="token-symbol"
              placeholder="POP"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              maxLength={8}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Short ticker (e.g. LAKE, BBQ). Uppercase letters + numbers, 2–8 chars.
            </p>
          </div>
          <div className="flex justify-end">
            <Button disabled={!canProceedFromName} onClick={() => setStep("review")}>
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {step === "review" && (
        <Card className="p-6 space-y-5">
          <h2 className="font-display text-xl font-semibold">Review</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <dt className="text-muted-foreground">Token name</dt>
            <dd className="font-medium">{tokenName}</dd>
            <dt className="text-muted-foreground">Symbol</dt>
            <dd className="font-mono">{tokenSymbol}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>Managed · indivisible · TEXITcoin mainnet</dd>
            <dt className="text-muted-foreground">Supply</dt>
            <dd>You mint on demand — no fixed cap upfront</dd>
          </dl>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            Issuing the token broadcasts a real transaction on TEXITcoin. It's permanent and can't
            be renamed. The next step generates a dedicated minter wallet for your community.
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("name")}>
              Back
            </Button>
            <Button onClick={handleStartWallet} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create minter wallet <Wallet className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {step === "fund" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Fund your minter wallet</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Send at least{" "}
            <strong className="text-foreground font-mono">
              {satsToTxc(funding?.requiredSats ?? 20000)} TXC
            </strong>{" "}
            to this address. We'll detect the deposit and auto-advance. This pays the on-chain fee
            for issuance plus a buffer for your first batch of mints.
          </p>
          {walletAddress ? (
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-sm break-all">{walletAddress}</code>
                <Button size="sm" variant="ghost" onClick={() => copy(walletAddress)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <a
                href={`https://mempool.texitcoin.org/address/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                View on mempool explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                Confirmed
              </p>
              <p className="font-mono text-lg mt-1 tabular-nums">
                {satsToTxc(funding?.confirmedSats ?? 0)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                Pending
              </p>
              <p className="font-mono text-lg mt-1 tabular-nums">
                {satsToTxc(funding?.unconfirmedSats ?? 0)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                Needed
              </p>
              <p className="font-mono text-lg mt-1 tabular-nums">
                {satsToTxc(funding?.requiredSats ?? 20000)}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {funding?.ready
                ? "Funded ✓ — ready to issue"
                : "Waiting for confirmed deposit…"}
            </p>
            <Button disabled={!funding?.ready} onClick={() => setStep("issue")}>
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {step === "issue" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Issue {tokenSymbol}</h2>
          </div>
          {!issueTxHash ? (
            <>
              <p className="text-sm text-muted-foreground">
                One-click broadcast. Signs from your minter wallet and creates the Omni property on
                TEXITcoin. Wait ~1 block (~1 min) for confirmation.
              </p>
              <div className="flex justify-end">
                <Button onClick={handleIssue} disabled={issuing}>
                  {issuing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Issue token now <Zap className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">Broadcast! Waiting for confirmation…</p>
              <a
                href={`https://mempool.texitcoin.org/tx/${issueTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary break-all"
              >
                {issueTxHash} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Polling every 8s…
              </div>
            </div>
          )}
        </Card>
      )}

      {step === "done" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">
              {tokenName} ({tokenSymbol}) is live
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <dt className="text-muted-foreground">Property ID</dt>
            <dd className="font-mono">#{propertyId ?? org.txc_property_id ?? "—"}</dd>
            <dt className="text-muted-foreground">Minter wallet</dt>
            <dd className="font-mono text-xs break-all">{walletAddress}</dd>
          </dl>
          <div className="flex gap-2">
            <Button onClick={() => navigate({ to: "/admin" })}>Back to admin</Button>
            <Button asChild variant="outline">
              <Link to="/admin/events">Create your first event</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
