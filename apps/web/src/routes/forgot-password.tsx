import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { requestPasswordReset } from "../features/auth/services";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const reset = useMutation({
    mutationFn: () => requestPasswordReset(email.trim()),
    onSuccess: () => setSent(true),
    onError: (error) => toast.error(error.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    reset.mutate();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">
                If an account exists for {email}, a reset link is on its way.
              </p>
              <Button asChild variant="link" className="justify-start px-0">
                <Link to="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? "Sending…" : "Send reset link"}
              </Button>
              <Button asChild variant="link" className="justify-start px-0">
                <Link to="/login">Back to login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
