import { prisma } from "../../utils/prisma";
import { sanitizeUser } from "../auth/utils";
import { usersListLimit } from "./utils";

export async function listRecentUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: usersListLimit,
  });

  return users.map(sanitizeUser);
}
