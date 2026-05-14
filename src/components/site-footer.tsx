import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} CryptoPOP · Proof of Participation on TXC</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/api" className="hover:text-foreground transition">
            Developer API
          </Link>
          <Link to="/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
