import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureAuthenticated } from "../features/auth/guard";
import { acceptInvitation } from "../features/team/services";

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { invitationId } = useParams({ from: "/accept-invitation/$invitationId" });
  const accept = useMutation({ mutationFn: () => acceptInvitation(invitationId) });

  useEffect(() => {
    accept.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join organization</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {accept.isPending ? <p>Accepting your invitation…</p> : null}
          {accept.isSuccess ? (
            <>
              <p className="text-muted-foreground">You've joined the organization.</p>
              <Button asChild>
                <Link to="/">Go to dashboard</Link>
              </Button>
            </>
          ) : null}
          {accept.isError ? (
            <p className="text-destructive">
              {accept.error instanceof Error
                ? accept.error.message
                : "Could not accept invitation."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
