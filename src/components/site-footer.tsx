import { Link } from "@tanstack/react-router";
import { Instagram, Twitter, Music2 } from "lucide-react";

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/cryptopop.asia?igsh=MWJjN3ZlNDZwb25nbw==",
    Icon: Instagram,
  },
  {
    label: "X",
    href: "https://x.com/cryptopop_asia",
    Icon: Twitter,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@cryptopop.asia",
    Icon: Music2,
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p>© {new Date().getFullYear()} CryptoPOP · Proof of Participation on TXC</p>
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
        <div className="flex flex-col gap-4 sm:items-end">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/mission" className="hover:text-foreground transition">
              Mission
            </Link>
            <Link to="/change-log" className="hover:text-foreground transition">
              Change Log
            </Link>
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
          <div className="flex items-center gap-3">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Telegram · TBC
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
