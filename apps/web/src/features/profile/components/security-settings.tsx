import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { authQueryKey } from "../../auth/query-keys";
import {
  changePassword,
  confirmTwoFactor,
  deleteAccount,
  disableTwoFactor,
  enableTwoFactor,
  getActiveOrganization,
  listSessions,
  renameOrganization,
  revokeOtherSessions,
  revokeSession,
  type TwoFactorSetup,
} from "../account";

export function SecuritySettings({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  return (
    <section className="grid gap-4">
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect your account and manage where you&apos;re signed in.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChangePasswordCard />
        <TwoFactorCard enabled={twoFactorEnabled} />
        <SessionsCard />
        <OrganizationCard />
      </div>
      <DangerZone />
    </section>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const mutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: revokeOthers,
      }),
    onSuccess: () => {
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use a strong password you don&apos;t reuse elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="cur-pass">Current password</Label>
            <Input
              id="cur-pass"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-pass">New password</Label>
            <Input
              id="new-pass"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={revokeOthers}
              onChange={(e) => setRevokeOthers(e.target.checked)}
            />
            Sign out other devices
          </label>
          <Button type="submit" className="w-fit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");

  const start = useMutation({
    mutationFn: () => enableTwoFactor(password),
    onSuccess: (data) => {
      setSetup(data);
      setPassword("");
    },
    onError: (error) => toast.error(error.message),
  });
  const confirm = useMutation({
    mutationFn: () => confirmTwoFactor(code),
    onSuccess: async () => {
      toast.success("Two-factor authentication is on.");
      setSetup(null);
      setCode("");
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
    },
    onError: (error) => toast.error(error.message),
  });
  const disable = useMutation({
    mutationFn: () => disableTwoFactor(password),
    onSuccess: async () => {
      toast.success("Two-factor authentication disabled.");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor authentication
          {enabled ? <Badge>On</Badge> : <Badge variant="secondary">Off</Badge>}
        </CardTitle>
        <CardDescription>
          Require a one-time code from an authenticator app when signing in.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {enabled ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="tfa-dis-pass">Confirm password to disable</Label>
              <Input
                id="tfa-dis-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={disable.isPending || password.length === 0}
              onClick={() => disable.mutate()}
            >
              Disable 2FA
            </Button>
          </>
        ) : setup ? (
          <>
            <p className="text-sm">
              Add this key to your authenticator app (e.g. Google Authenticator, 1Password), then
              enter the 6-digit code to confirm.
            </p>
            <div className="grid gap-1">
              <Label className="text-xs">Setup key</Label>
              <code className="break-all rounded-md border bg-muted/60 p-2 text-xs">
                {setup.secret ?? setup.totpURI}
              </code>
            </div>
            {setup.backupCodes.length > 0 ? (
              <div className="grid gap-1">
                <Label className="text-xs">Backup codes (save these)</Label>
                <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/60 p-2 text-xs font-mono">
                  {setup.backupCodes.map((backup) => (
                    <span key={backup}>{backup}</span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="tfa-code">6-digit code</Label>
              <Input
                id="tfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={confirm.isPending || code.length < 6}
                onClick={() => confirm.mutate()}
              >
                Confirm & turn on
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="tfa-pass">Confirm password to begin</Label>
              <Input
                id="tfa-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-fit"
              disabled={start.isPending || password.length === 0}
              onClick={() => start.mutate()}
            >
              Enable 2FA
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const sessions = useQuery({ queryKey: ["account", "sessions"], queryFn: listSessions });
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success("Session revoked.");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      toast.success("Other sessions signed out.");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {sessions.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="grid gap-2">
            {(sessions.data ?? []).map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {session.userAgent ?? "Unknown device"}
                    {session.current ? (
                      <Badge variant="secondary" className="ml-2">
                        This device
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress ?? "—"} · {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                {session.current ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => revoke.mutate(session.token)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          Sign out all other devices
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganizationCard() {
  const org = useQuery({ queryKey: ["account", "org"], queryFn: getActiveOrganization });
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const current = org.data;
  const value = name || current?.name || "";
  const rename = useMutation({
    mutationFn: () => renameOrganization(current!.id, value.trim()),
    onSuccess: () => {
      toast.success("Organization renamed.");
      void queryClient.invalidateQueries({ queryKey: ["account", "org"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>The workspace name shown across Tacto.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            value={value}
            disabled={!current}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          type="button"
          className="w-fit"
          disabled={
            !current || rename.isPending || value.trim().length === 0 || value === current?.name
          }
          onClick={() => rename.mutate()}
        >
          Save name
        </Button>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/login" });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and sign out everywhere. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your account. Workspace data you own may be removed too.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate()}>Delete account</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
