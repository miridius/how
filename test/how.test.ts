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

beforeEach(() => {
  const m = mock();
  m.response = "echo hello";
  m.stopReason = "end_turn";
  m.calls.length = 0;
  m.throwOnCall = null;
});

describe("argument parsing", () => {
  test("shows help with --help", async () => {
    const { stderr, result } = await captureStderr(() =>
      run({ argv: ["--help"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(0);
    expect(stderr).toContain("Usage:");
    expect(stderr).toContain("Safety");
  });

  test("shows help with -h", async () => {
    const { result } = await captureStderr(() =>
      run({ argv: ["-h"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(0);
  });

  test("prints version with --version", async () => {
    const { stderr, result } = await captureStderr(() =>
      run({ argv: ["--version"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(0);
    expect(stderr.trim().length).toBeGreaterThan(0);
  });

  test("rejects unknown flag with exit 64", async () => {
    const { result } = await captureStderr(() =>
      run({ argv: ["--nope", "hi"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(64);
  });

  test("shows help when no query given", async () => {
    const { result } = await captureStderr(() =>
      run({ argv: [], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(64);
  });

  test("-- terminates flag parsing", async () => {
    mock().response = "echo --yes";
    const { stdout, result } = await captureStdout(() =>
      captureStderr(() =>
        run({
          argv: ["-y", "--", "--yes", "please"],
          env: { ANTHROPIC_API_KEY: "sk-test" },
        }),
      ).then((r) => r.result),
    );
    expect(result).toBe(0);
    expect(stdout.trim()).toBe("echo --yes");
    expect(mock().calls[0]?.user).toBe("--yes please");
  });
});

describe("environment requirements", () => {
  test("refuses without ANTHROPIC_API_KEY", async () => {
    const { stderr, result } = await captureStderr(() => run({ argv: ["list files"], env: {} }));
    expect(result).toBe(78);
    expect(stderr).toMatch(/ANTHROPIC_API_KEY/);
  });

  test("refuses with empty API key", async () => {
    const { result } = await captureStderr(() =>
      run({ argv: ["list files"], env: { ANTHROPIC_API_KEY: "   " } }),
    );
    expect(result).toBe(78);
  });

  test("rejects invalid HOW_TIMEOUT_MS", async () => {
    const { result } = await captureStderr(() =>
      run({
        argv: ["list files"],
        env: { ANTHROPIC_API_KEY: "sk-test", HOW_TIMEOUT_MS: "-1" },
      }),
    );
    expect(result).toBe(78);
  });

  test("rejects malformed HOW_EXTRA_DENY", async () => {
    const { result } = await captureStderr(() =>
      run({
        argv: ["list files"],
        env: { ANTHROPIC_API_KEY: "sk-test", HOW_EXTRA_DENY: "([unclosed" },
      }),
    );
    expect(result).toBe(78);
  });
});

describe("successful command generation", () => {
  test("prints command to stdout with -y", async () => {
    mock().response = "ls -la";
    const inner = async () =>
      run({ argv: ["-y", "list", "files"], env: { ANTHROPIC_API_KEY: "sk-test" } });
    const { stdout, result } = await captureStdout(async () => {
      const { result: r } = await captureStderr(inner);
      return r;
    });
    expect(result).toBe(0);
    expect(stdout.trim()).toBe("ls -la");
  });

  test("passes user query to the model", async () => {
    mock().response = "du -sh .";
    await captureStdout(async () => {
      const { result } = await captureStderr(() =>
        run({ argv: ["-y", "show", "disk", "usage"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
      );
      return result;
    });
    expect(mock().calls[0]?.user).toBe("show disk usage");
  });

  test("honours HOW_MODEL override", async () => {
    mock().response = "ls";
    await captureStdout(async () => {
      await captureStderr(() =>
        run({
          argv: ["-y", "list"],
          env: { ANTHROPIC_API_KEY: "sk-test", HOW_MODEL: "claude-haiku-4-5-20251001" },
        }),
      );
    });
    expect(mock().calls[0]?.model).toBe("claude-haiku-4-5-20251001");
  });

  test("strips code fences from response", async () => {
    mock().response = "```sh\nls -la\n```";
    const { stdout } = await captureStdout(async () => {
      await captureStderr(() =>
        run({ argv: ["-y", "list"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
      );
    });
    expect(stdout.trim()).toBe("ls -la");
  });

  test("--dry-run prints no command to stdout", async () => {
    mock().response = "ls -la";
    const { stdout, result } = await captureStdout(async () => {
      const { result: r } = await captureStderr(() =>
        run({ argv: ["--dry-run", "-y", "list"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
      );
      return r;
    });
    expect(result).toBe(0);
    expect(stdout).toBe("");
  });
});

describe("refusal & shape-check", () => {
  test("refuses on REFUSE: response", async () => {
    mock().response = "REFUSE: ambiguous";
    const { stderr, result } = await captureStderr(() =>
      run({ argv: ["-y", "do", "something"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(1);
    expect(stderr).toMatch(/refused|ambiguous/i);
  });

  test("refuses on prose response", async () => {
    mock().response = "I cannot help with that request.";
    const { result } = await captureStderr(() =>
      run({ argv: ["-y", "hack", "the", "planet"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(1);
  });

  test("refuses on empty response", async () => {
    mock().response = "";
    const { result } = await captureStderr(() =>
      run({ argv: ["-y", "hi"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(1);
  });
});

describe("error handling", () => {
  test("surfaces API errors cleanly", async () => {
    mock().throwOnCall = new Error("network down");
    const { stderr, result } = await captureStderr(() =>
      run({ argv: ["-y", "hi"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(1);
    expect(stderr).toMatch(/network down|API call failed/);
  });

  test("surfaces timeouts with exit 75", async () => {
    const err = new Error("timed out");
    err.name = "TimeoutError";
    mock().throwOnCall = err;
    const { result } = await captureStderr(() =>
      run({ argv: ["-y", "hi"], env: { ANTHROPIC_API_KEY: "sk-test" } }),
    );
    expect(result).toBe(75);
  });
});

describe("denylist integration", () => {
  test("blocks stdout when --dry-run hits a denylist match", async () => {
    mock().response = "sudo rm -rf /";
    const { stdout, stderr, result } = await captureStdout(async () => {
      const { stderr: e, result: r } = await captureStderr(() =>
        run({
          argv: ["--dry-run", "-y", "wipe everything"],
          env: { ANTHROPIC_API_KEY: "sk-test" },
        }),
      );
      return { stderr: e, result: r };
    }).then((x) => ({ stdout: x.stdout, stderr: x.result.stderr, result: x.result.result }));
    expect(result).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/DANGER|denylist|dangerous/i);
  });

  test("--unsafe bypasses denylist", async () => {
    mock().response = "sudo ls";
    const { stdout, result } = await captureStdout(async () => {
      const { result: r } = await captureStderr(() =>
        run({
          argv: ["--unsafe", "-y", "list"],
          env: { ANTHROPIC_API_KEY: "sk-test" },
        }),
      );
      return r;
    });
    expect(result).toBe(0);
    expect(stdout.trim()).toBe("sudo ls");
  });
});
