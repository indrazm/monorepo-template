import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ThemeSelector } from "@repo/ui/components/theme-selector";
import { GoogleButton } from "../features/auth/components/google-button";
import { ResendVerification } from "../features/auth/components/resend-verification";
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
          Tacto
        </Link>
        <ThemeSelector />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {registerMutation.isSuccess ? "Activate your account" : "Create your Tacto account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {registerMutation.isSuccess ? (
              <div className="grid gap-4 text-sm">
                <p className="text-muted-foreground">
                  We sent an activation link to{" "}
                  <span className="font-medium text-foreground">{registerMutation.data.email}</span>
                  . Open it to verify your email and finish signing up.
                </p>
                <p className="text-muted-foreground">
                  Didn't get it? Check your spam folder, or resend it:
                </p>
                <ResendVerification defaultEmail={registerMutation.data.email} />
                <Button asChild variant="link" className="justify-start px-0">
                  <Link to="/login">Back to login</Link>
                </Button>
              </div>
            ) : (
              <>
                <GoogleButton label="Sign up with Google" />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <form className="grid gap-4" onSubmit={handleSubmit}>
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
                      required
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
                      required
                      minLength={8}
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
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
