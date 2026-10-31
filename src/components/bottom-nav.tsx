import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, MapPin, Wallet } from "lucide-react";
import coin from "@/assets/cryptopop-coin.png";

/**
 * Sticky footer navigation: Wallet, Directory, Events, POP.
 * The active tab is lit in brand pink; the rest stay muted.
 */
function itemClass(active: boolean) {
  return [
    "flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 font-mono text-[10px] uppercase tracking-widest transition",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}

export function BottomNav() {
  const { pathname } = useLocation();

  const onDirectory = pathname === "/merchants";
  const onEvents = pathname === "/events" || pathname.startsWith("/events/");
  const onWallet = pathname === "/";
  const onPop = pathname === "/leaderboard";

  return (
    <nav
      aria-label="Main"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 px-2">
        <Link
          to="/"
          aria-current={onWallet ? "page" : undefined}
          className={itemClass(onWallet)}
        >
          <Wallet className="h-5 w-5" />
          Wallet
        </Link>
        <Link
          to="/merchants"
          aria-current={onDirectory ? "page" : undefined}
          className={itemClass(onDirectory)}
        >
          <MapPin className="h-5 w-5" />
          Directory
        </Link>
        <Link
          to="/events"
          aria-current={onEvents ? "page" : undefined}
          className={itemClass(onEvents)}
        >
          <CalendarDays className="h-5 w-5" />
          Events
        </Link>
        <Link
          to="/leaderboard"
          aria-current={onPop ? "page" : undefined}
          className={itemClass(onPop)}
        >
          <img src={coin} alt="" aria-hidden className="h-5 w-5" />
          POP
        </Link>
      </div>
    </nav>
  );
}

/** Keeps page content clear of the sticky bar. */
export function BottomNavSpacer() {
  return <div aria-hidden className="h-24" />;
}
