import { authClient } from "../../api";

// Ensures the user's first organization is active (sign-up sessions start
// without one), then returns the full organization (members + invitations).
export async function loadTeam() {
  const orgs = await authClient.organization.list();
  const first = orgs.data?.[0];
  if (first) {
    await authClient.organization.setActive({ organizationId: first.id });
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
