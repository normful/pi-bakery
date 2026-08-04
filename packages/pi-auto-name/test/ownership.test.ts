import { describe, it, expect } from "vitest";
import { canReplace, handleSessionInfoChanged } from "../src/ownership.js";
import { createState, type RenameState } from "../src/state.js";

describe("canReplace", () => {
  it("always allows replacing an unnamed session under either policy", () => {
    expect(canReplace(undefined, "always")).toBe(true);
    expect(canReplace(undefined, "never")).toBe(true);
  });

  it("'always' replaces any name", () => {
    expect(canReplace("Deliberate Name", "always")).toBe(true);
  });

  it("'never' only replaces unnamed sessions", () => {
    expect(canReplace("Anything", "never")).toBe(false);
  });
});

describe("handleSessionInfoChanged", () => {
  it("ignores the echo of our own rename", () => {
    const state = createState();
    state.lastAutoName = "our-name";
    handleSessionInfoChanged(state, "our-name", true);
    expect(state.autoRenameLocked).toBe(false);
  });

  it("latches the lock on an external rename when respectExternalRenames", () => {
    const state = createState();
    state.lastAutoName = "our-name";
    handleSessionInfoChanged(state, "external-name", true);
    expect(state.autoRenameLocked).toBe(true);
  });

  it("ignores external renames when respectExternalRenames is false", () => {
    const state = createState();
    state.lastAutoName = "our-name";
    handleSessionInfoChanged(state, "external-name", false);
    expect(state.autoRenameLocked).toBe(false);
  });

  it("lock is one-way: a later echo does not unlock", () => {
    const state: RenameState = { ...createState(), autoRenameLocked: true };
    handleSessionInfoChanged(state, "anything", true);
    expect(state.autoRenameLocked).toBe(true);
  });
});
