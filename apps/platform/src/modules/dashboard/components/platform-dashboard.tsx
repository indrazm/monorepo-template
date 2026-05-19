import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { meQueryOptions, useLogoutMutation } from "../../auth/hooks/use-auth";

export function PlatformDashboard() {
  const user = useQuery(meQueryOptions);
  const logoutMutation = useLogoutMutation();

  if (!user.data) {
    return null;
  }

  return (
    <section className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform dashboard</h1>
        <p className="text-sm text-muted-foreground">Protected dashboard page.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Session
            <Badge>{user.data.role}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{user.data.email}</span>
          </div>
          <Button
            className="w-fit"
            type="button"
            variant="outline"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
