# Codex 任务便签

[English documentation](README.en.md)

**别让待办散落在聊天记录里。**把任务写成便签、拖动排好顺序，点击“运行”就交给 Codex 在当前对话里逐条完成；做完的任务自动归档。

轻量好上手，支持中英文切换，任务保存在本机。适合把一个项目拆成一串小任务，按顺序推进。

**想马上试试？**前往下方的 [GitHub 安装步骤](#从-github-安装)。

## 功能

- 每条任务是一张便签，可添加、编辑、删除。
- 拖动便签左侧把手调整顺序；活动任务自动编号。
- 点击“运行”后，把便签内容作为用户消息发送到当前 Codex 对话；成功发送后自动归档。
- 在中文和英文界面之间切换；界面语言偏好保存在本机。
- 便签内容和顺序保存在本机，不会自动同步到其他设备或用户。

## 环境要求

- 支持本地插件和 MCP Apps 的 Codex 客户端。
- Node.js 命令 `node` 可从 `PATH` 中访问；插件不需要 npm 依赖。

本项目通过本地 `stdio` MCP 服务运行，适用于本地 Codex 客户端。它不是托管的远端 MCP 服务。

## 从 GitHub 安装

将本目录作为 GitHub 仓库根目录后，运行：

```bash
codex plugin marketplace add https://github.com/97ming/codex-task-queue-notes.git
codex plugin add codex-task-queue-spike@task-queue-spike-local
```

安装后重启 Codex，并在对话中调用 `open_task_queue_board` 打开便签面板。

更新仓库内容后，可刷新 marketplace 并重新安装插件：

```bash
codex plugin marketplace upgrade task-queue-spike-local
codex plugin add codex-task-queue-spike@task-queue-spike-local
```

## 使用

1. 调用 `open_task_queue_board` 打开任务便签。
2. 在顶部输入框添加任务；按 Enter 添加，按 Shift+Enter 换行。
3. 点击便签内容进行编辑；使用左侧拖动把手排序。
4. 点击“运行”把任务发到当前对话。成功发送的任务会移到归档区。
5. 点击标题栏右侧的 `EN` 或 `中文` 切换界面语言。

首次运行且本机尚无任务文件时，会创建三条只请求确认字符串的示例便签。它们不会要求 Codex 修改文件。

## 数据与隐私

- 默认数据文件为 `~/.codex/task-queue-spike/tasks.json`；设置 `CODEX_HOME` 时，文件位于该目录下的 `task-queue-spike/tasks.json`。
- 任务列表只保存在本机。每个用户或 Codex 环境各自拥有独立列表。
- 点击“运行”时，便签内容会作为用户消息发送到当前 Codex 对话。
- 插件不连接第三方服务，也不会把任务数据写入当前项目工作区。

## 本地开发

仓库没有 npm 依赖。可运行内置检查器：

```bash
node --check server.mjs
node verify.mjs
```

## 仓库说明

- 本仓库根目录就是插件 marketplace 根目录；marketplace 清单位于 `.agents/plugins/marketplace.json`。
- 插件通过本机 `stdio` MCP 服务运行；每个用户的便签数据保存在各自的 Codex home 目录。
- 仓库尚未添加许可证文件，因此目前没有授予他人复制、修改或分发代码的许可证。

## 许可证

尚未声明。若要允许他人复用或分发代码，请由仓库所有者选择并添加许可证。
