import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { useState } from "react";
import { loginWithGoogle } from "../services";

// "Continue with Google" — kicks off the OAuth redirect. When credentials are
// not configured on the API, Better Auth returns an error we surface as a toast.
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setPending(false);
      toast.error(error instanceof Error ? error.message : "Google sign-in is unavailable.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="border"
      disabled={pending}
      onClick={handleClick}
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
      {pending ? "Redirecting…" : label}
    </Button>
  );
}
