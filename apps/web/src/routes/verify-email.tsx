import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ResendVerification } from "../features/auth/components/resend-verification";
import { meQueryOptions } from "../features/auth/hooks/use-auth";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    // `verified=1` is added to the callback URL on the success path.
    verified: search.verified === "1" || search.verified === "true",
    // Better Auth appends `error` when the token is invalid, expired or unknown.
    error: typeof search.error === "string" ? search.error : "",
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: VerifyEmailPage,
});

const errorMessages: Record<string, string> = {
  INVALID_TOKEN: "This activation link is invalid. Request a new one below.",
  TOKEN_EXPIRED: "This activation link has expired. Request a new one below.",
  USER_NOT_FOUND: "We couldn't find an account for this link. Try signing up again.",
  EMAIL_MISMATCH: "This link doesn't match the signed-in account.",
};

function VerifyEmailPage() {
  const { verified, error, email } = Route.useSearch();
  const navigate = useNavigate();
  // The activation link redirects here with `?verified=1`. A mail client or the
  // ngrok interstitial can strip that query on the cross-site hop, so we also
  // treat a verified session as success: `autoSignInAfterVerification` already
  // set the session cookie before the redirect.
  const me = useQuery(meQueryOptions);
  const sessionVerified = me.data?.emailVerified === true;
  const success = (verified || sessionVerified) && !error;
  // Still deciding: no query signal yet and the session hasn't resolved.
  const checking = !verified && !error && me.isPending;

  // autoSignInAfterVerification already set the session cookie; drop the user
  // straight into the dashboard.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      void navigate({ to: "/" });
    }, 1200);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="font-semibold">
          Tacto
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email verification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {checking ? (
              <p className="text-muted-foreground">Checking your activation link…</p>
            ) : success ? (
              <div className="grid gap-3">
                <p className="text-muted-foreground">
                  Your email is verified. Taking you to the dashboard…
                </p>
                <Button asChild>
                  <Link to="/">Go to dashboard</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <p className={error ? "text-destructive" : "text-muted-foreground"}>
                  {error
                    ? (errorMessages[error] ?? "We couldn't verify this email.")
                    : "Open the activation link we emailed you to finish setting up your account."}
                </p>
                <ResendVerification defaultEmail={email} />
                <Button asChild variant="link" className="justify-start px-0">
                  <Link to="/login">Back to login</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
