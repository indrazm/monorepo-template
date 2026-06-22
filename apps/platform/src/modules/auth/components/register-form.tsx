import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRegisterMutation } from "../hooks/use-auth";

export function RegisterForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const registerMutation = useRegisterMutation();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>{t("auth.register.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            registerMutation.mutate(
              { name, email, password },
              {
                onError: (error) => {
                  setError(
                    error instanceof Error ? error.message : t("auth.register.fallbackError"),
                  );
                },
              },
            );
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">{t("auth.register.name")}</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("auth.register.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("auth.register.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? t("auth.register.pending") : t("auth.register.submit")}
          </Button>
          <Button asChild type="button" variant="link">
            <Link to="/login">{t("auth.register.loginLink")}</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
