import { describe, expect, it } from "vitest";
import { __dimScreenTest } from "../src/dim.js";

const { dimStdoutText, splitCarry, EDITOR_TAG } = __dimScreenTest;

const ESC = "\x1b";
const FAINT_ON = `${ESC}[2m`;
const FG_RESET = `${ESC}[39m`;
const BG_RESET = `${ESC}[49m`;
const RESET_ALL = `${ESC}[0m`;
const INVISIBLE_FG = `${ESC}[38;2;10;10;10m`;
const INVISIBLE_BG = `${ESC}[48;2;10;10;10m`;
const BOLD_ON = `${ESC}[1m`;
const BOLD_OFF = `${ESC}[22m`;
const RED_FG = `${ESC}[38;2;255;0;0m`;

describe("splitCarry", () => {
  it("returns the whole string when there is no trailing partial escape", () => {
    const [head, carry] = splitCarry("hello world");
    expect(head).toBe("hello world");
    expect(carry).toBe("");
  });

  it("holds a trailing partial CSI sequence", () => {
    const [head, carry] = splitCarry(`hello${ESC}[38;2`);
    expect(head).toBe("hello");
    expect(carry).toBe(`${ESC}[38;2`);
  });

  it("holds a trailing bare ESC", () => {
    const [head, carry] = splitCarry("hello\x1b");
    expect(head).toBe("hello");
    expect(carry).toBe("\x1b");
  });

  it("holds a trailing partial OSC (hyperlink close)", () => {
    const [head, carry] = splitCarry(`text${ESC}]8;;`);
    expect(head).toBe("text");
    expect(carry).toBe(`${ESC}]8;;`);
  });

  it("holds a trailing partial APC (editor tag)", () => {
    const [head, carry] = splitCarry(`text${ESC}_dim`);
    expect(head).toBe("text");
    expect(carry).toBe(`${ESC}_dim`);
  });

  it("never holds a complete CSI sequence", () => {
    const [head, carry] = splitCarry(`text${RESET_ALL}`);
    expect(head).toBe(`text${RESET_ALL}`);
    expect(carry).toBe("");
  });

  it("never holds a complete editor tag (BEL terminator)", () => {
    const [head, carry] = splitCarry(`text${EDITOR_TAG}`);
    expect(head).toBe(`text${EDITOR_TAG}`);
    expect(carry).toBe("");
  });

  it("never holds a complete truecolor SGR with many semicolons", () => {
    const sgr = `${ESC}[38;2;10;10;10m`;
    const [head, carry] = splitCarry(`text${sgr}`);
    expect(head).toBe(`text${sgr}`);
    expect(carry).toBe("");
  });

  it("rejoins a carried partial with the next chunk", () => {
    const [, carry] = splitCarry(`hello${ESC}[38;2`);
    const rejoined = carry + ";255;0;0mworld";
    expect(rejoined).toBe(`${ESC}[38;2;255;0;0mworld`);
  });
});

describe("dimStdoutText", () => {
  it("wraps plain text in faint + invisible fg/bg with a hermetic reset", () => {
    const out = dimStdoutText("hello");
    expect(out).toBe(`${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}hello${RESET_ALL}`);
  });

  it("passes through editor-tagged segments bright with the tag stripped", () => {
    const line = `some ${RED_FG}colored${RESET_ALL} text`;
    const out = dimStdoutText(`${EDITOR_TAG}${line}`);
    expect(out).toBe(`${RESET_ALL}${line}`);
    expect(out).not.toContain(EDITOR_TAG);
  });

  it("re-arms dim after an embedded full reset", () => {
    const out = dimStdoutText(`before${RESET_ALL}after`);
    expect(out).toBe(
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}before${RESET_ALL}${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}after${RESET_ALL}`,
    );
  });

  it("re-arms dim after an fg reset (39m)", () => {
    const out = dimStdoutText(`a${FG_RESET}b`);
    expect(out).toBe(
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}a${FG_RESET}${FAINT_ON}${INVISIBLE_FG}b${RESET_ALL}`,
    );
  });

  it("re-arms dim after a bg reset (49m)", () => {
    const out = dimStdoutText(`a${BG_RESET}b`);
    expect(out).toBe(
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}a${BG_RESET}${FAINT_ON}${INVISIBLE_BG}b${RESET_ALL}`,
    );
  });

  it("re-arms dim after bold-off (22m), which also clears faint", () => {
    const out = dimStdoutText(`${BOLD_ON}a${BOLD_OFF}b`);
    expect(out).toBe(
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}${BOLD_ON}a${BOLD_OFF}${FAINT_ON}b${RESET_ALL}`,
    );
  });

  it("keeps explicitly colored spans inside the dim lane (last-wins SGR is re-armed)", () => {
    const out = dimStdoutText(`x${RED_FG}red${RESET_ALL}tail`);
    // The red SGR survives inside the span; the trailing reset re-arms dim.
    expect(out).toContain(`${RED_FG}red`);
    expect(
      out.endsWith(`${RESET_ALL}${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}tail${RESET_ALL}`),
    ).toBe(true);
  });

  it("keeps CUP row addresses byte-identical and dims the following text as one segment", () => {
    const cup = `${ESC}[5;10H`;
    const out = dimStdoutText(`a${cup}b`);
    const segment = (text: string) =>
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}${text}${RESET_ALL}`;
    // "a" dims alone; the CUP joins the following text's segment, still
    // byte-identical, with the dim prefix emitted before it.
    expect(out).toBe(`${segment("a")}${segment(`${cup}b`)}`);
  });

  it("flushes a pending CUP before the next segment when split parts intervene", () => {
    const cup1 = `${ESC}[1;1H`;
    const cup2 = `${ESC}[2;1H`;
    const out = dimStdoutText(`${cup1}${cup2}text`);
    const segment = (text: string) =>
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}${text}${RESET_ALL}`;
    // cup1 is flushed raw (byte-identical); cup2 leads the dimmed segment.
    expect(out).toBe(`${cup1}${segment(`${cup2}text`)}`);
  });

  it("splits segments at newlines so each line dims independently", () => {
    const out = dimStdoutText("one\ntwo");
    const segment = (text: string) =>
      `${FAINT_ON}${INVISIBLE_BG}${INVISIBLE_FG}${text}${RESET_ALL}`;
    expect(out).toBe(`${segment("one")}\n${segment("two")}`);
  });

  it("returns empty string for empty input", () => {
    expect(dimStdoutText("")).toBe("");
  });

  it("does not dim an editor-tagged empty segment", () => {
    expect(dimStdoutText(EDITOR_TAG)).toBe(`${RESET_ALL}`);
  });
});
