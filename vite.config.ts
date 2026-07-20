import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [],
  },
  test: {
    // `vp test` is a thin wrapper around vitest
    // See https://vitest.dev/config/
    passWithNoTests: true,
    pool: "threads",
    silent: true,
  },
});
