import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/recover-wallet")({
  head: () => ({ meta: [
    { title: "Wallet Recovery — CryptoPOP" },
    { name: "description", content: "CryptoPOP uses on-device wallets. Server-managed wallet key export has been retired." },
    { property: "og:title", content: "Wallet Recovery — CryptoPOP" },
    { property: "og:description", content: "Your wallet keys remain on your device." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <div className="flex min-h-screen flex-col bg-background text-foreground">
    <main className="mx-auto w-full max-w-xl flex-1 space-y-5 px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Your on-device wallet</h1>
      <p className="text-muted-foreground">Email-managed wallets and server key exports have been retired. Your current wallet is protected by your device password and recovery phrase.</p>
      <Button asChild><Link to="/">Open wallet</Link></Button>
    </main></div>,
});
