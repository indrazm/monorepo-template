import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-module-mocking";

describe(`repo/${rule}`, () => {
  it("reports mock.module, jest and vi module mocks", () => {
    expect(lint(rule, 'mock.module("./a", () => ({}));')).toHaveLength(1);
    expect(lint(rule, 'jest.mock("./a");')).toHaveLength(1);
    expect(lint(rule, 'jest.doMock("./a");')).toHaveLength(1);
    expect(lint(rule, 'jest.unstable_mockModule("./a", () => ({}));')).toHaveLength(1);
    expect(lint(rule, 'vi.mock("./a");')).toHaveLength(1);
    expect(lint(rule, 'vi.doMock("./a");')).toHaveLength(1);
  });

  it("allows function mocks and spies", () => {
    expect(lint(rule, "const f = mock(() => 1);")).toHaveLength(0);
    expect(lint(rule, "jest.fn();")).toHaveLength(0);
    expect(lint(rule, "vi.spyOn(a, 'b');")).toHaveLength(0);
    expect(lint(rule, "mock.restore();")).toHaveLength(0);
  });

  it("allows the same names on other objects", () => {
    expect(lint(rule, "other.mock('x');")).toHaveLength(0);
    expect(lint(rule, "vi.module('x');")).toHaveLength(0);
  });
});
