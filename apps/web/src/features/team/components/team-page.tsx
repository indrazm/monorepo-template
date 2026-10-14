import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { cancelInvitation, inviteMember, loadTeam, removeMember } from "../services";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

const teamQueryOptions = queryOptions({ queryKey: ["team"], queryFn: loadTeam });

export function TeamPage() {
  const queryClient = useQueryClient();
  const team = useQuery(teamQueryOptions);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team"] });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  const invite = useMutation({
    mutationFn: () => inviteMember({ email: email.trim(), role }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setEmail("");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(error.message),
  });

  const members = team.data?.members ?? [];
  const invitations = (team.data?.invitations ?? []).filter((i) => i.status === "pending");

  function handleInvite(event: FormEvent) {
    event.preventDefault();
    invite.mutate();
  }

  return (
    <AppShell>
      <section className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite teammates to your organization and manage their access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-56 flex-1 gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className={selectClass}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "member" | "admin")}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{m.user?.name || m.user?.email || m.userId}</p>
                    <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {m.role}
                    </Badge>
                    {m.role !== "owner" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(m.id)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {invitations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{i.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {i.role} · {i.status}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(i.id)}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
