import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const projects = [];

for (const group of ["apps", "packages"]) {
  for (const entry of readdirSync(resolve(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    projects.push({
      path: `${group}/${entry.name}`,
      manifest: JSON.parse(readFileSync(resolve(root, group, entry.name, "package.json"), "utf8")),
    });
  }
}

const packageRuntimes = {
  "@repo/web": "browser",
  "@repo/api-client": "browser",
  "@repo/ui": "browser",
  "@repo/contracts": "universal",
  "@repo/api": "server",
  "@repo/worker": "server",
  "@repo/db": "server",
  "@repo/storage": "server",
  "@repo/queue": "server",
  "@repo/config": "server",
};

const foundationPackages = new Set(["@repo/contracts", "@repo/config"]);

const unclassified = projects.flatMap((project) =>
  project.manifest.name in packageRuntimes ? [] : [project.manifest.name],
);

if (unclassified.length > 0) {
  throw new Error(
    `Unclassified workspace package(s): [${unclassified.join(", ")}]. Register each package in packageRuntimes in scripts/check-boundaries.mjs.`,
  );
}

const existingNames = new Set(projects.map((project) => project.manifest.name));
const stale = Object.keys(packageRuntimes).filter((name) => !existingNames.has(name));

if (stale.length > 0) {
  throw new Error(
    `Stale packageRuntimes entries: [${stale.join(", ")}]. Remove deleted packages from scripts/check-boundaries.mjs.`,
  );
}

function* sourceDirectories(path) {
  yield path;
  for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      ["node_modules", "dist", "build", ".wrangler", ".tanstack", "drizzle"].includes(entry.name)
    ) {
      continue;
    }

    yield* sourceDirectories(`${path}/${entry.name}`);
  }
}

const overrides = projects.flatMap((project) => {
  const owner = project.manifest.name;
  const ownerRuntime = packageRuntimes[owner];
  const declared = {
    ...project.manifest.dependencies,
    ...project.manifest.devDependencies,
    ...project.manifest.peerDependencies,
  };
  const forbidden = projects.filter((target) => {
    const name = target.manifest.name;

    if (owner === "@repo/api-client" && name === "@repo/api") return false;

    const targetRuntime = packageRuntimes[name];
    const crossesRuntime =
      (ownerRuntime === "browser" || ownerRuntime === "universal") && targetRuntime === "server";

    return (
      !(name in declared) ||
      target.path.startsWith("apps/") ||
      crossesRuntime ||
      foundationPackages.has(owner)
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
  const result = spawnSync(
    resolve(root, "node_modules", ".bin", process.platform === "win32" ? "oxlint.cmd" : "oxlint"),
    ["--config", configPath, "--deny-warnings", "apps", "packages"],
    { cwd: root, stdio: "inherit" },
  );

  if (result.error) throw result.error;

  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(configPath);
}
