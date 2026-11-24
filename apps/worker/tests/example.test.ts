import { describe, expect, it } from "vitest";
import { processExampleJob } from "../src/processors/example";

describe("example processor", () => {
  it("processes validated job data", async () => {
    const result = await processExampleJob({ data: { message: " hello " } });
    expect(Date.parse(result.processedAt)).not.toBeNaN();
  });
  it("rejects invalid data before processing", async () => {
    await expect(processExampleJob({ data: { message: 123 } })).rejects.toThrow();
  });
});
