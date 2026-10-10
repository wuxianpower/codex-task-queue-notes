# Codex Task Queue Notes

[中文说明](README.md)

**Turn scattered to-dos into a queue Codex can work through.** Write a note, drag to prioritize, then click **Run** to send it to the current conversation. Completed tasks are archived automatically.

Lightweight, bilingual, and stored locally. Great for breaking a project into focused steps and moving through them one at a time.

**Ready to try it?** Jump to the [GitHub installation steps](#install-from-github).

## Features

- Add, edit, and delete one-content-field task notes.
- Drag notes by the handle on the left to reorder them; active tasks are numbered automatically.
- Select **Run** to send a note as a user message to the current Codex conversation. Successfully sent tasks are archived at the bottom.
- Switch the interface between Chinese and English; the language preference is stored locally.
- Notes and their order stay on the local machine and are not synced across users or devices.

## Requirements

- A Codex client that supports local plugins and MCP Apps.
- Node.js available as `node` on `PATH`. No npm dependencies are required.

This package runs a local `stdio` MCP server. It is designed for local Codex clients and is not a hosted remote MCP service.

## Install from GitHub

Use this directory as the root of a GitHub repository, then run:

```bash
codex plugin marketplace add https://github.com/97ming/codex-task-queue-notes.git
codex plugin add codex-task-queue-spike@task-queue-spike-local
```

Restart Codex after installation, then call `open_task_queue_board` in a conversation to open the notes board.

After updating the repository, refresh the marketplace and reinstall the plugin:

```bash
codex plugin marketplace upgrade task-queue-spike-local
codex plugin add codex-task-queue-spike@task-queue-spike-local
```

## Usage

1. Call `open_task_queue_board` to open the task notes.
2. Add a task in the field at the top. Press Enter to add it or Shift+Enter for a new line.
3. Click a note to edit it; drag the handle on the left to reorder it.
4. Select **Run** to send a task to the current conversation. Successfully sent tasks move to the archive section.
5. Select `EN` or `中文` at the right side of the header to switch the interface language.

On first launch, if no task file exists, the app creates three sample notes that ask for short confirmation strings. They do not ask Codex to modify files.

## Data and privacy

- The default data file is `~/.codex/task-queue-spike/tasks.json`. When `CODEX_HOME` is set, the file is stored under `$CODEX_HOME/task-queue-spike/tasks.json`.
- The queue is local. Each user or Codex environment has its own list.
- Selecting **Run** sends the note content as a user message to the current Codex conversation.
- The plugin does not connect to third-party services or write task data into the current project workspace.

## Local development

There are no npm dependencies. Run the included checks with:

```bash
node --check server.mjs
node verify.mjs
```

## Repository notes

- This repository root is also the plugin marketplace root; the marketplace catalog is at `.agents/plugins/marketplace.json`.
- The plugin runs a local `stdio` MCP server; each user stores notes in their own Codex home directory.
- No license file is included, so no permission to copy, modify, or redistribute the code has been granted.

## License

No license is declared yet. If you want others to reuse or redistribute the code, the repository owner should choose and add a license.
