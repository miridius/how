import { beforeEach, describe, expect, test } from "bun:test";
import { run } from "../src/how.ts";

type MockState = {
  response: string;
  stopReason: string;
  calls: Array<{ model: string; system: string; user: string; maxTokens: number }>;
  throwOnCall: Error | null;
};

function mock(): MockState {
  return (globalThis as unknown as { __HOW_MOCK__: MockState }).__HOW_MOCK__;
}

function captureStdout<T>(fn: () => Promise<T>): Promise<{ stdout: string; result: T }> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  // biome-ignore lint/suspicious/noExplicitAny: stdout.write overload
  (process.stdout as any).write = (chunk: unknown): boolean => {
    chunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  };
  return fn()
    .then((result) => ({ stdout: chunks.join(""), result }))
    .finally(() => {
      // biome-ignore lint/suspicious/noExplicitAny: stdout.write overload
      (process.stdout as any).write = originalWrite;
    });
}

function captureStderr<T>(fn: () => Promise<T>): Promise<{ stderr: string; result: T }> {
  const chunks: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  // biome-ignore lint/suspicious/noExplicitAny: stderr.write overload
  (process.stderr as any).write = (chunk: unknown): boolean => {
    chunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  };
  return fn()
    .then((result) => ({ stderr: chunks.join(""), result }))
    .finally(() => {
      // biome-ignore lint/suspicious/noExplicitAny: stderr.write overload
      (process.stderr as any).write = original;
    });
}

async function runCaptured(
  argv: readonly string[],
  env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-test" },
): Promise<{ stdout: string; stderr: string; code: number }> {
  let stderr = "";
  const { stdout, result: code } = await captureStdout(async () => {
    const inner = await captureStderr(() => run({ argv, env }));
    stderr = inner.stderr;
    return inner.result;
  });
  return { stdout, stderr, code };
}

beforeEach(() => {
  const m = mock();
  m.response = "echo hello";
  m.stopReason = "end_turn";
  m.calls.length = 0;
  m.throwOnCall = null;
});

describe("argument parsing", () => {
  test("--help shows usage and exits 0", async () => {
    const { stderr, code } = await runCaptured(["--help"]);
    expect(code).toBe(0);
    expect(stderr).toContain("Usage:");
    expect(stderr).toContain("Safety");
  });

  test("-h shows usage", async () => {
    const { code } = await runCaptured(["-h"]);
    expect(code).toBe(0);
  });

  test("--version prints version", async () => {
    const { stderr, code } = await runCaptured(["--version"]);
    expect(code).toBe(0);
    expect(stderr.trim().length).toBeGreaterThan(0);
  });

  test("unknown flag → exit 64", async () => {
    const { code } = await runCaptured(["--nope", "hi"]);
    expect(code).toBe(64);
  });

  test("no query → help and exit 64", async () => {
    const { code } = await runCaptured([]);
    expect(code).toBe(64);
  });

  test("-- terminates flag parsing", async () => {
    mock().response = "echo --yes";
    const { stdout, code } = await runCaptured(["-y", "--", "--yes", "please"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe("echo --yes");
    expect(mock().calls[0]?.user).toBe("--yes please");
  });
});

describe("environment requirements", () => {
  test("missing ANTHROPIC_API_KEY → exit 78", async () => {
    const { stderr, code } = await runCaptured(["list files"], {});
    expect(code).toBe(78);
    expect(stderr).toMatch(/ANTHROPIC_API_KEY/);
  });

  test("empty API key → exit 78", async () => {
    const { code } = await runCaptured(["list files"], { ANTHROPIC_API_KEY: "   " });
    expect(code).toBe(78);
  });

  test("malformed HOW_EXTRA_DENY → exit 78", async () => {
    const { code } = await runCaptured(["list files"], {
      ANTHROPIC_API_KEY: "sk-test",
      HOW_EXTRA_DENY: "([unclosed",
    });
    expect(code).toBe(78);
  });
});

describe("command generation", () => {
  test("-y prints command to stdout for safe commands", async () => {
    mock().response = "ls -la";
    const { stdout, code } = await runCaptured(["-y", "list", "files"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe("ls -la");
  });

  test("user query is forwarded to the model", async () => {
    mock().response = "du -sh .";
    await runCaptured(["-y", "show", "disk", "usage"]);
    expect(mock().calls[0]?.user).toBe("show disk usage");
  });

  test("HOW_MODEL overrides the default model", async () => {
    mock().response = "ls";
    await runCaptured(["-y", "list"], {
      ANTHROPIC_API_KEY: "sk-test",
      HOW_MODEL: "claude-haiku-4-5-20251001",
    });
    expect(mock().calls[0]?.model).toBe("claude-haiku-4-5-20251001");
  });

  test("strips code fences from the model response", async () => {
    mock().response = "```sh\nls -la\n```";
    const { stdout } = await runCaptured(["-y", "list"]);
    expect(stdout.trim()).toBe("ls -la");
  });
});

describe("error handling", () => {
  test("API errors surface with exit 1", async () => {
    mock().throwOnCall = new Error("network down");
    const { stderr, code } = await runCaptured(["-y", "hi"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/network down/);
  });

  test("empty model response → exit 1", async () => {
    mock().response = "";
    const { code } = await runCaptured(["-y", "hi"]);
    expect(code).toBe(1);
  });
});

describe("denylist", () => {
  test("prints 🚨 warning when the model returns a denylisted command", async () => {
    mock().response = "sudo rm -rf /";
    const { stderr } = await runCaptured(["-y", "wipe everything"]);
    expect(stderr).toContain("🚨");
  });

  test("denylist match demotes -y to the interactive edit prompt", async () => {
    // With -y and a denylist match, the auto-run path is skipped and the
    // edit prompt (gum or plain fallback) is invoked. In the test env there
    // is no gum binary and no TTY, so the plain fallback's "(enter to run...)"
    // banner appears on stderr — proving -y was demoted.
    mock().response = "sudo rm -rf /";
    const { stderr } = await runCaptured(["-y", "wipe everything"]);
    expect(stderr).toContain("enter to run");
  });

  test("safe command + -y skips the interactive prompt", async () => {
    mock().response = "ls -la";
    const { stderr } = await runCaptured(["-y", "list"]);
    expect(stderr).not.toContain("enter to run");
  });

  test("HOW_EXTRA_DENY adds patterns to the denylist", async () => {
    mock().response = "netcat -l 1337";
    const { stderr } = await runCaptured(["-y", "open a port"], {
      ANTHROPIC_API_KEY: "sk-test",
      HOW_EXTRA_DENY: "\\bnetcat\\b",
    });
    expect(stderr).toContain("🚨");
  });
});
