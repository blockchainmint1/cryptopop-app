import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { WalletHome } from "@/components/wallet-home";
import { WalletSignIn } from "@/components/wallet-signin";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CryptoPOP Wallet — Your POP balance & event check-ins" },
      { name: "description", content: "Your CryptoPOP wallet: POP balance, event check-ins, rewards and your on-chain TXC address." },
      { property: "og:title", content: "CryptoPOP Wallet — Your POP balance & event check-ins" },
      { property: "og:description", content: "Your CryptoPOP wallet: POP balance, event check-ins, rewards and your on-chain TXC address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return session ? <WalletHome /> : <WalletSignIn />;
}
