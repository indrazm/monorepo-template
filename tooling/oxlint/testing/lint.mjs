import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const PLUGIN = resolve(import.meta.dir, "../repo-plugin.mjs");

const run = (ruleName, code, filename, fix) => {
  const dir = mkdtempSync(join(tmpdir(), "repo-oxlint-"));

  try {
    writeFileSync(
      join(dir, ".oxlintrc.json"),
      JSON.stringify({
        categories: { correctness: "off" },
        jsPlugins: [PLUGIN],
        rules: { [`repo/${ruleName}`]: "error" },
      }),
    );
    const file = join(dir, filename);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, code);

    const args = ["lint", "-c", ".oxlintrc.json", "--format", "json"];

    if (fix) args.push("--fix");

    const result = Bun.spawnSync([process.execPath, ...args, filename], { cwd: dir });
    const parsed = JSON.parse(result.stdout.toString());

    return {
      messages: parsed.diagnostics.map((diagnostic) => diagnostic.message),
      output: readFileSync(join(dir, filename), "utf8"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const lint = (ruleName, code, filename = "fixture.ts") =>
  run(ruleName, code, filename, false).messages;

export const lintFix = (ruleName, code, filename = "fixture.ts") =>
  run(ruleName, code, filename, true).output;
