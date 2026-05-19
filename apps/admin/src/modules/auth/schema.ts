export const authQueryKey = ["auth"] as const;

export const authApiPaths = {
  login: "/auth/login",
  logout: "/auth/logout",
  me: "/auth/me",
} as const;
