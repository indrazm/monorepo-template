#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const rootDir = findWorkspaceRoot(process.cwd());
const envPath = join(rootDir, ".env");
const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/with-env.mjs <command> [...args]");
  process.exit(1);
}

if (existsSync(envPath)) {
  for (const [key, value] of parseEnv(readFileSync(envPath, "utf8"))) {
    process.env[key] ??= value;
  }
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function findWorkspaceRoot(startDir) {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    currentDir = dirname(currentDir);
  }

  return startDir;
}

function parseEnv(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => {
      const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
      const equalsIndex = normalized.indexOf("=");

      if (equalsIndex === -1) {
        return [];
      }

      const key = normalized.slice(0, equalsIndex).trim();
      const value = unquote(normalized.slice(equalsIndex + 1).trim());

      return key ? [[key, value]] : [];
    });
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
