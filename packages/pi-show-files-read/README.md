# @normful/pi-show-files-read

In-session file-read tracker for Pi coding agents. Monitors the agent's `read` tool activity and surfaces a convenient `/files-read` command so you can see exactly what files have been read in the current conversation.

<p align="center">
  <img src="https://media.githubusercontent.com/media/normful/pi-bakery/main/screenshots/files-read.png" alt="pi-show-files-read screenshot" width="800">
</p>

## Features

- **Automatic tracking** — Listens to `tool_result` events and captures any tool result matching the `read` pattern, recording the file path.
- **Deduplication** — If a file is read multiple times, only the first entry is kept.
- **Session-scoped** — Tracks are reset on each new session (`session_start`), so you always get a clean slate.
- **`/files-read` command** — Opens a modal listing every file read so far in read order. Paths are displayed relative to the working directory (prefixed with `./`) where possible.

## Installation

```bash
pi install npm:@normful/pi-show-files-read
```

## Usage

Pi tracks all `read` tool invocations in the background. At any point during a session, run:

```
/files-read
```

A modal will appear showing each file that has been read (e.g., `./src/index.ts`). If no files have been read, the modal will display a "No files have been read yet" message.

### Command reference

| Command       | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| `/files-read` | Display a modal listing all files read in the current session |
