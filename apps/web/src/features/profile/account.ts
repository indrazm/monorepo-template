import { authClient } from "../../api";

// Account & security actions (feedback T12), thin wrappers over Better Auth's
// client. Each throws a plain Error with the provider message on failure so the
// UI can surface it in a toast or inline.
function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}): Promise<void> {
  const { error } = await authClient.changePassword(input);
  if (error) fail(error, "Could not change your password.");
}

export type AccountSession = {
  id: string;
  token: string;
  createdAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
};

export async function listSessions(): Promise<AccountSession[]> {
  const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
  if (list.error) fail(list.error, "Could not load sessions.");
  const currentToken = (current.data?.session as { token?: string } | undefined)?.token;
  return (list.data ?? []).map((session) => ({
    id: session.id,
    token: session.token,
    createdAt: new Date(session.createdAt).toISOString(),
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
    current: session.token === currentToken,
  }));
}

export async function revokeSession(token: string): Promise<void> {
  const { error } = await authClient.revokeSession({ token });
  if (error) fail(error, "Could not revoke that session.");
}

export async function revokeOtherSessions(): Promise<void> {
  const { error } = await authClient.revokeOtherSessions();
  if (error) fail(error, "Could not sign out other sessions.");
}

// --- Organization ---------------------------------------------------------
export async function getActiveOrganization(): Promise<{ id: string; name: string } | null> {
  const { data, error } = await authClient.organization.list();
  if (error) fail(error, "Could not load your organization.");
  const first = data?.[0];
  return first ? { id: first.id, name: first.name } : null;
}

export async function renameOrganization(organizationId: string, name: string): Promise<void> {
  const { error } = await authClient.organization.update({
    organizationId,
    data: { name },
  });
  if (error) fail(error, "Could not rename the organization.");
}

// --- Two-factor (TOTP) ----------------------------------------------------
export type TwoFactorSetup = { totpURI: string; backupCodes: string[]; secret: string | null };

function secretFromUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

export async function enableTwoFactor(password: string): Promise<TwoFactorSetup> {
  const { data, error } = await authClient.twoFactor.enable({ password });
  if (error || !data) fail(error, "Could not start two-factor setup.");
  const totpURI = (data as { totpURI: string }).totpURI;
  const backupCodes = (data as { backupCodes?: string[] }).backupCodes ?? [];
  return { totpURI, backupCodes, secret: secretFromUri(totpURI) };
}

export async function confirmTwoFactor(code: string): Promise<void> {
  const { error } = await authClient.twoFactor.verifyTotp({ code });
  if (error) fail(error, "That code did not match.");
}

export async function disableTwoFactor(password: string): Promise<void> {
  const { error } = await authClient.twoFactor.disable({ password });
  if (error) fail(error, "Could not disable two-factor.");
}

// --- Danger zone ----------------------------------------------------------
export async function deleteAccount(): Promise<void> {
  const { error } = await authClient.deleteUser({});
  if (error) fail(error, "Could not delete your account.");
}
