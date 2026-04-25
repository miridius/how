import { describe, expect, test } from "bun:test";
import { stripCodeFences } from "../src/anthropic.ts";

describe("stripCodeFences", () => {
  test("strips triple-backtick fence with language", () => {
    expect(stripCodeFences("```sh\nls -la\n```")).toBe("ls -la");
  });

  test("strips triple-backtick fence without language", () => {
    expect(stripCodeFences("```\necho hi\n```")).toBe("echo hi");
  });

  test("strips single-backtick inline", () => {
    expect(stripCodeFences("`ls`")).toBe("ls");
  });

  test("trims whitespace", () => {
    expect(stripCodeFences("   ls -la\n")).toBe("ls -la");
  });

  test("leaves plain commands untouched", () => {
    expect(stripCodeFences("ls -la")).toBe("ls -la");
  });

  test("handles multi-line fenced blocks", () => {
    expect(stripCodeFences("```bash\nset -e\necho hi\n```")).toBe("set -e\necho hi");
  });
});
