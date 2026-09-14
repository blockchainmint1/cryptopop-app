import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { WalletSettings } from "@/components/wallet/wallet-settings";
import { useWallet } from "@/lib/wallet/wallet-context";
import { loadHiddenChains, toggleHiddenChain } from "@/lib/wallet/hidden-chains";
import type { AssetId } from "@/lib/wallet/assets";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Wallet Settings — CryptoPOP" },
      {
        name: "description",
        content:
          "Manage your CryptoPOP wallet: visible assets, recovery phrase, biometrics, notifications and backups.",
      },
      { property: "og:title", content: "Wallet Settings — CryptoPOP" },
      {
        property: "og:description",
        content: "Visible assets, recovery phrase, biometrics, notifications and backups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { status, lock, forget } = useWallet();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<AssetId[]>([]);

  useEffect(() => setHidden(loadHiddenChains()), []);

  useEffect(() => {
    if (status === "none") void navigate({ to: "/", replace: true });
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pb-2 pt-6">
        <Link
          to="/"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl uppercase tracking-wide">Settings</h1>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-2">
        {status === "loading" ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WalletSettings
            hidden={hidden}
            onToggleChain={(id) => setHidden((cur) => toggleHiddenChain(cur, id))}
            onLock={() => {
              lock();
              void navigate({ to: "/" });
            }}
            onForget={() => {
              forget();
              void navigate({ to: "/", replace: true });
            }}
          />
        )}
      </main>
    </div>
  );
}
