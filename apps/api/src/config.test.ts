import { describe, expect, it } from "vitest";
import { parseApiEnv } from "./config";

const productionEnv = {
  BETTER_AUTH_URL: "http://localhost:8000",
  CLIENT_ORIGINS: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:15432/tacto?schema=public",
  MAIL_FROM_EMAIL: "no-reply@example.com",
  NODE_ENV: "production",
  RESEND_API_KEY: "re_test_key",
} satisfies NodeJS.ProcessEnv;

describe("API environment config", () => {
  it("rejects the default auth secret in production", () => {
    expect(() =>
      parseApiEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "dev-change-me",
      }),
    ).toThrow("BETTER_AUTH_SECRET must be changed in production.");
  });

  it("rejects short auth secrets in production", () => {
    expect(() =>
      parseApiEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "short-secret",
      }),
    ).toThrow("BETTER_AUTH_SECRET must be at least 32 characters in production.");
  });

  it("accepts a strong auth secret in production", () => {
    expect(() =>
      parseApiEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "a-production-secret-with-32-chars",
      }),
    ).not.toThrow();
  });
  it("requires Resend credentials in production", () => {
    expect(() =>
      parseApiEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "a-production-secret-with-32-chars",
        RESEND_API_KEY: "",
      }),
    ).toThrow("RESEND_API_KEY is required in production.");
    expect(() =>
      parseApiEnv({
        ...productionEnv,
        BETTER_AUTH_SECRET: "a-production-secret-with-32-chars",
        MAIL_FROM_EMAIL: "",
      }),
    ).toThrow("MAIL_FROM_EMAIL is required in production.");
  });

  it("allows Resend to be unset outside production", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "development",
        RESEND_API_KEY: "",
        MAIL_FROM_EMAIL: "",
      }),
    ).not.toThrow();
  });

  it("rejects paths and empty entries in allowed origins", () => {
    for (const CLIENT_ORIGINS of ["https://app.example.com/path", "https://app.example.com,", ""]) {
      expect(() => parseApiEnv({ CLIENT_ORIGINS })).toThrow();
    }
  });
  it("normalizes allowed origins once", () => {
    expect(
      parseApiEnv({ CLIENT_ORIGINS: "https://app.example.com, http://localhost:3000" })
        .CLIENT_ORIGINS,
    ).toEqual(["https://app.example.com", "http://localhost:3000"]);
  });
});
