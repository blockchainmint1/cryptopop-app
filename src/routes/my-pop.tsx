import { createFileRoute, redirect } from "@tanstack/react-router";
import { maybeRedirectToWalletApp, WALLET_APP_REDIRECT_ENABLED } from "@/lib/wallet-app";

// /my-pop was merged into /app, which now lives on the wallet app subdomain.
export const Route = createFileRoute("/my-pop")({
  beforeLoad: ({ location }) => {
    maybeRedirectToWalletApp(location);
    if (!WALLET_APP_REDIRECT_ENABLED) throw redirect({ to: "/app" });
  },
});
