import type { SanitizedUser } from "../auth/types";

export type UsersResponse = {
  users: SanitizedUser[];
};
