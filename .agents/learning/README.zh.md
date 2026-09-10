# Learning notes

[English](README.md) | 中文

本目录存放对本仓库的学习笔记：会话复盘、规则读取流程、过程样例等。

## 边界

- **不是 Agent Note。** 不要放进 [`.agents/notes/`](../notes/README.zh.md)；不参与 `verify-agent-note-format` / `verify-agent-note-classification`，也不使用 Agent Note 的 header / skeleton。
- **不是产品文档。** 持久合同写在 `docs/`、package README 或 Agent Note，不写在这里。
- **不进文档门禁扫描。** `verify-md-links` / `verify-md-wrap` 的 glob 不包含本目录；学习笔记不承担可机械检查的权威链接义务。

权威与学习语料的分工见 [learning notes 决策](../notes/implemented/process/2026-09-10-learning-notes-directory.zh.md)。

## 书写语言

正文**优先使用中文**。专业名词、命令、路径、标识符可保留英文（例如 Agent Note、`doc-sync`、`AGENTS.md`、capability seam）。

## 布局

文件命名：`yyyy-mm-dd-topic.md`（日期为首次撰写日）。

不能离开本机的笔记放在 `.agents/learning/private/`（已由仓库根 `.gitignore` 忽略；勿提交）。

当笔记中的持久事实已被吸收进 Agent Note 或已发布文档后，删除该笔记，或在文首标明「已吸收」，避免本目录变成第二套权威来源。
