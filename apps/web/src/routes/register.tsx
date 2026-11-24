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
import { useRegisterMutation } from "../features/auth/hooks/use-auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const registerMutation = useRegisterMutation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerMutation.mutate(
      { name, email, password },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Registration failed.";
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
            <CardTitle>Create user account</CardTitle>
          </CardHeader>
          <CardContent>
            <FormElement className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating..." : "Register"}
              </Button>
              <Button asChild type="button" variant="link">
                <Link to="/login">Already have an account?</Link>
              </Button>
            </FormElement>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
