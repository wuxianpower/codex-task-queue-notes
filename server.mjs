#!/usr/bin/env node

import { createInterface } from "node:readline";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const VERSION = "0.3.9";
const APP_URI = "ui://task-queue-spike/board-v14.html";
const CODEX_HOME = process.env.CODEX_HOME || join(homedir(), ".codex");
const TASKS_FILE = join(CODEX_HOME, "task-queue-spike", "tasks.json");
const TEST_PROMPT = "集成验证：请只回复 TASK_QUEUE_SPIKE_OK，不要修改任何文件。";

const DEFAULT_TASKS = [
  { id: "message-bridge-check", content: TEST_PROMPT, archived: false },
  { id: "sticky-order-a", content: "排序示例 A：请只回复 STICKY_ORDER_A_OK，不要修改任何文件。", archived: false },
  { id: "sticky-order-b", content: "排序示例 B：请只回复 STICKY_ORDER_B_OK，不要修改任何文件。", archived: false }
];

function normalizeTasks(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("任务列表格式无效，最多支持 100 条便签。");
  }

  const seen = new Set();
  const normalized = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("第 " + (index + 1) + " 条便签格式无效。");
    }
    const id = typeof item.id === "string" ? item.id.trim() : "";
    let content = typeof item.content === "string" ? item.content.trim() : "";

    // Migrate the earlier title + prompt format into a single editable content field.
    if (!content) {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
      content = title && prompt && title !== prompt ? title + "\n" + prompt : (prompt || title);
    }

    if (!id || !content || content.length > 5000 || seen.has(id)) {
      throw new Error("便签内容或 ID 无效。");
    }
    seen.add(id);
    return { id, content, archived: item.archived === true };
  });
  return normalized.filter((task) => !task.archived).concat(normalized.filter((task) => task.archived));
}

async function readTasks() {
  try {
    return normalizeTasks(JSON.parse(await readFile(TASKS_FILE, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return DEFAULT_TASKS.map((task) => ({ ...task }));
    throw new Error("无法读取本地任务便签：" + error.message);
  }
}

async function writeTasks(tasks) {
  const safeTasks = normalizeTasks(tasks);
  const directory = dirname(TASKS_FILE);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = TASKS_FILE + ".tmp-" + process.pid;
  await writeFile(temporaryPath, JSON.stringify(safeTasks, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryPath, TASKS_FILE);
  return safeTasks;
}

let taskQueue = await readTasks();

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function createBoardHtml(initialTasks) {
  const appScript = [
    "const initialTasks = " + scriptJson(initialTasks) + ";",
    "const pending = new Map();",
    "let nextRequestId = 1;",
    "let tasks = initialTasks.map((task) => ({ ...task }));",
    "let draggedId = null;",
    "let editingId = null;",
    "",
    "const list = document.getElementById('task-list');",
    "const count = document.getElementById('task-count');",
    "const empty = document.getElementById('empty-state');",
    "const status = document.getElementById('board-status');",
    "const form = document.getElementById('new-task-form');",
    "const contentInput = document.getElementById('new-content');",
    "const languageToggle = document.getElementById('language-toggle');",
    "const messages = {",
    "  zh: { title: '任务便签', countUnit: '条', placeholder: '写下一项任务（回车添加，Shift+回车换行）', newTask: '新任务内容', add: '＋ 添加便签', empty: '还没有任务，先添加一张便签。', ready: '回车确认；Shift+回车换行。点击已有便签可编辑。', switchLanguage: '切换到英文', drag: '拖动调整任务顺序', dragTitle: '按住拖动调整顺序', archivedDivider: '已归档 · {count}', editTask: '编辑第 {index} 条任务', editPreview: '点击编辑第 {index} 条任务', save: '保存', cancel: '取消', saveTask: '保存任务内容', cancelEdit: '取消编辑', run: '运行', runTask: '运行第 {index} 条任务', archived: '已归档', deleteTask: '删除第 {index} 条任务', bridgeError: '消息通路初始化失败：{message}', bridgeUnavailable: 'MCP Apps 消息通路不可用', hostNoResponse: '宿主没有响应 {method}', saveFailedDefault: '保存便签失败', savingOrder: '正在保存新顺序…', savedOrder: '顺序已保存。', orderFailed: '保存顺序失败：{message}', editCanceled: '已取消编辑。', emptyContent: '便签内容不能为空。', savingNote: '正在保存便签…', savedNote: '便签已保存。', saveFailed: '保存失败：{message}', sending: '正在发送到当前对话…', sentArchiving: '任务已发送，正在归档到列表底部…', sentArchived: '任务已发送并归档到列表底部。', archiveSaveFailed: '任务已发送并移到底部，但归档状态保存失败：{message}', sendFailed: '发送失败：{message}', savingDelete: '正在保存便签…', deleted: '便签已删除。', deleteFailed: '删除失败：{message}', savingAdd: '正在保存新便签…', added: '便签已添加。', addFailed: '添加失败：{message}' },",
    "  en: { title: 'Task notes', countUnit: 'tasks', placeholder: 'Write a task (Enter to add, Shift+Enter for a new line)', newTask: 'New task', add: '+ Add note', empty: 'No tasks yet. Add a note to get started.', ready: 'Press Enter to confirm; Shift+Enter for a new line. Click a note to edit it.', switchLanguage: 'Switch to Chinese', drag: 'Drag to reorder tasks', dragTitle: 'Hold and drag to change the order', archivedDivider: 'Archived · {count}', editTask: 'Edit task {index}', editPreview: 'Click to edit task {index}', save: 'Save', cancel: 'Cancel', saveTask: 'Save task content', cancelEdit: 'Cancel editing', run: 'Run', runTask: 'Run task {index}', archived: 'Archived', deleteTask: 'Delete task {index}', bridgeError: 'Could not initialize the message bridge: {message}', bridgeUnavailable: 'MCP Apps message bridge is unavailable', hostNoResponse: 'Host did not respond to {method}', saveFailedDefault: 'Could not save notes', savingOrder: 'Saving the new order…', savedOrder: 'Order saved.', orderFailed: 'Could not save the order: {message}', editCanceled: 'Editing canceled.', emptyContent: 'Note content cannot be empty.', savingNote: 'Saving note…', savedNote: 'Note saved.', saveFailed: 'Could not save the note: {message}', sending: 'Sending to the current conversation…', sentArchiving: 'Task sent. Moving it to the bottom of the archived list…', sentArchived: 'Task sent and archived at the bottom of the list.', archiveSaveFailed: 'Task sent and moved to the bottom, but the archive status could not be saved: {message}', sendFailed: 'Could not send the task: {message}', savingDelete: 'Saving note…', deleted: 'Note deleted.', deleteFailed: 'Could not delete the note: {message}', savingAdd: 'Saving new note…', added: 'Note added.', addFailed: 'Could not add the note: {message}' }",
    "};",
    "function loadLanguage() { try { return window.localStorage.getItem('task-queue-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } }",
    "let language = loadLanguage();",
    "let boardStatusState = { key: 'ready', values: {} };",
    "function text(key, values = {}) { const template = messages[language][key] || messages.zh[key] || key; return template.replace(/\\{(\\w+)\\}/g, (_, name) => String(values[name] ?? '')); }",
    "function setBoardStatus(key, values = {}) { boardStatusState = { key, values }; status.textContent = text(key, values); }",
    "function applyLanguage() {",
    "  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';",
    "  document.getElementById('board-title').textContent = text('title');",
    "  document.getElementById('task-count-unit').textContent = text('countUnit');",
    "  list.setAttribute('aria-label', language === 'en' ? 'Task list' : '任务列表');",
    "  contentInput.placeholder = text('placeholder');",
    "  contentInput.setAttribute('aria-label', text('newTask'));",
    "  form.querySelector('.add-button').textContent = text('add');",
    "  empty.textContent = text('empty');",
    "  languageToggle.textContent = language === 'zh' ? 'EN' : '中文';",
    "  languageToggle.setAttribute('aria-label', text('switchLanguage'));",
    "  languageToggle.title = text('switchLanguage');",
    "  status.textContent = text(boardStatusState.key, boardStatusState.values);",
    "  tasks.forEach((task, index) => {",
    "    const note = Array.from(list.querySelectorAll('.task-note')).find((item) => item.dataset.id === task.id);",
    "    if (!note) return;",
    "    const handle = note.querySelector('.drag-handle');",
    "    handle.setAttribute('aria-label', text('drag')); handle.title = text('dragTitle');",
    "    const preview = note.querySelector('.task-preview');",
    "    if (preview) preview.setAttribute('aria-label', text('editPreview', { index: index + 1 }));",
    "    const editor = note.querySelector('.task-editor');",
    "    if (editor) editor.setAttribute('aria-label', text('editTask', { index: index + 1 }));",
    "    const save = note.querySelector('.edit-save'); if (save) { save.textContent = text('save'); save.setAttribute('aria-label', text('saveTask')); }",
    "    const cancel = note.querySelector('.edit-cancel'); if (cancel) { cancel.textContent = text('cancel'); cancel.setAttribute('aria-label', text('cancelEdit')); }",
    "    const run = note.querySelector('.run-button'); if (run) { run.textContent = text(task.archived ? 'archived' : 'run'); run.setAttribute('aria-label', text('runTask', { index: index + 1 })); }",
    "    const remove = note.querySelector('.delete-button'); if (remove) remove.setAttribute('aria-label', text('deleteTask', { index: index + 1 }));",
    "    const badge = note.querySelector('.archive-badge'); if (badge) badge.textContent = text('archived');",
    "    const taskStatus = note.querySelector('.task-status');",
    "    if (taskStatus && !taskStatus.hidden && taskStatus.dataset.i18nKey) taskStatus.textContent = text(taskStatus.dataset.i18nKey, { message: taskStatus.dataset.error || '' });",
    "  });",
    "  list.querySelectorAll('.archive-divider').forEach((divider) => { divider.textContent = text('archivedDivider', { count: divider.dataset.count }); });",
    "}",
    "languageToggle.addEventListener('click', () => {",
    "  language = language === 'zh' ? 'en' : 'zh';",
    "  try { window.localStorage.setItem('task-queue-language', language); } catch {}",
    "  applyLanguage();",
    "});",
    "",
    "function sortTaskQueue(items) {",
    "  return items.filter((task) => !task.archived).concat(items.filter((task) => task.archived));",
    "}",
    "",
    "function rpcRequest(method, params, timeoutMs = 10000) {",
    "  const id = nextRequestId++;",
    "  return new Promise((resolve, reject) => {",
    "    const timeout = setTimeout(() => {",
    "      pending.delete(id);",
    "      reject(new Error(text('hostNoResponse', { method })));",
    "    }, timeoutMs);",
    "    pending.set(id, {",
    "      resolve(value) { clearTimeout(timeout); resolve(value); },",
    "      reject(error) { clearTimeout(timeout); reject(error); }",
    "    });",
    "    try {",
    "      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');",
    "    } catch (error) {",
    "      clearTimeout(timeout);",
    "      pending.delete(id);",
    "      reject(error);",
    "    }",
    "  });",
    "}",
    "",
    "window.addEventListener('message', (event) => {",
    "  if (event.source !== window.parent) return;",
    "  const message = event.data;",
    "  if (!message || message.jsonrpc !== '2.0') return;",
    "  if (message.id !== undefined && pending.has(message.id)) {",
    "    const entry = pending.get(message.id);",
    "    pending.delete(message.id);",
    "    if (message.error) entry.reject(new Error(message.error.message || text('hostNoResponse', { method: 'request' })));",
    "    else entry.resolve(message.result);",
    "  }",
    "});",
    "",
    "async function initializeBridge() {",
    "  await rpcRequest('ui/initialize', {",
    "    protocolVersion: '2026-01-26',",
    "    appInfo: { name: 'codex-task-queue-spike', version: '" + VERSION + "' },",
    "    appCapabilities: {}",
    "  });",
    "  window.parent.postMessage({",
    "    jsonrpc: '2.0',",
    "    method: 'ui/notifications/initialized',",
    "    params: {}",
    "  }, '*');",
    "}",
    "const bridgeReady = initializeBridge().catch((error) => {",
    "  setBoardStatus('bridgeError', { message: error.message });",
    "  return false;",
    "});",
    "",
    "async function callServerTool(name, args) {",
    "  if ((await bridgeReady) === false) throw new Error(text('bridgeUnavailable'));",
    "  const response = await rpcRequest('tools/call', { name, arguments: args });",
    "  if (response && response.isError) {",
    "    const detail = response.content && response.content[0] && response.content[0].text;",
    "    const safeDetail = language === 'en' && detail && /[\\u3400-\\u9fff]/.test(detail) ? text('saveFailedDefault') : detail;",
    "    throw new Error(safeDetail || text('saveFailedDefault'));",
    "  }",
    "  return response;",
    "}",
    "",
    "async function saveQueue() {",
    "  tasks = sortTaskQueue(tasks);",
    "  const response = await callServerTool('save_task_queue', { tasks });",
    "  if (response && response.structuredContent && Array.isArray(response.structuredContent.tasks)) {",
    "    tasks = response.structuredContent.tasks;",
    "  }",
    "}",
    "",
    "function makeButton(label, className, action, ariaLabel) {",
    "  const button = document.createElement('button');",
    "  button.type = 'button';",
    "  button.className = className;",
    "  button.dataset.action = action;",
    "  button.textContent = label;",
    "  if (ariaLabel) button.setAttribute('aria-label', ariaLabel);",
    "  return button;",
    "}",
    "",
    "function fitEditor(editor) {",
    "  editor.style.height = 'auto';",
    "  editor.style.height = Math.min(Math.max(editor.scrollHeight, 38), 240) + 'px';",
    "}",
    "",
    "function render() {",
    "  tasks = sortTaskQueue(tasks);",
    "  list.replaceChildren();",
    "  count.textContent = String(tasks.filter((task) => !task.archived).length);",
    "  empty.hidden = tasks.length > 0;",
    "  let activeNumber = 0;",
    "  let archiveDividerAdded = false;",
    "  tasks.forEach((task, index) => {",
    "    if (task.archived && !archiveDividerAdded) {",
    "      const divider = document.createElement('div');",
    "      divider.className = 'archive-divider';",
    "      divider.dataset.count = String(tasks.filter((item) => item.archived).length);",
    "      divider.textContent = text('archivedDivider', { count: divider.dataset.count });",
    "      list.append(divider);",
    "      archiveDividerAdded = true;",
    "    }",
    "    const note = document.createElement('article');",
    "    note.className = 'task-note' + (task.archived ? ' archived' : '');",
    "    note.dataset.id = task.id;",
    "",
    "    const isEditing = editingId === task.id;",
    "    const handle = makeButton('⠿', 'drag-handle', 'drag', text('drag'));",
    "    handle.setAttribute('aria-label', text('drag'));",
    "    handle.draggable = editingId === null;",
    "    handle.title = text('dragTitle');",
    "",
    "    const number = document.createElement('span');",
    "    number.className = 'task-index' + (task.archived ? ' archived-index' : '');",
    "    if (task.archived) {",
    "      number.textContent = '✓';",
    "    } else {",
    "      activeNumber += 1;",
    "      number.textContent = String(activeNumber).padStart(2, '0');",
    "    }",
    "",
    "    let content;",
    "    if (isEditing) {",
    "      content = document.createElement('div');",
    "      content.className = 'editor-wrap';",
    "      const editor = document.createElement('textarea');",
    "      editor.className = 'task-editor';",
    "      editor.value = task.content;",
    "      editor.maxLength = 5000;",
    "      editor.rows = Math.max(1, Math.min(6, task.content.split('\\n').length));",
    "      requestAnimationFrame(() => fitEditor(editor));",
    "      editor.setAttribute('aria-label', text('editTask', { index: index + 1 }));",
    "      const editActions = document.createElement('div');",
    "      editActions.className = 'edit-actions';",
    "      editActions.append(",
    "        makeButton(text('save'), 'edit-save', 'save-edit', text('saveTask')),",
    "        makeButton(text('cancel'), 'edit-cancel', 'cancel-edit', text('cancelEdit'))",
    "      );",
    "      content.append(editor, editActions);",
    "    } else {",
    "      content = makeButton(task.content, 'task-preview', 'edit', text('editPreview', { index: index + 1 }));",
    "    }",
    "",
    "    const actions = document.createElement('div');",
    "    actions.className = 'task-actions';",
    "    const run = makeButton(text(task.archived ? 'archived' : 'run'), 'run-button', 'run', text('runTask', { index: index + 1 }));",
    "    const remove = makeButton('×', 'delete-button', 'delete', text('deleteTask', { index: index + 1 }));",
    "    run.disabled = isEditing || task.archived;",
    "    remove.disabled = isEditing;",
    "    if (task.archived) {",
    "      const badge = document.createElement('span');",
    "      badge.className = 'archive-badge';",
    "      badge.textContent = text('archived');",
    "      actions.append(badge, remove);",
    "    } else {",
    "      actions.append(run, remove);",
    "    }",
    "",
    "    const taskStatus = document.createElement('p');",
    "    taskStatus.className = 'task-status';",
    "    taskStatus.hidden = true;",
    "    taskStatus.setAttribute('role', 'status');",
    "    note.append(handle, number, content, actions, taskStatus);",
    "    list.append(note);",
    "  });",
    "  contentInput.disabled = editingId !== null;",
    "  form.querySelector('.add-button').disabled = editingId !== null;",
    "}",
    "",
    "function makeId() {",
    "  return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);",
    "}",
    "",
    "function clearDropMarks() {",
    "  list.querySelectorAll('.drop-before, .drop-after').forEach((item) => {",
    "    item.classList.remove('drop-before', 'drop-after');",
    "    delete item.dataset.dropSide;",
    "  });",
    "}",
    "",
    "list.addEventListener('dragstart', (event) => {",
    "  const handle = event.target.closest('.drag-handle');",
    "  const note = handle && handle.closest('.task-note');",
    "  if (!note) { event.preventDefault(); return; }",
    "  draggedId = note.dataset.id;",
    "  event.dataTransfer.effectAllowed = 'move';",
    "  event.dataTransfer.setData('text/plain', draggedId);",
    "  requestAnimationFrame(() => note.classList.add('dragging'));",
    "});",
    "",
    "list.addEventListener('dragover', (event) => {",
    "  const target = event.target.closest('.task-note');",
    "  if (!draggedId || !target || target.dataset.id === draggedId) return;",
    "  const sourceTask = tasks.find((task) => task.id === draggedId);",
    "  const targetTask = tasks.find((task) => task.id === target.dataset.id);",
    "  if (!sourceTask || !targetTask || sourceTask.archived !== targetTask.archived) return;",
    "  event.preventDefault();",
    "  event.dataTransfer.dropEffect = 'move';",
    "  clearDropMarks();",
    "  const rect = target.getBoundingClientRect();",
    "  const after = event.clientY > rect.top + rect.height / 2;",
    "  target.dataset.dropSide = after ? 'after' : 'before';",
    "  target.classList.add(after ? 'drop-after' : 'drop-before');",
    "});",
    "",
    "list.addEventListener('drop', async (event) => {",
    "  const target = event.target.closest('.task-note');",
    "  if (!draggedId || !target) return;",
    "  event.preventDefault();",
    "  const sourceIndex = tasks.findIndex((task) => task.id === draggedId);",
    "  const targetIndex = tasks.findIndex((task) => task.id === target.dataset.id);",
    "  const sourceTask = tasks[sourceIndex];",
  "  const targetTask = tasks[targetIndex];",
    "  const after = target.dataset.dropSide === 'after';",
    "  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex || sourceTask.archived !== targetTask.archived) {",
    "    clearDropMarks();",
    "    return;",
    "  }",
    "  const previous = tasks;",
    "  const next = tasks.slice();",
    "  const moved = next.splice(sourceIndex, 1)[0];",
    "  let insertionIndex = targetIndex + (after ? 1 : 0);",
    "  if (sourceIndex < insertionIndex) insertionIndex -= 1;",
    "  next.splice(insertionIndex, 0, moved);",
    "  tasks = next;",
    "  clearDropMarks();",
    "  render();",
    "  setBoardStatus('savingOrder');",
    "  try {",
    "    await saveQueue();",
    "    render();",
    "    setBoardStatus('savedOrder');",
    "  } catch (error) {",
    "    tasks = previous;",
    "    render();",
    "    setBoardStatus('orderFailed', { message: error.message });",
    "  }",
    "});",
    "",
    "list.addEventListener('dragend', () => {",
    "  draggedId = null;",
    "  clearDropMarks();",
    "  list.querySelectorAll('.dragging').forEach((item) => item.classList.remove('dragging'));",
    "});",
    "",
    "list.addEventListener('input', (event) => {",
    "  const editor = event.target.closest('.task-editor');",
    "  if (editor) fitEditor(editor);",
    "});",
    "",
    "list.addEventListener('keydown', (event) => {",
    "  const editor = event.target.closest('.task-editor');",
    "  if (!editor || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;",
    "  event.preventDefault();",
    "  const note = editor.closest('.task-note');",
    "  const saveButton = note && note.querySelector('.edit-save');",
    "  if (saveButton) saveButton.click();",
    "});",
    "",
    "list.addEventListener('click', async (event) => {",
    "  const button = event.target.closest('button[data-action]');",
    "  const note = button && button.closest('.task-note');",
    "  if (!button || !note) return;",
    "  const task = tasks.find((item) => item.id === note.dataset.id);",
    "  if (!task) return;",
    "  if (button.dataset.action === 'edit') {",
    "    editingId = task.id;",
    "    render();",
    "    const editor = list.querySelector('.task-editor');",
    "    if (editor) { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); }",
    "    return;",
    "  }",
    "  if (button.dataset.action === 'cancel-edit') {",
    "    editingId = null;",
    "    render();",
    "    setBoardStatus('editCanceled');",
    "    return;",
    "  }",
    "  if (button.dataset.action === 'save-edit') {",
    "    const editor = note.querySelector('.task-editor');",
    "    const content = editor ? editor.value.trim() : '';",
    "    if (!content) { setBoardStatus('emptyContent'); if (editor) editor.focus(); return; }",
    "    const previous = task.content;",
    "    task.content = content;",
    "    setBoardStatus('savingNote');",
    "    try {",
    "      await saveQueue();",
    "      editingId = null;",
    "      render();",
    "      setBoardStatus('savedNote');",
    "    } catch (error) {",
    "      task.content = previous;",
    "      setBoardStatus('saveFailed', { message: error.message });",
    "    }",
    "    return;",
    "  }",
    "  const taskStatus = note.querySelector('.task-status');",
    "  if (button.dataset.action === 'run') {",
    "    button.disabled = true;",
    "    taskStatus.hidden = false;",
    "    taskStatus.dataset.i18nKey = 'sending';",
    "    taskStatus.textContent = text('sending');",
    "    try {",
    "      if ((await bridgeReady) === false) throw new Error(text('bridgeUnavailable'));",
    "      await rpcRequest('ui/message', {",
    "        role: 'user',",
    "        content: [{ type: 'text', text: task.content }]",
    "      });",
    "      task.archived = true;",
    "      tasks = sortTaskQueue(tasks);",
    "      render();",
    "      setBoardStatus('sentArchiving');",
    "      try {",
    "        await saveQueue();",
    "        render();",
    "        setBoardStatus('sentArchived');",
    "      } catch (saveError) {",
    "        setBoardStatus('archiveSaveFailed', { message: saveError.message });",
    "      }",
    "    } catch (error) {",
    "      taskStatus.dataset.i18nKey = 'sendFailed';",
    "      taskStatus.dataset.error = error.message;",
    "      taskStatus.textContent = text('sendFailed', { message: error.message });",
    "    } finally {",
    "      button.disabled = false;",
    "    }",
    "    return;",
    "  }",
    "  if (button.dataset.action === 'delete') {",
    "    const previous = tasks;",
    "    tasks = tasks.filter((item) => item.id !== task.id);",
    "    render();",
    "    setBoardStatus('savingDelete');",
    "    try {",
    "      await saveQueue();",
    "      render();",
    "      setBoardStatus('deleted');",
    "    } catch (error) {",
    "      tasks = previous;",
    "      render();",
    "      setBoardStatus('deleteFailed', { message: error.message });",
    "    }",
    "  }",
    "});",
    "",
    "form.addEventListener('submit', async (event) => {",
    "  event.preventDefault();",
    "  const content = contentInput.value.trim();",
    "  if (!content) { contentInput.focus(); return; }",
    "  const previous = tasks;",
    "  tasks = tasks.concat([{ id: makeId(), content, archived: false }]);",
    "  render();",
    "  form.reset();",
    "  setBoardStatus('savingAdd');",
    "  try {",
    "    await saveQueue();",
    "    render();",
    "    setBoardStatus('added');",
    "  } catch (error) {",
    "    tasks = previous;",
    "    render();",
    "    setBoardStatus('addFailed', { message: error.message });",
    "  }",
    "});",
    "",
    "contentInput.addEventListener('keydown', (event) => {",
    "  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;",
    "  event.preventDefault();",
    "  form.requestSubmit();",
    "});",
    "",
    "applyLanguage();",
    "render();",
    "setBoardStatus('ready');"
  ].join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"zh-CN\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "  <title>任务便签</title>",
    "  <style>",
    "    :root { color-scheme: light; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; padding: 18px; color: #202123; background: #fff; }",
    "    main { width: min(100%, 720px); margin: 0 auto; }",
    "    .heading { display: flex; justify-content: space-between; align-items: end; gap: 14px; margin: 0 0 15px; }",
    "    .eyebrow { margin: 0 0 4px; color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }",
    "    h1 { margin: 0; color: #202123; font-size: 24px; line-height: 1.15; }",
    "    .heading-actions { display: flex; align-items: center; gap: 7px; }",
    "    .count { padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 999px; color: #4b5563; background: #f9fafb; font-size: 12px; white-space: nowrap; }",
    "    .language-toggle { min-width: 42px; height: 28px; padding: 0 8px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; background: #fff; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }",
    "    .language-toggle:hover { border-color: #9ca3af; background: #f9fafb; }",
    "    .composer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin: 0 0 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb; }",
    "    .composer textarea { width: 100%; min-height: 58px; resize: vertical; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 10px; color: #202123; background: #fff; font: inherit; }",
    "    .add-button { grid-column: 2; grid-row: 1; align-self: stretch; padding: 0 15px; border: 0; border-radius: 9px; color: #fff; background: #2563eb; font: inherit; font-weight: 650; cursor: pointer; }",
    "    .add-button:hover, .run-button:hover { background: #1d4ed8; }",
    "    .task-list { display: flex; flex-direction: column; gap: 9px; }",
    "    .task-note { display: grid; grid-template-columns: 26px 30px minmax(0, 1fr) auto; align-items: center; gap: 6px; min-height: 0; padding: 5px 8px 4px 5px; border: 1px solid #e5e7eb; border-radius: 9px; background: #f9fafb; transition: opacity .12s, border-color .12s, background .12s; }",
    "    .task-note.archived { border-color: #e5e7eb; background: #f3f4f6; }",
    "    .task-note.dragging { opacity: .42; }",
    "    .task-note.drop-before { border-top: 3px solid #2563eb; }",
    "    .task-note.drop-after { border-bottom: 3px solid #2563eb; }",
    "    .drag-handle { width: 25px; height: 28px; padding: 0; border: 0; border-radius: 6px; color: #9ca3af; background: transparent; font-size: 21px; line-height: 1; cursor: grab; user-select: none; -webkit-user-select: none; }",
    "    .drag-handle:hover { color: #4b5563; background: #e5e7eb; }",
    "    .drag-handle:active { cursor: grabbing; }",
    "    .task-index { color: #9ca3af; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 700; text-align: center; }",
    "    .task-index.archived-index { color: #9ca3af; font-size: 15px; }",
    "    .archive-divider { display: flex; align-items: center; gap: 10px; margin: 7px 2px 2px; color: #6b7280; font-size: 11px; font-weight: 650; }",
    "    .archive-divider::before, .archive-divider::after { content: ''; flex: 1; height: 1px; background: #d1d5db; }",
    "    .archive-badge { padding: 3px 7px; border-radius: 999px; color: #6b7280; background: #e5e7eb; font-size: 10px; white-space: nowrap; }",
    "    .task-preview { display: block; width: 100%; min-height: 0; padding: 3px 7px; border: 1px solid transparent; border-radius: 7px; color: #202123; background: transparent; font: inherit; line-height: 1.4; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: text; }",
    "    .task-preview:hover { border-color: #e5e7eb; background: #fff; }",
    "    .task-preview:focus { outline: 2px solid #2563eb55; border-color: #2563eb; background: #fff; }",
    "    .editor-wrap { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }",
    "    .task-editor { width: 100%; min-height: 38px; padding: 5px 8px; resize: vertical; border: 1px solid #2563eb; border-radius: 7px; color: #202123; background: #fff; font: inherit; line-height: 1.4; outline: 2px solid #2563eb33; }",
    "    .edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 3px; }",
    "    .edit-save, .edit-cancel { padding: 6px 10px; border-radius: 7px; font: inherit; font-size: 12px; cursor: pointer; }",
    "    .edit-save { border: 0; color: #fff; background: #2563eb; }",
    "    .edit-save:hover { background: #1d4ed8; }",
    "    .edit-cancel { border: 1px solid #d1d5db; color: #4b5563; background: #fff; }",
    "    .task-actions { display: flex; align-items: center; gap: 5px; }",
    "    .run-button { padding: 5px 9px; border: 0; border-radius: 7px; color: #fff; background: #2563eb; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }",
    "    .run-button:disabled { opacity: .55; cursor: wait; }",
    "    .delete-button { width: 26px; height: 26px; border: 0; border-radius: 7px; color: #6b7280; background: transparent; font: inherit; font-size: 18px; cursor: pointer; }",
    "    .delete-button:hover { color: #b42318; background: #fee4e2; }",
    "    .task-status { grid-column: 3 / 5; min-height: 0; margin: 0; color: #6b7280; font-size: 11px; }",
    "    .task-status[hidden] { display: none; }",
    "    .empty-state { margin: 8px 0; padding: 22px 14px; border: 1px dashed #d1d5db; border-radius: 12px; color: #6b7280; text-align: center; background: #f9fafb; }",
    "    #board-status { min-height: 20px; margin: 10px 2px 0; color: #6b7280; font-size: 12px; }",
    "    @media (max-width: 520px) { body { padding: 12px; } .composer { grid-template-columns: minmax(0, 1fr); } .add-button { grid-column: 1; grid-row: 2; min-height: 38px; } .task-note { grid-template-columns: 28px 29px minmax(0, 1fr); gap: 5px; padding-right: 8px; } .task-actions { grid-column: 3; justify-content: end; } .task-status { grid-column: 3 / 4; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header class=\"heading\">",
    "      <div><p class=\"eyebrow\">Codex task notes</p><h1 id=\"board-title\">任务便签</h1></div>",
    "      <div class=\"heading-actions\"><span class=\"count\"><span id=\"task-count\">0</span> <span id=\"task-count-unit\">条</span></span><button id=\"language-toggle\" class=\"language-toggle\" type=\"button\" aria-label=\"切换到英文\" title=\"切换到英文\">EN</button></div>",
    "    </header>",
    "    <form id=\"new-task-form\" class=\"composer\">",
    "      <textarea id=\"new-content\" maxlength=\"5000\" placeholder=\"写下一项任务（回车添加，Shift+回车换行）\" aria-label=\"新任务内容\" required></textarea>",
    "      <button class=\"add-button\" type=\"submit\">＋ 添加便签</button>",
    "    </form>",
    "    <section id=\"task-list\" class=\"task-list\" aria-label=\"任务列表\"></section>",
    "    <p id=\"empty-state\" class=\"empty-state\" hidden>还没有任务，先添加一张便签。</p>",
    "    <p id=\"board-status\" role=\"status\" aria-live=\"polite\">正在连接任务列表…</p>",
    "  </main>",
    "  <script type=\"module\">",
    appScript,
    "  </script>",
    "</body>",
    "</html>"
  ].join("\n");
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolFailure(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  const { id, method, params = {} } = message;
  if (typeof method !== "string") return;

  switch (method) {
    case "initialize":
      result(id, {
        protocolVersion: params.protocolVersion || "2025-03-26",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "codex-task-queue-spike", version: VERSION },
        instructions: "Open the task notes board to add, reorder, remove, or run one task at a time."
      });
      break;
    case "ping":
      result(id, {});
      break;
    case "tools/list":
      result(id, {
        tools: [
          {
            name: "open_task_queue_board",
            title: "Open task notes",
            description: "Open the local task-note board. Tasks can be added, edited, removed, reordered, or sent to the current conversation. A task is archived at the bottom after a successful send.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
            _meta: {
              ui: { resourceUri: APP_URI },
              "openai/ui": { entrypoints: [{ type: "global" }, { type: "thread" }] }
            }
          },
          {
            name: "save_task_queue",
            title: "Save task notes",
            description: "Persist local task-note content, archive state, and order after the user adds, edits, deletes, runs, or reorders notes in the board.",
            inputSchema: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  maxItems: 100,
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      content: { type: "string", minLength: 1, maxLength: 5000 },
                      archived: { type: "boolean" }
                    },
                    required: ["id", "content", "archived"],
                    additionalProperties: false
                  }
                }
              },
              required: ["tasks"],
              additionalProperties: false
            },
            annotations: { destructiveHint: false, openWorldHint: false }
          }
        ]
      });
      break;
    case "resources/list":
      result(id, {
        resources: [{ uri: APP_URI, name: "Task notes board", mimeType: "text/html;profile=mcp-app" }]
      });
      break;
    case "resources/read":
      if (params.uri !== APP_URI) {
        error(id, -32602, "Unknown task board resource.");
        break;
      }
      result(id, {
        contents: [{
          uri: APP_URI,
          mimeType: "text/html;profile=mcp-app",
          text: createBoardHtml(taskQueue),
          _meta: { ui: { prefersBorder: true } }
        }]
      });
      break;
    case "tools/call":
      if (params.name === "open_task_queue_board") {
        result(id, {
          content: [{ type: "text", text: "任务便签面板已打开。每条便签只有一个内容框；左侧把手可拖动排序。" }],
          structuredContent: { tasks: taskQueue }
        });
        break;
      }
      if (params.name === "save_task_queue") {
        try {
          taskQueue = await writeTasks(params.arguments && params.arguments.tasks);
          result(id, {
            content: [{ type: "text", text: "任务便签已保存。" }],
            structuredContent: { tasks: taskQueue }
          });
        } catch (saveError) {
          result(id, toolFailure(saveError.message));
        }
        break;
      }
      error(id, -32602, "Unknown tool.");
      break;
    default:
      if (id !== undefined) error(id, -32601, "Method not found.");
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  try {
    void handle(JSON.parse(line));
  } catch (parseError) {
    process.stderr.write("Invalid JSON-RPC input: " + parseError.message + "\n");
  }
});
