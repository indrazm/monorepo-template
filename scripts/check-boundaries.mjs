import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const projects = ["apps", "packages"].flatMap((group) =>
  readdirSync(resolve(root, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      path: `${group}/${entry.name}`,
      manifest: JSON.parse(readFileSync(resolve(root, group, entry.name, "package.json"), "utf8")),
    })),
);
const browserPackages = new Set(["@repo/web", "@repo/api-client", "@repo/ui", "@repo/contracts"]);
const serverPackages = new Set([
  "@repo/api",
  "@repo/worker",
  "@repo/db",
  "@repo/storage",
  "@repo/queue",
  "@repo/config",
]);
function* sourceDirectories(path) {
  yield path;
  for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      ["node_modules", "dist", "build", ".wrangler", ".tanstack", "drizzle"].includes(entry.name)
    )
      continue;
    yield* sourceDirectories(`${path}/${entry.name}`);
  }
}
const overrides = projects.flatMap((project) => {
  const owner = project.manifest.name;
  const declared = {
    ...project.manifest.dependencies,
    ...project.manifest.devDependencies,
    ...project.manifest.peerDependencies,
  };
  const forbidden = projects.filter((target) => {
    const name = target.manifest.name;
    if (owner === "@repo/api-client" && name === "@repo/api") return false;
    return (
      !(name in declared) ||
      target.path.startsWith("apps/") ||
      (browserPackages.has(owner) && serverPackages.has(name)) ||
      ["@repo/contracts", "@repo/config"].includes(owner)
    );
  });
  const patterns = forbidden.map((target) => ({
    group: [target.manifest.name, `${target.manifest.name}/*`],
    message:
      "Use declared public dependencies; browser code and schema foundations cannot import server infrastructure or applications.",
  }));
  patterns.push({
    group: ["**/apps/**", "**/packages/**"],
    message: "Use public package exports instead of cross-package relative imports.",
  });
  return [...sourceDirectories(project.path)].map((directory) => {
    const relativeImports = projects
      .filter((target) => target !== project)
      .flatMap((target) => {
        const path = relative(resolve(root, directory), resolve(root, target.path));
        return [path, `${path}/**`];
      });
    return {
      files: [`${directory}/*`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              ...patterns,
              {
                group: relativeImports,
                message: "Use public package exports instead of cross-package relative imports.",
              },
            ],
            paths:
              owner === "@repo/api-client"
                ? [
                    {
                      name: "@repo/api/types",
                      allowTypeImports: true,
                      message: "The API exposes its RPC contract through type-only imports.",
                    },
                  ]
                : [],
          },
        ],
      },
    };
  });
});
// Use the existing linter's parser, including TypeScript and re-exports.
const configPath = resolve(root, `.boundaries-${process.pid}.json`);
try {
  writeFileSync(
    configPath,
    JSON.stringify({
      categories: { correctness: "off" },
      ignorePatterns: [
        "**/node_modules/**",
        "**/dist/**",
        "**/routeTree.gen.ts",
        "**/.wrangler/**",
      ],
      overrides,
    }),
  );
  // Use shell:true so the `pnpm` launcher resolves on every OS (notably the
  // `pnpm.CMD` shim on Windows, which a bare spawnSync cannot locate).
  const result = spawnSync(
    `pnpm exec oxlint --config "${configPath}" --deny-warnings apps packages`,
    { cwd: root, stdio: "inherit", shell: true },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(configPath);
}
