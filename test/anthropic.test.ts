import { describe, expect, test } from "bun:test";
import { looksLikeShellCommand, stripCodeFences } from "../src/anthropic.ts";

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

describe("looksLikeShellCommand", () => {
  test("accepts plain commands", () => {
    expect(looksLikeShellCommand("ls -la")).toBe(true);
    expect(looksLikeShellCommand("git status")).toBe(true);
    expect(looksLikeShellCommand("./script.sh --flag")).toBe(true);
    expect(looksLikeShellCommand("FOO=bar ./run")).toBe(true);
    expect(looksLikeShellCommand("$(echo hi)")).toBe(true);
    expect(looksLikeShellCommand('find . -name "*.ts"')).toBe(true);
  });

  test("accepts pipelines and chains", () => {
    expect(looksLikeShellCommand("ls | grep foo")).toBe(true);
    expect(looksLikeShellCommand("cd /tmp && ls")).toBe(true);
  });

  test("rejects REFUSE prefix", () => {
    expect(looksLikeShellCommand("REFUSE: ambiguous request")).toBe(false);
    expect(looksLikeShellCommand("refuse: I cannot do that")).toBe(false);
  });

  test("rejects apology / prose", () => {
    expect(looksLikeShellCommand("I cannot help with that.")).toBe(false);
    expect(looksLikeShellCommand("Sorry, I don't know.")).toBe(false);
    expect(looksLikeShellCommand("Here's how to do it: ls")).toBe(false);
    expect(looksLikeShellCommand("To list files, run ls.")).toBe(false);
  });

  test("rejects empty", () => {
    expect(looksLikeShellCommand("")).toBe(false);
    expect(looksLikeShellCommand("   ")).toBe(false);
  });

  test("rejects very long multi-line output", () => {
    const prose = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    expect(looksLikeShellCommand(prose)).toBe(false);
  });
});
