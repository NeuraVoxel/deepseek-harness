# Agent Note: 学习笔记目录

Status: implemented

[English](2026-09-10-learning-notes-directory.md) | 中文

## Problem

在本仓库工作的人与 Agent 会积累会话复盘、规则阅读流程与过程样例。若没有专用位置，这类材料要么污染 [Agent Notes](../../README.zh.md)（错误合同、格式门禁与权威），要么落进 `docs/` 变成非当前态叙述，要么只留在聊天里随后消失。

## Decision

[`.agents/learning/`](../../../learning/README.zh.md) 存放本仓库的学习笔记：会话复盘、规则读取流程与过程样例。书写规则由该目录的双语 README 拥有。

边界：

- 学习笔记**不是** Agent Note。不使用 Agent Note 的 header / skeleton，也不走 `verify-agent-note-format` 或 `verify-agent-note-classification`。
- 学习笔记**不是**产品或包契约。持久事实属于 `docs/`、package README 或 Agent Note。
- 正文优先中文；命令、路径与标识符可保留英文。
- 文件名为 `yyyy-mm-dd-topic.md`。不能离开本机的笔记放在 `.agents/learning/private/`，由仓库根 `.gitignore` 忽略。
- 当持久事实已被吸收进 Agent Note 或已发布文档后，删除该笔记或标明「已吸收」，避免本目录变成第二套权威。
- `verify-md-links` 与 `verify-md-wrap` 不包含本目录；学习笔记不是可机械检查的权威面。

根 [AGENTS.md](../../../../AGENTS.md) 的布局列出 `learning/`。[docs/AGENTS.md](../../../../docs/AGENTS.md) 将 study 材料路由到此处。[Agent Notes README](../../README.zh.md) 写明与兄弟目录的边界。

## Alternatives considered

**把学习材料写成 `process` 类 Agent Note。** 否决：Agent Note 是带门禁格式的决策记录，implemented 后具有现在时权威。会话复盘与教学走读属于错误种类的真相，会在搜索决策时增大误命中。

**学习笔记只放在 `private/`、永不提交。** 否决：可共享的团队语料（本仓库规则与门禁如何运作）有价值；需要隐私时仍可用被忽略的 `private/` 子树。

**把学习材料放进 `docs/` 或 cookbook。** 否决：文档标准要求当前态的产品与贡献者合同，而非聊天衍生的学习叙述。Cookbook 拥有带验证步骤的操作流程；学习笔记拥有临时心智模型。

## Consequences

已提交的学习笔记可被共享与搜索，但与 Agent Note 或已发布文档冲突时以后者为准。作者必须把持久事实吸收进归属层级，而不是把 `.agents/learning/` 当作常驻军令。Markdown 链接与换行门禁不检查本目录，因此学习笔记内的坏链是作者责任，不是 CI 失败。
