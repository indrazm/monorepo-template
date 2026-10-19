import { authClient } from "../../api";

// Returns the full organization the session is currently scoped to. Only sets
// an active organization when the session has none (sign-up); never overwrites
// a user's choice with the first org in the list.
export async function loadTeam() {
  const [orgs, session] = await Promise.all([
    authClient.organization.list(),
    authClient.getSession(),
  ]);
  const activeId = (session.data?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId;
  if (!activeId) {
    const first = orgs.data?.[0];
    if (first) await authClient.organization.setActive({ organizationId: first.id });
  }
  const full = await authClient.organization.getFullOrganization();
  if (full.error) throw new Error(full.error.message ?? "Failed to load team.");
  return full.data;
}

export async function inviteMember(input: { email: string; role: "member" | "admin" }) {
  const result = await authClient.organization.inviteMember(input);
  if (result.error) throw new Error(result.error.message ?? "Failed to invite member.");
}

export async function cancelInvitation(invitationId: string) {
  const result = await authClient.organization.cancelInvitation({ invitationId });
  if (result.error) throw new Error(result.error.message ?? "Failed to cancel invitation.");
}

export async function removeMember(memberIdOrEmail: string) {
  const result = await authClient.organization.removeMember({ memberIdOrEmail });
  if (result.error) throw new Error(result.error.message ?? "Failed to remove member.");
}

export async function acceptInvitation(invitationId: string) {
  const result = await authClient.organization.acceptInvitation({ invitationId });
  if (result.error) throw new Error(result.error.message ?? "Failed to accept invitation.");
}
