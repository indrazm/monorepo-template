import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { sendVerificationEmail } from "../services";

// Asks Better Auth to (re)send the activation email. The API always answers
// generically, so the success copy never confirms whether the address exists.
export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const resend = useMutation({
    mutationFn: () => sendVerificationEmail(email),
    onSuccess: () =>
      toast.success(
        "If that email is registered and still unverified, a new activation link is on its way.",
      ),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not send the email."),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    resend.mutate();
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="resend-verification-email">Email</Label>
        <Input
          id="resend-verification-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={resend.isPending || email.trim() === ""}>
        {resend.isPending ? "Sending…" : "Resend activation email"}
      </Button>
    </form>
  );
}
