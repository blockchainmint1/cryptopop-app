import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/blast")({
  head: () => ({ meta: [{ title: "Email Blast — CryptoPOP Admin" }] }),
  component: BlastLayout,
});

function BlastLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/admin/blast", label: "Compose", exact: true },
    { to: "/admin/blast/history", label: "History", exact: false },
  ];
  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl">Email Blast</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send branded email blasts via Amazon SES. From{" "}
            <span className="font-mono text-foreground">
              noreply@cryptopop.asia
            </span>
            .
          </p>
        </div>
        <nav className="flex gap-1 border border-border rounded-full p-1">
          {tabs.map((t) => {
            const active = t.exact
              ? pathname === t.to
              : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-1.5 text-xs font-mono uppercase tracking-widest rounded-full transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
