// Generates the seeded pi session the parrot capture drives.
// Usage: node seed-session.mjs <out.jsonl> <cwd>
//
// Regenerate before every parrot capture: pi appends to the session file it is
// given, so a seed that has been used once is no longer the committed shape.
import { writeFileSync } from "node:fs";

const [, , out, cwd] = process.argv;
const now = new Date().toISOString();

const assistantReply = `Here is the plan for the herdr pane-ownership guard.

## What changes

1. **Record the owner** when a pane is claimed, in a small state file.
2. **Refuse a write** from any session that is not the recorded owner.
3. **Release** the claim when the owning session ends.

## Why

Two pi sessions in one repo were fighting over the same herdr pane, so a
status update from one session overwrote the other's label. Recording the
owner makes the conflict visible instead of silent.

## Risks

- A stale claim survives a crash. The guard therefore also honours a TTL.
- Zellij and tmux panes are keyed differently, so the owner key includes the
  terminal multiplexer name.
`;

const lines = [
  JSON.stringify({
    type: "session",
    version: 3,
    id: "parrotseed01",
    timestamp: now,
    cwd,
  }),
  JSON.stringify({
    type: "message",
    id: "a1b2c3d4",
    parentId: null,
    timestamp: now,
    message: { role: "user", content: "plan the herdr pane-ownership guard" },
  }),
  JSON.stringify({
    type: "message",
    id: "b2c3d4e5",
    parentId: "a1b2c3d4",
    timestamp: now,
    message: {
      role: "assistant",
      content: [{ type: "text", text: assistantReply }],
      provider: "seed",
      model: "seed-1",
      usage: {
        input: 1200,
        output: 260,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 1460,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
    },
  }),
];

writeFileSync(out, lines.join("\n") + "\n", "utf-8");
console.log(`wrote ${out}`);
