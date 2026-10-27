import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/lib/wallet/wallet-context";
import { UnlockScreen } from "@/components/wallet/unlock-screen";
import { getAddressChainSummary } from "@/lib/chain-public.functions";
import { prepareSend, broadcastSignedTx } from "@/lib/send.functions";
import { signPsbt } from "@/lib/wallet/sign";
import { nfcLinkCard, nfcListCards, nfcUpdateCard, nfcKillCard } from "@/lib/nfc-cards.functions";
import { normalizeUid, pocketAddress, pocketKeyHex, ownerEnvelope, signPocketSend, nfcPocketPath } from "@/lib/wallet/nfc-cards";
import { nfcReadAvailable, readCardId } from "@/lib/native/nfc";

export const Route = createFileRoute("/nfc")({
  head: () => ({
    meta: [
      { title: "NFC Cards (test) — CryptoPOP" },
      { name: "description", content: "Link tap-to-pay NFC cards to TSD pockets in your CryptoPOP wallet." },
      { property: "og:title", content: "NFC Cards — CryptoPOP" },
      { property: "og:description", content: "Link tap-to-pay NFC cards to TSD pockets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NfcPage,
});

type ListRes = Awaited<ReturnType<typeof nfcListCards>>;
type CardRow = ListRes["cards"][number];
type Bal = { tsd: number | null; txc: number | null };

function NfcPage() {
  const { status, mnemonic, address } = useWallet();
  const fetchSummary = useServerFn(getAddressChainSummary);
  const list = useServerFn(nfcListCards);
  const linkFn = useServerFn(nfcLinkCard);
  const updateFn = useServerFn(nfcUpdateCard);
  const killFn = useServerFn(nfcKillCard);
  const prep = useServerFn(prepareSend);
  const bcast = useServerFn(broadcastSignedTx);

  const [data, setData] = useState<ListRes | null>(null);
  const [bals, setBals] = useState<Record<number, Bal>>({});
  const [uid, setUid] = useState("");
  const [label, setLabel] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [nfcOk, setNfcOk] = useState(false);
  const [fundIdx, setFundIdx] = useState<number | null>(null);
  const [fundTsd, setFundTsd] = useState("100");
  const [fundTxc, setFundTxc] = useState("1");
  const [funding, setFunding] = useState(false);

  useEffect(() => setNfcOk(nfcReadAvailable()), []);

  const refresh = useCallback(async () => {
    if (!mnemonic) return;
    try {
      const res = await list({ data: ownerEnvelope(mnemonic, "list", {}) });
      setData(res);
      const out: Record<number, Bal> = {};
      await Promise.all(res.cards.map(async (c) => {
        try {
          const s = await fetchSummary({ data: { address: c.address } });
          out[c.index] = { tsd: s.tsd, txc: s.txc };
        } catch {
          out[c.index] = { tsd: null, txc: null };
        }
      }));
      setBals(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load cards");
    }
  }, [mnemonic, list, fetchSummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function scan() {
    setScanning(true);
    try {
      setUid(await readCardId());
      toast.success("Card read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "NFC not available");
    } finally {
      setScanning(false);
    }
  }

  async function link() {
    if (!mnemonic || !address || !data) return;
    const id = normalizeUid(uid);
    if (id.length < 4) return toast.error("Card ID looks too short");
    if (!/^\d{4,8}$/.test(pin)) return toast.error("PIN must be 4–8 digits");
    const index = data.usedIndices.reduce((m, i) => Math.max(m, i + 1), 0);
    setBusy(true);
    try {
      await linkFn({
        data: ownerEnvelope(mnemonic, "link", {
          uid: id, label: label.trim() || `Card ${data.cards.length + 1}`, pin,
          perTapUsd: 100, dailyUsd: 500, pocketIndex: index,
          pocketAddress: pocketAddress(mnemonic, index), pocketKeyHex: pocketKeyHex(mnemonic, index),
          returnAddress: address,
        }),
      });
      setUid(""); setLabel(""); setPin("");
      toast.success("Card linked");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't link card");
    } finally {
      setBusy(false);
    }
  }

  async function update(c: CardRow, patch: Record<string, unknown>, ok?: string) {
    if (!mnemonic) return;
    try {
      await updateFn({ data: ownerEnvelope(mnemonic, "update", { id: c.id, ...patch }) });
      if (ok) toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function updateWallet(patch: Record<string, unknown>, ok?: string) {
    if (!mnemonic) return;
    try {
      await updateFn({ data: ownerEnvelope(mnemonic, "update", patch) });
      if (ok) toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function loadCard(c: CardRow) {
    if (!mnemonic || !address) return;
    const tsd = Number(fundTsd), txc = Number(fundTxc);
    if (!(tsd >= 0 && txc >= 0) || (!tsd && !txc)) return toast.error("Enter an amount");
    if (!window.confirm(`Send ${tsd ? `${tsd} TSD` : ""}${tsd && txc ? " and " : ""}${txc ? `${txc} TXC` : ""} from your wallet to “${c.label}”?`)) return;
    setFunding(true);
    try {
      if (tsd > 0 && txc > 0) {
        // One transaction carries both the TSD and the TXC — a second send
        // right after the first would collide with it in the mempool.
        const intent = { asset: "tsd" as const, from: address, to: c.address, amount: tsd, txcAmount: txc };
        const built = await prep({ data: intent });
        const raw = signPsbt(built.psbtBase64, mnemonic, intent);
        const r = await bcast({ data: { rawHex: raw } });
        if (!r.ok) throw new Error(r.error);
        toast.success(`${tsd} TSD and ${txc} TXC sent to ${c.label}`);
      } else {
        for (const [asset, amount] of [["tsd", tsd], ["txc", txc]] as const) {
          if (!amount) continue;
          const intent = { asset, from: address, to: c.address, amount };
          const built = await prep({ data: intent });
          const raw = signPsbt(built.psbtBase64, mnemonic, intent);
          const r = await bcast({ data: { rawHex: raw } });
          if (!r.ok) throw new Error(`${asset.toUpperCase()}: ${r.error}`);
          toast.success(`${amount} ${asset.toUpperCase()} sent to ${c.label}`);
        }
      }
      setFundIdx(null);
      setTimeout(() => void refresh(), 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load card");
    } finally {
      setFunding(false);
    }
  }

  async function withdraw(c: CardRow) {
    if (!mnemonic || !address) return;
    const b = bals[c.index];
    if (!b?.tsd) return toast("No TSD in this pocket");
    try {
      const intent = { asset: "tsd" as const, to: address, amount: b.tsd };
      const built = await prep({ data: { ...intent, from: c.address } });
      const raw = signPocketSend(built.psbtBase64, mnemonic, c.index, intent);
      const r = await bcast({ data: { rawHex: raw } });
      if (!r.ok) throw new Error(r.error);
      toast.success("TSD moved back to your wallet");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't move funds");
    }
  }

  async function kill(c: CardRow) {
    if (!mnemonic) return;
    if (!confirm(`Shut down "${c.label}" as lost? Taps stop immediately and it can never be turned back on.`)) return;
    try {
      await killFn({ data: ownerEnvelope(mnemonic, "kill", { id: c.id }) });
      toast("Card shut down. Its funds are still yours — use Move back if any remain.");
      await withdraw(c);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't shut down card");
    }
  }

  if (status === "loading") return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (status === "locked") return <UnlockScreen />;
  if (status === "none" || !mnemonic)
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Set up your wallet first.</p>
        <Link to="/" className="underline">Go to wallet</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-28">
      <div>
        <p className="font-mono text-xs uppercase text-muted-foreground">Test area</p>
        <h1 className="font-display text-4xl">NFC Cards</h1>
        <p className="text-sm text-muted-foreground">
          Each card has its own TSD pocket. Taps need the card's PIN; over $100 a tap or $500 a day needs your Telegram OK.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-display text-2xl">Link a card</h2>
        {nfcOk ? (
          <Button onClick={scan} disabled={scanning} className="w-full">
            {scanning ? "Hold the card to the back of your phone…" : "Tap a card to read it"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Card reading works in the POP Wallet app and in Chrome on Android. Here, type the card ID instead.
          </p>
        )}
        <Input placeholder="Card ID" value={uid} onChange={(e) => setUid(e.target.value)} />
        <Input placeholder="Name (e.g. Blue card)" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="Card PIN (4–8 digits)" inputMode="numeric" type="password" autoComplete="off" maxLength={8}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <Button variant="secondary" onClick={link} className="w-full" disabled={!uid || busy || !data}>
          {busy ? "Linking…" : "Link card"}
        </Button>
      </Card>

      {data && (
        <Card className="space-y-2 p-4">
          <h2 className="font-display text-2xl">Telegram alerts</h2>
          <p className="text-xs text-muted-foreground">
            One Telegram account for your whole wallet. Every card's taps and approval requests
            (like "Jimmy wants to pay $48 at the football game") go to that chat.
          </p>
          {data.telegramLinked ? (
            <div className="flex items-center justify-between text-xs">
              <span>Telegram alerts on for all your cards</span>
              <Button size="sm" variant="ghost" onClick={() => updateWallet({ clearTelegram: true }, "Telegram unlinked")}>Unlink</Button>
            </div>
          ) : data.telegramCode ? (
            <div className="space-y-1 text-xs">
              <p>Open Telegram and send this to the bot:</p>
              {data.botName ? (
                <a className="font-mono underline" href={`https://t.me/${data.botName}?start=${data.telegramCode}`} target="_blank" rel="noreferrer">
                  Open @{data.botName} (code {data.telegramCode})
                </a>
              ) : (
                <p className="font-mono">/start {data.telegramCode}</p>
              )}
              <Button size="sm" variant="ghost" onClick={refresh}>I've done it</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => updateWallet({ newTelegramCode: true })}>Connect Telegram alerts</Button>
          )}
        </Card>
      )}

      {data && data.cards.length === 0 && <p className="text-center text-sm text-muted-foreground">No cards yet.</p>}

      {data?.cards.map((c) => {
        const b = bals[c.index];
        return (
          <Card key={c.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-2xl">{c.label}</p>
                <p className="font-mono text-xs text-muted-foreground">…{c.uidHint} · pocket {c.index}</p>
                {c.locked && <p className="text-xs text-destructive">Locked after wrong PINs</p>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {c.enabled ? "On" : "Off"}
                <Switch checked={c.enabled} onCheckedChange={(v) => update(c, { enabled: v })} />
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="font-display text-3xl">{b?.tsd == null ? "—" : b.tsd.toFixed(2)}</p>
                <p className="font-mono text-xs text-muted-foreground">TSD</p>
              </div>
              <div>
                <p className="font-display text-3xl">{b?.txc == null ? "—" : b.txc.toFixed(4)}</p>
                <p className="font-mono text-xs text-muted-foreground">TXC for fees</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Limits: ${c.perTapUsd} a tap · ${c.dailyUsd} a day without approval</p>

            {fundIdx === c.index && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-center">
                <p className="font-mono text-xs uppercase text-muted-foreground">Load from my wallet</p>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <label className="text-xs">TSD<Input inputMode="decimal" value={fundTsd} onChange={(e) => setFundTsd(e.target.value)} /></label>
                  <label className="text-xs">TXC (fees)<Input inputMode="decimal" value={fundTxc} onChange={(e) => setFundTxc(e.target.value)} /></label>
                </div>
                <Button size="sm" className="w-full" disabled={funding} onClick={() => loadCard(c)}>
                  {funding ? "Sending…" : "Send to this card"}
                </Button>
                <p className="pt-2 text-xs text-muted-foreground">Or send from another wallet:</p>
                <div className="mx-auto w-fit rounded bg-foreground p-2">
                  <QRCodeSVG value={c.address} size={140} />
                </div>
                <p className="break-all font-mono text-xs">{c.address}</p>
                <p className="text-xs text-muted-foreground">Send TSD plus a little TXC (for fees). {nfcPocketPath(c.index)}</p>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(c.address).then(() => toast.success("Copied"))}>
                  Copy address
                </Button>
              </div>
            )}

            {c.locked && <Button size="sm" variant="outline" onClick={() => update(c, { unlock: true }, "Card unlocked")}>Unlock card</Button>}

            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setFundIdx(fundIdx === c.index ? null : c.index)}>Fund</Button>
              <Button size="sm" variant="outline" onClick={() => withdraw(c)}>Move back</Button>
              <Button size="sm" variant="destructive" onClick={() => kill(c)}>Lost</Button>
            </div>

            {c.payments.length > 0 && (
              <div className="space-y-1 border-t border-border pt-2">
                {c.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span>{p.merchant ?? "NectarPay"} · {new Date(p.at).toLocaleString()}</span>
                    <span className="font-mono">${p.usd.toFixed(2)} {p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
