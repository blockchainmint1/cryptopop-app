import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p>© {new Date().getFullYear()} CryptoPOP — small business support, gamified.</p>
          <p>
            Part of the{" "}
            <a
              href="https://honest.money"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition underline-offset-2 hover:underline"
            >
              honest.money
            </a>{" "}
            ecosystem
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
          <Link to="/events" className="hover:text-foreground transition">Events</Link>
          <Link to="/earn" className="hover:text-foreground transition">Earn</Link>
          <Link to="/terms" className="hover:text-foreground transition">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground transition">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
