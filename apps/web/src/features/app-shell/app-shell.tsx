import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3Icon,
  BellIcon,
  CreditCardIcon,
  Globe2Icon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  LogOutIcon,
  PlugIcon,
  TargetIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { authClient } from "../../api";
import { meQueryOptions, useLogoutMutation } from "../auth/hooks/use-auth";
import { ThemeSelector } from "@repo/ui/components/theme-selector";
import { ChatWidget } from "../support/chat-widget";
import { SupportDialog } from "../support/support-dialog";
import { TactoLogo } from "./tacto-logo";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const user = useQuery(meQueryOptions);
  const logoutMutation = useLogoutMutation();

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onError: (error) => {
        const message = error instanceof Error ? error.message : "Failed to log out.";
        toast.error(message);
      },
    });
  }

  if (!user.data) {
    return null;
  }

  const navItems = [
    { icon: LayoutDashboardIcon, label: "Overview", to: "/" },
    { icon: Globe2Icon, label: "Sites", to: "/sites" },
    { icon: BellIcon, label: "Notifications", to: "/notifications" },
    { icon: PlugIcon, label: "Integrations", to: "/integrations" },
    { icon: BarChart3Icon, label: "Analytics", to: "/analytics" },
    { icon: TargetIcon, label: "Goals", to: "/goals" },
    { icon: CreditCardIcon, label: "Billing", to: "/billing" },
    { icon: UsersIcon, label: "Team", to: "/team" },
    { icon: UserRoundIcon, label: "Profile", to: "/profile" },
  ] as const;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Tacto">
                <Link to="/">
                  <TactoLogo className="size-8 shrink-0 rounded-md" />
                  <span className="text-base font-extrabold tracking-tight group-data-[collapsible=icon]:hidden">
                    Tacto
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <OrganizationSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.to}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="Edit profile">
                <Link to="/profile">
                  <Avatar className="shrink-0 rounded-md">
                    {user.data.image ? (
                      <AvatarImage src={user.data.image} alt={`${user.data.name} avatar`} />
                    ) : null}
                    <AvatarFallback className="rounded-md">
                      {getInitials(user.data.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{user.data.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.data.email}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SupportDialog>
            <Button
              className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              type="button"
              variant="ghost"
            >
              <LifeBuoyIcon className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Help &amp; support</span>
            </Button>
          </SupportDialog>
          <Button
            className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            type="button"
            variant="ghost"
            disabled={logoutMutation.isPending}
            onClick={handleLogout}
          >
            <LogOutIcon className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">Tacto</span>
          </div>
          <ThemeSelector />
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:px-8">
          {children}
        </div>
      </SidebarInset>
      <ChatWidget />
    </SidebarProvider>
  );
}

// Multi-organization users need an explicit way to choose the tenant; without
// it, team/profile pages silently used the first org in the list.
function OrganizationSwitcher() {
  const queryClient = useQueryClient();
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => (await authClient.organization.list()).data ?? [],
  });
  const session = useQuery({
    queryKey: ["session", "active-organization"],
    queryFn: async () => (await authClient.getSession()).data,
  });
  const activeId = (session.data?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId;
  const switchOrganization = useMutation({
    mutationFn: (organizationId: string) => authClient.organization.setActive({ organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      window.location.reload();
    },
  });

  if (!orgs.data || orgs.data.length < 2) return null;
  return (
    <select
      className="mt-2 w-full rounded-md border bg-background px-2 py-1.5 text-sm group-data-[collapsible=icon]:hidden"
      aria-label="Active organization"
      value={activeId ?? orgs.data[0]?.id}
      disabled={switchOrganization.isPending}
      onChange={(event) => switchOrganization.mutate(event.target.value)}
    >
      {orgs.data.map((organization) => (
        <option key={organization.id} value={organization.id}>
          {organization.name}
        </option>
      ))}
    </select>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
