import { Card, CardContent } from "@repo/ui/components/card";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

// Temporary page for menus whose feature lands in a later phase, so the full
// dashboard navigation is present and type-safe from the start.
export function PlaceholderPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <AppShell>
      <section className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            {icon ? (
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {icon}
              </span>
            ) : null}
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
