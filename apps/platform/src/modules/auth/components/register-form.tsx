import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useRegisterMutation } from "../hooks/use-auth";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const registerMutation = useRegisterMutation();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Create user account</CardTitle>
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
                  setError(error instanceof Error ? error.message : "Registration failed.");
                },
              },
            );
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "Creating..." : "Register"}
          </Button>
          <Button asChild type="button" variant="link">
            <Link to="/login">Already have an account?</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
