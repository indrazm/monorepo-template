// Copies the built pixel bundle (apps/widget → dist/t.js) into the web build
// output so the dashboard origin serves it at <VITE_WIDGET_CDN_URL>/t.js.
// Runs after `vite build` (which clears dist), before `wrangler deploy`.
import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const source = resolve(webRoot, "../widget/dist/t.js");
const dest = resolve(webRoot, "dist/t.js");

try {
  await access(source);
} catch {
  console.error(
    `[publish-pixel] widget bundle not found at ${source}\n` +
      "[publish-pixel] build it first: pnpm --filter @repo/widget build",
  );
  process.exit(1);
}

await mkdir(dirname(dest), { recursive: true });
await copyFile(source, dest);
console.log(`[publish-pixel] t.js -> ${dest}`);
