import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Users,
  Coins,
  Clock,
  Sparkles,
  ScanLine,
  Settings2,
  Plus,
  Zap,
  Shield,

} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminStats } from "@/lib/events-admin.functions";
import { getMyActiveOrg } from "@/lib/mint-token.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — CryptoPOP" }] }),
  component: AdminDashboard,
});

type Stats = Awaited<ReturnType<typeof getAdminStats>>;
type ActiveOrg = Awaited<ReturnType<typeof getMyActiveOrg>>["org"];

function AdminDashboard() {
  const fetchStats = useServerFn(getAdminStats);
  const fetchOrg = useServerFn(getMyActiveOrg);
  const [stats, setStats] = useState<Stats | null>(null);
  const [org, setOrg] = useState<ActiveOrg>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
    fetchOrg()
      .then((r) => setOrg(r.org))
      .catch(() => {});
  }, [fetchStats, fetchOrg]);

  const mintLocked = org !== null && !org.mintComplete;


  const cards = [
    {
      label: "Events",
      value: stats?.eventsTotal ?? "—",
      sub: stats ? `${stats.eventsUpcoming} upcoming` : "",
      icon: CalendarDays,
      to: "/admin/events" as const,
    },
    {
      label: "Signups",
      value: stats?.signupsTotal ?? "—",
      sub: "All-time event signups",
      icon: Users,
      to: "/admin/signups" as const,
    },
    {
      label: "POP awarded",
      value: stats ? stats.popSentTotal.toLocaleString() : "—",
      sub: stats ? `${stats.popPending} pending` : "",
      icon: Coins,
      to: "/admin/pop-awards" as const,
    },
    {
      label: "On-site claims",
      value: stats?.claimsTotal ?? "—",
      sub: "QR scans at events",
      icon: ScanLine,
      to: "/admin/events" as const,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Overview
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight mt-1">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage events, signups, POP awards, and reward rules in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/admin/events">
              <Plus className="h-4 w-4 mr-2" />
              New event
            </Link>
          </Button>
        </div>
      </header>

      {err && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">
          {err}
        </Card>
      )}

      {mintLocked && org && (
        <Card className="p-6 border-primary/40 bg-primary/5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/15 p-2">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold">
                Mint your POP token to unlock {org.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                POP is your community's on-chain reward token. Until it's issued on TEXITcoin,
                events and rewards stay locked. The wizard walks you through naming, funding, and
                broadcasting — takes about 5 minutes.
              </p>
            </div>
            <Button asChild>
              <Link to="/admin/mint-token">
                Start <Zap className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      )}



      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="p-5 h-full hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                    {c.label}
                  </p>
                  <p className="font-display text-3xl font-bold mt-2 tabular-nums">
                    {c.value}
                  </p>
                  {c.sub && (
                    <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                  )}
                </div>
                <c.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/events">
                <Plus className="h-4 w-4 mr-2" /> Create event
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/checkin">
                <ScanLine className="h-4 w-4 mr-2" /> Check in (scanner)
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/signups">
                <Users className="h-4 w-4 mr-2" /> Check in (list)
              </Link>
            </Button>

            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/pop-awards">
                <Coins className="h-4 w-4 mr-2" /> Review POP awards
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/codes">
                <ScanLine className="h-4 w-4 mr-2" /> QR codes
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/rewards">
                <Settings2 className="h-4 w-4 mr-2" /> Edit reward rules
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/admins">
                <Shield className="h-4 w-4 mr-2" /> Manage admins
              </Link>
            </Button>

          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">How it works</h2>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Create an event with a geofenced location and POP reward.</li>
            <li>Print its QR poster from the event detail page.</li>
            <li>Attendees scan on-site to claim POP into their wallets.</li>
            <li>Review signups, check people in, and audit awards here.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
