# Learning notes

本目录存放对本仓库的学习笔记：会话复盘、规则读取流程、过程样例等。

## 边界

- **不是 Agent Note。** 不要放进 `.agents/notes/`；不参与 `ai-eng verify-notes`，也不使用 Agent Note 的 header / skeleton。
- **不是待办入口。** 未承诺的灵感与排队放在 [`.agents/inbox/`](../inbox/README.md)；本目录只做复盘与过程样例。复盘里冒出的灵感应落到 inbox，这里只链过去。
- **不是消费者文档。** 给包用户看的持久合同写在 `README.md`、`docs/` 或 Agent Note，不写在这里。

## 书写语言

正文**优先使用中文**。专业名词、命令、路径、标识符可保留英文（例如 Agent Note、`verify-notes`、exit code、`AGENTS.md`）。

## 布局

文件命名：`yyyy-mm-dd-topic.md`（日期为首次撰写日）。

不能离开本机的笔记放在 `.agents/learning/private/`——同目录的 `.gitignore`（由 `ai-eng init` 写入，可被 `--force` / `--upgrade` 刷新）已忽略该子目录：勿提交、勿指望进包。

当笔记中的持久事实已被吸收进 Agent Note 或已发布文档后，删除该笔记，或在文首标明「已吸收」，避免本目录变成第二套权威来源。
