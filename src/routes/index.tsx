import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { OnboardScreen } from "@/components/wallet/onboard-screen";
import { UnlockScreen } from "@/components/wallet/unlock-screen";
import { WalletDashboard } from "@/components/wallet/wallet-dashboard";
import { useWallet } from "@/lib/wallet/wallet-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CryptoPOP Wallet — Non-custodial POP wallet" },
      {
        name: "description",
        content:
          "The non-custodial CryptoPOP wallet. Scan a Cold Storage Coin or create a recovery phrase — your keys stay on your device.",
      },
      { property: "og:title", content: "CryptoPOP Wallet — Non-custodial POP wallet" },
      {
        property: "og:description",
        content:
          "Scan a Cold Storage Coin or create a recovery phrase. Your POP, your keys, your device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { status } = useWallet();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status === "none") return <OnboardScreen />;
  if (status === "locked") return <UnlockScreen />;
  return <WalletDashboard />;
}
