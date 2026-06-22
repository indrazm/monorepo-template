import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { meQueryOptions, useLogoutMutation } from "../../auth/hooks/use-auth";

export function AdminDashboard() {
  const { t } = useTranslation();
  const user = useQuery(meQueryOptions);
  const logoutMutation = useLogoutMutation();

  if (!user.data) {
    return null;
  }

  if (user.data.role !== "ADMIN") {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("dashboard.forbidden.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t("dashboard.forbidden.description")}</p>
          <Button
            className="w-fit"
            type="button"
            variant="outline"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? t("dashboard.logoutPending") : t("dashboard.logout")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("dashboard.session")}
            <Badge>{user.data.role}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("dashboard.email")}</span>
            <span>{user.data.email}</span>
          </div>
          <Button
            className="w-fit"
            type="button"
            variant="outline"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? t("dashboard.logoutPending") : t("dashboard.logout")}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
