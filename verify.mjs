#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [path.join(root, "server.mjs")], {
  stdio: ["pipe", "pipe", "pipe"]
});
const lines = createInterface({ input: server.stdout, crlfDelay: Infinity });
const responses = new Map();
let nextId = 1;

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id !== undefined) {
    const resolve = responses.get(message.id);
    if (resolve) {
      responses.delete(message.id);
      resolve(message);
    }
  }
});

function call(method, params = {}) {
  const id = nextId++;
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      responses.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 3000);
    responses.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  });
}

try {
  const initialized = await call("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "spike-verifier", version: "1.0.0" }
  });
  assert.equal(initialized.serverInfo.name, "codex-task-queue-spike");
  console.log("PASS initialize");

  const listed = await call("tools/list");
  assert.equal(listed.tools[0].name, "open_task_queue_board");
  assert.equal(listed.tools[0]._meta.ui.resourceUri, "ui://task-queue-spike/board-v14.html");
  assert.equal(listed.tools[0].annotations.readOnlyHint, true);
  assert.deepEqual(listed.tools[0]._meta["openai/ui"].entrypoints.map((item) => item.type), ["global", "thread"]);
  assert.equal(listed.tools[1].name, "save_task_queue");
  console.log("PASS tool metadata and UI entrypoints");

  const resource = await call("resources/read", { uri: "ui://task-queue-spike/board-v14.html" });
  assert.match(resource.contents[0].mimeType, /^text\/html;profile=mcp-app$/);
  assert.match(resource.contents[0].text, /ui\/message/);
  assert.match(resource.contents[0].text, /role: 'user'/);
  assert.match(resource.contents[0].text, /drag-handle/);
  assert.match(resource.contents[0].text, /dragover/);
  assert.match(resource.contents[0].text, /task-index/);
  assert.match(resource.contents[0].text, /task-preview/);
  assert.match(resource.contents[0].text, /task-editor/);
  assert.match(resource.contents[0].text, /save-edit/);
  assert.match(resource.contents[0].text, /new-content/);
  assert.match(resource.contents[0].text, /archive-badge/);
  assert.match(resource.contents[0].text, /archive-divider/);
  assert.match(resource.contents[0].text, /save_task_queue/);
  const inlineScript = resource.contents[0].text.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(inlineScript, "the MCP App should include its bridge script");
  new Function(inlineScript[1]);
  console.log("PASS sticky-note UI, drag handle, and message bridge");

  const opened = await call("tools/call", { name: "open_task_queue_board", arguments: {} });
  assert.ok(Array.isArray(opened.structuredContent.tasks));
  assert.ok(opened.structuredContent.tasks.every((task) => typeof task.content === "string" && typeof task.archived === "boolean"));
  console.log("PASS board tool returns saved task notes and archive state");
} finally {
  server.kill();
  await once(server, "exit").catch(() => {});
}
