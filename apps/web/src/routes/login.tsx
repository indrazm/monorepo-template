import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { ThemeSelector } from "@repo/ui/components/theme-selector";
import { GoogleButton } from "../features/auth/components/google-button";
import { ResendVerification } from "../features/auth/components/resend-verification";
import { useLoginMutation } from "../features/auth/hooks/use-auth";
import { authQueryKey } from "../features/auth/query-keys";
import { AuthError, verifyTwoFactor } from "../features/auth/services";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const loginMutation = useLoginMutation();

  // Completes a 2FA challenge with a TOTP code (feedback T12).
  const verifyMutation = useMutation({
    mutationFn: () => verifyTwoFactor(code.trim(), trustDevice),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      await navigate({ to: "/" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Invalid code."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => {
          // An account that exists but hasn't been activated yet gets a dedicated
          // recovery panel instead of a dead-end error.
          if (error instanceof AuthError && error.code === "EMAIL_NOT_VERIFIED") {
            setUnverifiedEmail(email.trim());
            return;
          }
          // 2FA-enabled account: swap to the code challenge instead of erroring.
          if (error instanceof AuthError && error.code === "TWO_FACTOR_REQUIRED") {
            setTwoFactorPending(true);
            return;
          }
          const message = error instanceof Error ? error.message : "Authentication failed.";
          toast.error(message);
        },
      },
    );
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    verifyMutation.mutate();
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
            <CardTitle>Log in to Tacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {twoFactorPending ? (
              <form className="grid gap-4" onSubmit={handleVerify}>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="totp">Authentication code</Label>
                  <Input
                    id="totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(event) => setTrustDevice(event.target.checked)}
                  />
                  Trust this device for 60 days
                </label>
                <Button type="submit" disabled={verifyMutation.isPending || code.trim().length < 6}>
                  {verifyMutation.isPending ? "Verifying…" : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="justify-start px-0"
                  onClick={() => {
                    setTwoFactorPending(false);
                    setCode("");
                  }}
                >
                  Back to login
                </Button>
              </form>
            ) : unverifiedEmail ? (
              <div className="grid gap-4 text-sm">
                <p className="text-destructive">
                  This account hasn't been activated yet. Open the activation link we emailed you,
                  or request a new one below.
                </p>
                <ResendVerification defaultEmail={unverifiedEmail} />
                <Button
                  type="button"
                  variant="link"
                  className="justify-start px-0"
                  onClick={() => setUnverifiedEmail(null)}
                >
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                <GoogleButton />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <form className="grid gap-4" onSubmit={handleSubmit}>
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
                  <div className="flex items-center justify-between">
                    <Button asChild type="button" variant="link" className="px-0">
                      <Link to="/register">Create a user account</Link>
                    </Button>
                    <Button asChild type="button" variant="link" className="px-0">
                      <Link to="/forgot-password">Forgot password?</Link>
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
