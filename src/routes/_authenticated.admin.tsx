import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Coins,
  ScanLine,
  Settings2,
  Shield,
  ShieldCheck,
  ArrowLeft,
  Contact,
  Send,
  FileText,
  Wallet,
  DoorOpen,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — CryptoPOP" }] }),
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, gatekeeper: false },
  { to: "/admin/events", label: "Events", icon: CalendarDays, exact: false, gatekeeper: false },
  { to: "/admin/signups", label: "Signups", icon: Users, exact: true, gatekeeper: false },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet, exact: true, gatekeeper: false },
  { to: "/admin/crm", label: "CRM", icon: Contact, exact: true, gatekeeper: false },
  { to: "/admin/blast", label: "Email Blast", icon: Send, exact: false, gatekeeper: false },
  { to: "/admin/email-templates", label: "Templates", icon: FileText, exact: true, gatekeeper: false },
  { to: "/admin/pop-awards", label: "POP Awards", icon: Coins, exact: true, gatekeeper: false },
  { to: "/admin/codes", label: "QR Codes", icon: ScanLine, exact: false, gatekeeper: false },
  { to: "/admin/rewards", label: "Reward Rules", icon: Settings2, exact: true, gatekeeper: false },
  { to: "/admin/checkin", label: "Door Check-in", icon: DoorOpen, exact: true, gatekeeper: true },
  { to: "/admin/admins", label: "Admins", icon: ShieldCheck, exact: true, gatekeeper: false },
] as const;

function AdminLayout() {
  const { user, loading } = useAuth();
  const { isAdmin, isGatekeeper, loading: adminLoading } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const canAccess = isAdmin || isGatekeeper;

  if (!user || !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <div>
            <h1 className="font-display text-xl font-semibold">Admin only</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You need an admin role to view this area.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/app">Back to wallet</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  // Gatekeepers can only reach /admin/checkin.
  const gatekeeperOnly = isGatekeeper && !isAdmin;
  const visibleNav = gatekeeperOnly
    ? navItems.filter((i) => i.gatekeeper)
    : navItems;
  const onAllowedRoute = !gatekeeperOnly || pathname === "/admin/checkin";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <Sidebar collapsible="icon" className="print:hidden">
          <SidebarContent>
            <div className="px-4 py-5 flex items-center gap-2 border-b border-border/40">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-display text-base font-semibold tracking-tight">
                CryptoPOP Admin
              </span>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>Manage</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNav.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to, item.exact)}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>App</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link to="/app" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to wallet</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/40 px-3 print:hidden">
            <SidebarTrigger />
            <span className="ml-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </header>
          <main className="flex-1 min-w-0">
            {onAllowedRoute ? (
              <Outlet />
            ) : (
              <div className="p-8">
                <Card className="max-w-md mx-auto p-8 text-center space-y-4">
                  <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div>
                    <h1 className="font-display text-xl font-semibold">Gatekeeper access</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your role only permits door check-in.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link to="/admin/checkin">Open check-in scanner</Link>
                  </Button>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
