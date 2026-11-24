import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { FormElement } from "@repo/ui/components/form-element";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ThemeSelector } from "@repo/ui/components/theme-selector";
import { useLoginMutation } from "../features/auth/hooks/use-auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLoginMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Authentication failed.";
          toast.error(message);
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="font-semibold">
          Platform
        </Link>
        <ThemeSelector />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Platform login</CardTitle>
          </CardHeader>
          <CardContent>
            <FormElement className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
              <Button asChild type="button" variant="link">
                <Link to="/register">Create a user account</Link>
              </Button>
            </FormElement>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
