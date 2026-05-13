import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "CryptoPOP" }] }),
  component: AppHome,
});

function AppHome() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome</h1>
        <p className="mt-2 text-muted-foreground">Signed in as {user?.email}</p>
        <p className="mt-6 text-sm text-muted-foreground">
          Wallet setup, scanner, and leaderboard coming next.
        </p>
        <Button variant="outline" className="mt-8" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}
