import type { QueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="font-semibold">
            Admin
          </Link>
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Overview</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}
