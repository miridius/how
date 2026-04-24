// Test preload — replaces the Anthropic SDK with a controllable mock BEFORE
// any test imports the real SDK. Tests set `mockResponse` to drive behaviour.

import { mock } from "bun:test";

type MockState = {
  response: string;
  stopReason: string;
  calls: Array<{ model: string; system: string; user: string; maxTokens: number }>;
  throwOnCall: Error | null;
};

const state: MockState = {
  response: "echo hello",
  stopReason: "end_turn",
  calls: [],
  throwOnCall: null,
};

// Expose globally so tests can manipulate. Bun's test env shares globals across
// preload and test files.
(globalThis as unknown as { __HOW_MOCK__: MockState }).__HOW_MOCK__ = state;

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mock(
        async (req: {
          model: string;
          system: string;
          max_tokens: number;
          messages: Array<{ content: string }>;
        }) => {
          if (state.throwOnCall) throw state.throwOnCall;
          state.calls.push({
            model: req.model,
            system: req.system,
            user: req.messages[0]?.content ?? "",
            maxTokens: req.max_tokens,
          });
          return {
            content: [{ type: "text", text: state.response }],
            stop_reason: state.stopReason,
          };
        },
      ),
    };
  },
}));

// Silence `which gum` probes during tests by default.
const originalSpawn = Bun.spawn;
// biome-ignore lint/suspicious/noExplicitAny: intentional variadic override
(Bun as any).spawn = (...args: any[]): unknown => {
  const first = args[0];
  const cmd = Array.isArray(first) ? first : first?.cmd;
  if (Array.isArray(cmd) && cmd[0] === "which" && cmd[1] === "gum") {
    return {
      exited: Promise.resolve(1),
      kill: () => {},
    };
  }
  // biome-ignore lint/suspicious/noExplicitAny: pass-through
  return (originalSpawn as any)(...args);
};
