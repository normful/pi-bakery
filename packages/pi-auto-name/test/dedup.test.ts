import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectExistingSessionNames, MAX_EXISTING_SESSION_NAMES } from "../src/dedup.js";

const { SessionManager } = vi.hoisted(() => ({ SessionManager: { list: vi.fn() } }));

vi.mock("@earendil-works/pi-coding-agent", () => ({ SessionManager }));

describe("collectExistingSessionNames", () => {
  beforeEach(() => {
    SessionManager.list.mockReset();
    SessionManager.list.mockResolvedValue([]);
  });

  it("returns names of the most recently modified other sessions, capped at 15", async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({
      path: `/sessions/s${i}.md`,
      name: `session-${i}`,
      modified: new Date(2026, 0, 1, 0, 0, i),
    }));
    SessionManager.list.mockResolvedValue(sessions);

    const titles = await collectExistingSessionNames("/project");

    expect(SessionManager.list).toHaveBeenCalledWith("/project");
    expect(titles).toHaveLength(MAX_EXISTING_SESSION_NAMES);
    // newest first
    expect(titles[0]).toBe("session-19");
    expect(titles[14]).toBe("session-5");
  });

  it("excludes the current session file", async () => {
    SessionManager.list.mockResolvedValue([
      { path: "/sessions/current.md", name: "current", modified: new Date() },
      { path: "/sessions/other.md", name: "other", modified: new Date() },
    ]);
    const titles = await collectExistingSessionNames("/project", "/sessions/current.md");
    expect(titles).toEqual(["other"]);
  });

  it("skips sessions without a name", async () => {
    SessionManager.list.mockResolvedValue([
      { path: "/sessions/a.md", modified: new Date(2026, 0, 1) },
      { path: "/sessions/b.md", name: "named", modified: new Date(2026, 0, 2) },
    ]);
    const titles = await collectExistingSessionNames("/project");
    expect(titles).toEqual(["named"]);
  });

  it("returns [] when there are no other sessions", async () => {
    SessionManager.list.mockResolvedValue([]);
    expect(await collectExistingSessionNames("/project")).toEqual([]);
  });
});
