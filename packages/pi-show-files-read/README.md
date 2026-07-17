# @normful/pi-show-files-read

In-session file-read tracker for Pi coding agents. Monitors the agent's `read` tool activity and surfaces a convenient `/show-files-read` command so you can see exactly what files have been read in the current conversation.

## Features

- **Automatic tracking** — Listens to `tool_result` events and captures any tool result matching the `read` pattern, recording the file path and byte size.
- **Deduplication** — If a file is read multiple times, only the latest entry is kept (with an updated size).
- **Session-scoped** — Tracks are reset on each new session (`session_start`), so you always get a clean slate.
- **`/show-files-read` command** — Opens a modal listing every file read so far along with its on-disk size, sorted in read order. Paths are displayed relative to the working directory (prefixed with `./`) where possible.

## Installation

```bash
npm install @normful/pi-show-files-read
```

The extension is loaded automatically by Pi when declared in your Pi configuration.

## Usage

Once installed, Pi will track all `read` tool invocations in the background. At any point during a session, run:

```
/show-files-read
```

A modal will appear showing each file that has been read, along with its size (e.g., `./src/index.ts (4.2kB)`). If no files have been read, the modal will display a "No files have been read yet" message.

### Command reference

| Command            | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `/show-files-read` | Display a modal listing all files read in the current session |

## How it works

The extension registers a `tool_result` listener that checks every tool result with `isReadToolResult()`. When a match is found, it extracts the file `path` from the original input and calculates the total text size (in bytes) from the result content. Results are stored in an in-memory array that persists for the duration of the session.

The `/show-files-read` command simply formats this array and presents it via `show_text_modal()`.

## Keywords

`pi-extension` `pi-package` `developer-tools` `file-tracking`
