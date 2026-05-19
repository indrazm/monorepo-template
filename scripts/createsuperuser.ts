import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../apps/api/src/modules/auth/password";
import { prisma } from "../apps/api/src/utils/prisma";

const rl = createInterface({ input, output });

try {
  const email = normalizeEmail(await rl.question("Email: "));
  const name = normalizeOptional(await rl.question("Name (optional): "));
  const password = await questionHidden("Password: ");
  const passwordConfirmation = await questionHidden("Confirm password: ");

  if (!email) {
    throw new Error("Email is required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (password !== passwordConfirmation) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
  });

  output.write(`Admin user ready: ${user.email}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Failed to create admin user.";
  output.write(`Error: ${message}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOptional(value: string) {
  return value.trim() || null;
}

async function questionHidden(prompt: string) {
  if (!input.isTTY || !output.isTTY || !input.setRawMode) {
    return rl.question(prompt);
  }

  return new Promise<string>((resolve) => {
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";

    const onData = (key: string) => {
      if (key === "\u0003") {
        output.write("\n");
        input.setRawMode(false);
        input.off("data", onData);
        process.exit(130);
      }

      if (key === "\r" || key === "\n") {
        output.write("\n");
        input.setRawMode(false);
        input.off("data", onData);
        resolve(value);
        return;
      }

      if (key === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += key;
    };

    input.on("data", onData);
  });
}
