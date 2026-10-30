import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./index";

function captureLogs() {
  const lines: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("writes structured JSON at info level by default", () => {
    const lines = captureLogs();
    const logger = createLogger();

    logger.debug("filtered out");
    logger.info({ requestId: "request-1" }, "hello");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      level: 30,
      requestId: "request-1",
      msg: "hello",
    });
  });

  it("supports Pino options and child loggers", () => {
    const lines = captureLogs();
    const logger = createLogger({
      level: "debug",
      name: "test-service",
      redact: ["password"],
    });

    logger.child({ requestId: "request-2" }).debug({ password: "secret" }, "child log");

    expect(JSON.parse(lines[0])).toMatchObject({
      level: 20,
      name: "test-service",
      requestId: "request-2",
      password: "[Redacted]",
      msg: "child log",
    });
  });

  it("serializes errors with Pino's default serializer", () => {
    const lines = captureLogs();
    createLogger().error({ err: new Error("something failed") }, "failed");

    expect(JSON.parse(lines[0])).toMatchObject({
      level: 50,
      err: {
        type: "Error",
        message: "something failed",
        stack: expect.any(String),
      },
      msg: "failed",
    });
  });

  it("writes human-readable output when pretty is enabled", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        'import { createLogger } from "./src/index.ts"; createLogger({ pretty: true }).info("pretty log");',
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf8",
        timeout: 10_000,
      },
    );

    expect(output).toContain("INFO");
    expect(output).toContain("pretty log");
    expect(output.trim()).not.toMatch(/^\{/);
  });
});
