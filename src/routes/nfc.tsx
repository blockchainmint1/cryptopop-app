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
import {
  type NfcCard,
  loadCards,
  saveCards,
  nextIndex,
  normalizeUid,
  pocketAddress,
  nfcPocketPath,
} from "@/lib/wallet/nfc-cards";
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

type Bal = { tsd: number | null; txc: number | null };

function NfcPage() {
  const { status, mnemonic } = useWallet();
  const fetchSummary = useServerFn(getAddressChainSummary);
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [bals, setBals] = useState<Record<number, Bal>>({});
  const [uid, setUid] = useState("");
  const [label, setLabel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [nfcOk, setNfcOk] = useState(false);
  const [fundIdx, setFundIdx] = useState<number | null>(null);

  useEffect(() => {
    setCards(loadCards());
    setNfcOk(nfcReadAvailable());
  }, []);

  const update = (next: NfcCard[]) => {
    setCards(next);
    saveCards(next);
  };

  const refresh = useCallback(async () => {
    if (!mnemonic) return;
    const out: Record<number, Bal> = {};
    await Promise.all(
      cards.map(async (c) => {
        try {
          const s = await fetchSummary({ data: { address: pocketAddress(mnemonic, c.index) } });
          out[c.index] = { tsd: s.tsd, txc: s.txc };
        } catch {
          out[c.index] = { tsd: null, txc: null };
        }
      }),
    );
    setBals(out);
  }, [cards, mnemonic, fetchSummary]);

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

  function link() {
    const id = normalizeUid(uid);
    if (id.length < 4) return toast.error("Card ID looks too short");
    if (cards.some((c) => c.uid === id && !c.lost)) return toast.error("That card is already linked");
    const card: NfcCard = {
      index: nextIndex(cards),
      uid: id,
      label: label.trim() || `Card ${cards.length + 1}`,
      enabled: true,
      lost: false,
      createdAt: Date.now(),
    };
    update([...cards, card]);
    setUid("");
    setLabel("");
    toast.success("Card linked to a new pocket");
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

  const active = cards.filter((c) => !c.lost);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-28">
      <div>
        <p className="font-mono text-xs uppercase text-muted-foreground">Test area</p>
        <h1 className="font-display text-4xl">NFC Cards</h1>
        <p className="text-sm text-muted-foreground">
          Each card gets its own TSD pocket. Your main balance is never touched.
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
            Card reading works in the POP Wallet app and in Chrome on Android. On this device, type the card ID instead.
          </p>
        )}
        <Input placeholder="Card ID" value={uid} onChange={(e) => setUid(e.target.value)} />
        <Input placeholder="Name (e.g. Blue card)" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button variant="secondary" onClick={link} className="w-full" disabled={!uid}>
          Link card
        </Button>
      </Card>

      {active.length === 0 && <p className="text-center text-sm text-muted-foreground">No cards yet.</p>}

      {active.map((c) => {
        const addr = pocketAddress(mnemonic, c.index);
        const b = bals[c.index];
        return (
          <Card key={c.index} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-2xl">{c.label}</p>
                <p className="font-mono text-xs text-muted-foreground">ID {c.uid} · pocket {c.index}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {c.enabled ? "On" : "Off"}
                <Switch
                  checked={c.enabled}
                  onCheckedChange={(v) => update(cards.map((x) => (x.index === c.index ? { ...x, enabled: v } : x)))}
                />
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
            {fundIdx === c.index && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-center">
                <div className="mx-auto w-fit rounded bg-foreground p-2">
                  <QRCodeSVG value={addr} size={140} />
                </div>
                <p className="break-all font-mono text-xs">{addr}</p>
                <p className="text-xs text-muted-foreground">Send TSD plus a little TXC (for fees) here. {nfcPocketPath(c.index)}</p>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(addr).then(() => toast.success("Copied"))}>
                  Copy address
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setFundIdx(fundIdx === c.index ? null : c.index)}>
                Fund
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  if (!confirm(`Shut down "${c.label}" as lost? It can never be turned back on.`)) return;
                  update(cards.map((x) => (x.index === c.index ? { ...x, lost: true, enabled: false } : x)));
                  toast("Card shut down. Move its remaining funds back to your wallet.");
                }}
              >
                Lost — shut down
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
