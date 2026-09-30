import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    // `.rpiv/` holds local-only artifacts (handoffs, session notes) that are never
    // committed, so there is no reason to format or lint them.
    ignorePatterns: [".rpiv/**"],
  },
  test: {
    // `vp test` is a thin wrapper around vitest
    // See https://vitest.dev/config/
    passWithNoTests: true,
    pool: "threads",
    silent: true,
  },
});
