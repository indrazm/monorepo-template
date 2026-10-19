import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { AuthError, resetPassword } from "../features/auth/services";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    // The API redirects here with `?error=INVALID_TOKEN` for expired/unknown
    // links (Better Auth validates the token before forwarding).
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [tokenRejected, setTokenRejected] = useState(false);
  const reset = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: async () => {
      toast.success("Password updated — please log in.");
      await navigate({ to: "/login", search: {} });
    },
    onError: (error) => {
      // A used or expired link fails server-side with INVALID_TOKEN; the token
      // is single-use, so a second submission is rejected here.
      if (error instanceof AuthError && error.code === "INVALID_TOKEN") {
        setTokenRejected(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not reset password.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    reset.mutate();
  }

  const invalidLink = Boolean(linkError) || tokenRejected;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {invalidLink ? (
            <>
              <p className="text-destructive">
                This reset link is invalid, expired, or has already been used.
              </p>
              <Button asChild>
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
              <Button asChild variant="link" className="justify-start px-0">
                <Link to="/login" search={{}}>
                  Back to login
                </Link>
              </Button>
            </>
          ) : token ? (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? "Updating…" : "Update password"}
              </Button>
            </form>
          ) : (
            <>
              <p className="text-destructive">This reset link is invalid or has expired.</p>
              <Button asChild>
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
