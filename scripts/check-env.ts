import { readFileSync } from "node:fs";
import { apiEnvSchema } from "../apps/api/src/config";
import { workerEnvSchema } from "../apps/worker/src/config";
import { webEnvSchema } from "../apps/web/src/config";

const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const entries = Object.fromEntries(
  example
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")];
    }),
);
const runtimeKeys = new Set([
  ...Object.keys(apiEnvSchema.shape),
  ...Object.keys(workerEnvSchema.shape),
  ...Object.keys(webEnvSchema.shape),
]);
const compose = readFileSync(new URL("../docker-compose.yaml", import.meta.url), "utf8");
const composeKeys = new Set(
  [...compose.matchAll(/\$\{([A-Z_][A-Z0-9_]*)/g)].map((match) => match[1]),
);
const missing = [...runtimeKeys].filter((key) => !(key in entries));
const unknown = Object.keys(entries).filter(
  (key) => !runtimeKeys.has(key) && !composeKeys.has(key),
);
if (missing.length || unknown.length) {
  throw new Error(
    `Environment documentation drift: missing [${missing.join(", ")}]; unknown [${unknown.join(", ")}].`,
  );
}
apiEnvSchema.parse(entries);
workerEnvSchema.parse(entries);
webEnvSchema.parse(entries);
console.log("Environment example matches application schemas.");
