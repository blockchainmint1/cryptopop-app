import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const TSD_BRIDGE_URL = "https://tsd.honest.money";

/**
 * Onramp through the TSD bridge: USDC or PYUSD (and other supported stables)
 * from an exchange become TSD in this wallet. We copy the address and walk the
 * member through the bridge; the bridge does the work.
 */
export function BridgeTopUpSheet({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string | null;
}) {
  async function go() {
    if (!address) {
      toast.error("Open your wallet first so we can copy your TSD address.");
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
    } catch {
      /* fall through */
    }
    toast.success(
      copied
        ? "Your TSD address is copied. Paste it on the bridge."
        : "Copy your address from Receive, then paste it on the bridge.",
    );
    window.open(`${TSD_BRIDGE_URL}/?address=${encodeURIComponent(address)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display uppercase">Top up with USDC or PYUSD</SheetTitle>
          <SheetDescription>
            Send stablecoins from your exchange, PayPal or Venmo to the TSD bridge, and TSD lands in
            this wallet.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-8 text-sm">
          <Section title="On the first bridge screen">
            <Step n={1} text="Pick the network your exchange uses, like Base or Ethereum. Coinbase works well on Base. Remember it — it has to match later." />
            <Step n={2} text="Pick the coin you're sending (USDC or PYUSD) and the amount. PYUSD is PayPal's stablecoin, so it comes from PayPal or Venmo." />
            <Step n={3} text="In “Your TEXITcoin address”, press and hold, then Paste. We copy it for you when you tap the button below. It starts with T." />
            <Step n={4} text="Refund address: your exchange wallet address for that same coin and network. Only used if something has to be sent back." />
          </Section>

          <Section title="On the next bridge screen">
            <Step n={5} text="The bridge shows an address starting with 0x. Tap Copy address." />
            <Step n={6} text="In your exchange, tap Send, pick the same coin and same network, paste that address and send the exact amount." />
            <Step n={7} text="Come back here. TSD usually lands in a few minutes." />
          </Section>

          <div className="rounded-xl border border-destructive/60 bg-destructive/10 p-3">
            <p className="font-semibold text-destructive">Before you send: check the network.</p>
            <p className="mt-1 text-xs text-destructive/90">
              The bridge only watches the network you picked. Money sent on Base never shows up if
              the bridge is set to Ethereum, and the other way around.
            </p>
          </div>

          <Button className="h-12 w-full rounded-full" onClick={go}>
            Copy my address and open the bridge <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Your exchange handles ID checks. We never see your bank.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
      <ol className="mt-2 space-y-2">{children}</ol>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
