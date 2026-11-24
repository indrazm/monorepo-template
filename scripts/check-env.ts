import { readFileSync } from "node:fs";
import { apiEnvSchema } from "../apps/api/src/lib/config";
import { workerEnvSchema } from "../apps/worker/src/lib/config";
import { webEnvSchema } from "../apps/web/src/lib/config";

const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const entries: Record<string, string> = {};
for (const line of example.split("\n")) {
  if (!/^[A-Z_][A-Z0-9_]*=/.test(line)) continue;

  const separator = line.indexOf("=");
  entries[line.slice(0, separator)] = line.slice(separator + 1).replace(/^"|"$/g, "");
}
const runtimeKeys = new Set([
  ...Object.keys(apiEnvSchema.shape),
  ...Object.keys(workerEnvSchema.shape),
  ...Object.keys(webEnvSchema.shape),
]);
const missing = [...runtimeKeys].filter((key) => !(key in entries));
const unknown = Object.keys(entries).filter((key) => !runtimeKeys.has(key));

if (missing.length || unknown.length) {
  throw new Error(
    `Environment documentation drift: missing [${missing.join(", ")}]; unknown [${unknown.join(", ")}].`,
  );
}

apiEnvSchema.parse(entries);
workerEnvSchema.parse(entries);
webEnvSchema.parse(entries);
console.log("Environment example matches application schemas.");
