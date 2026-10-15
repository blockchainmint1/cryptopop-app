/**
 * Ecosystem links — one place to link this wallet with any ecosystem site
 * (Nectar Pay, Bonfire, TSD Swap, …). A single paste/scan box detects which
 * kind of link code it is and hands it to the matching flow. Look-only links
 * share watch-only keys; every flow asks for approval and the seed phrase
 * never leaves this device.
 */
import { useEffect, useState } from "react";
import { Link2, Loader2, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { QrScanDialog } from "@/components/wallet/qr-scan-dialog";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  consentMode,
  deriveWalletKeys,
  fetchAnyManifest,
  NECTAR_TRUSTED_HOST,
  listLinks,
  parseLinkInput,
  removeLink,
  saveLink,
  submitLink,
  type ConsentMode,
  type NectarLinkRecord,
  type NectarManifest,
} from "@/lib/ecosystem/link";
import { isEcosystemSite, loginSiteName } from "@/lib/ecosystem/hosts";
import { useEcosystemSites } from "@/lib/ecosystem/sites";
import { submitRequested, type RequestedManifest } from "@/lib/ecosystem/requested";

type Target = { kind: "bundle"; manifest: NectarManifest } | RequestedManifest;

export function EcosystemLinksCard({ initialPayload }: { initialPayload?: string }) {
  useEcosystemSites();
  const { mnemonic, address } = useWallet();
  const seedless = !mnemonic || !address;

  const [input, setInput] = useState(initialPayload ?? "");
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manifest, setManifest] = useState<NectarManifest | null>(null);
  const [requested, setRequested] = useState<RequestedManifest | null>(null);
  const [ackHost, setAckHost] = useState(false);
  const [mode, setMode] = useState<ConsentMode>("silent");
  const [ackNewWallet, setAckNewWallet] = useState(false);
  const [links, setLinks] = useState<NectarLinkRecord[]>([]);

  useEffect(() => {
    if (address) setLinks(listLinks(address));
  }, [address, mnemonic]);

  // A link QR scanned from the main camera arrives here pre-filled.
  const [handledInitial, setHandledInitial] = useState(false);
  useEffect(() => {
    if (handledInitial || !initialPayload || !mnemonic) return;
    setHandledInitial(true);
    setInput(initialPayload);
    void onLoad(initialPayload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPayload, mnemonic, handledInitial]);

  async function onLoad(raw: string) {
    setError(null);
    setNotice(null);
    setManifest(null);
    setRequested(null);
    setAckHost(false);
    setAckNewWallet(false);
    const url = parseLinkInput(raw);
    if (!url) {
      setError("That isn't a wallet link.");
      return;
    }
    if (!mnemonic) return;
    setBusy(true);
    try {
      const any = await fetchAnyManifest(url);
      if (any.kind === "requested") {
        setRequested(any);
        return;
      }
      const m = any;
      const keys = await deriveWalletKeys(mnemonic);
      setMode(consentMode(m, keys.identityAddress));
      setManifest(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that link.");
    } finally {
      setBusy(false);
    }
  }

  async function onApproveRequested() {
    if (!requested || !mnemonic || !address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitRequested({ manifest: requested, mnemonic });
      saveLink(address, {
        merchantId: `${requested.host}:${requested.keys[0]!.path}`,
        merchantName: `${res.appName} (${requested.host})`,
        url: requested.manifestUrl,
        linkedAt: new Date().toISOString(),
      });
      setLinks(listLinks(address));
      setRequested(null);
      setInput("");
      setNotice(`Linked to ${res.appName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    if (!manifest || !mnemonic || !address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitLink({ manifest, mnemonic });
      const record: NectarLinkRecord = {
        merchantId: res.store_id ?? manifest.store_id ?? manifest.challenge_id,
        merchantName: res.merchant_name ?? manifest.merchant_name ?? "Linked site",
        url: manifest.manifest_url,
        linkedAt: new Date().toISOString(),
      };
      saveLink(address, record);
      setLinks(listLinks(address));
      setManifest(null);
      setInput("");
      setNotice(`Linked to ${record.merchantName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <Link2 className="h-4 w-4" /> Ecosystem links
      </p>
      <p className="text-xs text-muted-foreground">
        Link this wallet with Nectar Pay, Bonfire, TSD Swap or any site that shows a wallet link
        code. Sites get watch-only keys — they can see addresses but never spend. You approve every
        link, and your recovery phrase never leaves this device.
      </p>

      {seedless ? (
        <p className="text-xs text-muted-foreground">Unlock your wallet to link it.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste link URL"
              className="h-11 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Scan link QR"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 rounded-full"
              disabled={busy || !input.trim()}
              onClick={() => void onLoad(input)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Read"}
            </Button>
          </div>

          {requested && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="font-display text-sm font-semibold uppercase">{requested.appName}</div>
              <div className="break-all font-mono text-[10px] text-muted-foreground">{requested.host}</div>
              {isEcosystemSite(requested.host) ? (
                <p className="text-xs text-primary">
                  Verified honest.money ecosystem site ({loginSiteName(requested.host)}).
                </p>
              ) : (
                <p className="text-xs text-destructive">
                  Not a listed honest.money ecosystem site. Only continue if you started this yourself.
                </p>
              )}
              {requested.purpose && (
                <p className="text-xs text-muted-foreground">{requested.purpose}</p>
              )}
              <div className="text-xs">
                Requesting one watch-only key:{" "}
                <span className="font-mono">
                  {requested.keys[0]!.chain} {requested.keys[0]!.path}
                </span>
              </div>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={ackHost} onCheckedChange={(v) => setAckHost(v === true)} />
                <span>
                  I trust <b>{requested.host}</b> to see the addresses on this branch. It can't
                  spend anything.
                </span>
              </label>
              <div className="flex gap-2">
                <Button size="sm" className="rounded-full" disabled={busy || !ackHost} onClick={() => void onApproveRequested()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share key"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRequested(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {manifest && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="font-display text-sm font-semibold uppercase">
                {manifest.merchant_name ?? "Linked site"}
              </div>
              {manifest.from !== NECTAR_TRUSTED_HOST && (
                <div className="break-all text-xs text-destructive">
                  Not Nectar Pay: {manifest.from}. Only continue if you trust this site.
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Requesting: {manifest.chains.join(", ")}
              </div>
              {mode === "blocked" ? (
                <p className="text-xs text-destructive">
                  Another wallet is already on file for this site. Ask them to re-issue the link
                  with new wallets allowed.
                </p>
              ) : (
                <>
                  {mode === "confirm-new-wallet" && (
                    <label className="flex items-start gap-2 text-xs">
                      <Checkbox
                        checked={ackNewWallet}
                        onCheckedChange={(v) => setAckNewWallet(v === true)}
                      />
                      <span>This site has a different wallet on file. Link this wallet instead.</span>
                    </label>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={busy || (mode === "confirm-new-wallet" && !ackNewWallet)}
                      onClick={() => void onApprove()}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share keys"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setManifest(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {notice && <p className="text-xs text-muted-foreground">{notice}</p>}

          {links.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Linked sites
              </div>
              {links.map((l) => (
                <div key={l.merchantId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {l.merchantName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {new Date(l.linkedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Forget ${l.merchantName}`}
                    onClick={() => {
                      if (address) {
                        removeLink(address, l.merchantId);
                        setLinks(listLinks(address));
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <QrScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Scan link QR"
        description="Point at the wallet link code shown by the site."
        onResult={(text) => {
          setScanOpen(false);
          setInput(text);
          void onLoad(text);
        }}
      />
    </Card>
  );
}
