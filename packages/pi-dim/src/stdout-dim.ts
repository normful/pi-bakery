import { state } from "./state.js";
import { splitCarry } from "./ansi.js";
import { dimStdoutText } from "./dim.js";
import { wrapEditorRender } from "./editor.js";
import { maybeMigrateTheme } from "./theme-patch.js";

function installStdoutDim() {
  try {
    if (state.savedStdoutWrite) return;
    state.savedStdoutWrite = process.stdout.write.bind(process.stdout);
    const orig = state.savedStdoutWrite;
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((
      chunk: string | Uint8Array,
      ...args: unknown[]
    ) => {
      const passthrough = (value: string | Uint8Array): boolean =>
        (orig as unknown as (...a: unknown[]) => boolean)(
          value as unknown as string,
          ...(args as unknown[]),
        );
      if (!state.dimActive) {
        if (state.stdoutCarry !== "") {
          const flushed = state.stdoutCarry;
          state.stdoutCarry = "";
          if (typeof chunk !== "string") {
            (orig as unknown as (...a: unknown[]) => boolean)(flushed);
            return passthrough(chunk);
          }
          return passthrough(flushed + chunk);
        }
        return passthrough(chunk);
      }
      maybeMigrateTheme();
      if (!state.patchedEditor) {
        state.wrapRetryTick++;
        if ((state.wrapRetryTick & 31) === 0) wrapEditorRender();
      }
      if (typeof chunk !== "string") {
        if (state.stdoutCarry !== "") {
          const flushed = state.stdoutCarry;
          state.stdoutCarry = "";
          (orig as unknown as (...a: unknown[]) => boolean)(flushed);
        }
        return passthrough(chunk);
      }
      const [head, carry] = splitCarry(state.stdoutCarry + chunk);
      state.stdoutCarry = carry;
      return passthrough(dimStdoutText(head));
    }) as typeof process.stdout.write;
  } catch {}
}

function uninstallStdoutDim() {
  const pending = state.stdoutCarry;
  state.stdoutCarry = "";
  try {
    if (state.savedStdoutWrite) {
      const orig = state.savedStdoutWrite;
      (process.stdout as unknown as { write: typeof process.stdout.write }).write =
        state.savedStdoutWrite;
      state.savedStdoutWrite = undefined;
      if (pending !== "") {
        try {
          orig(pending);
        } catch {}
      }
    } else if (pending !== "") {
      try {
        process.stdout.write(pending);
      } catch {}
    }
  } catch {}
}

export { installStdoutDim, uninstallStdoutDim };
