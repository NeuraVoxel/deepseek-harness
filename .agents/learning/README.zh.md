# 学习笔记

[English](README.md) | 中文

本目录存放对本仓库的学习笔记：会话复盘、过程走查，以及在实践中观察到的"本仓库如何运转"的事实。

## 边界

- **不是 Agent Note。** 任何条目都不进 `.agents/notes/`，不使用 Agent Note 的 header 或骨架，也不构成决策记录；见 [Agent Notes](../notes/README.zh.md)。
- **不是待办入口。** 值得正式评审的想法只在人明确要求时才成为 `notes/proposed/` 下的 Agent Note；学习笔记只链过去，绝不自己变成队列。
- **不是消费者文档。** 面向采用者的持久合同写在 `README.md`、`docs/` 或 Agent Note——绝不写在这里。

## 条目语言

条目默认用中文书写；术语、路径与命令保留英文。本 README 自身按 [i18n 合同](../../docs/i18n/README.zh.md) 保持双语配对。

## 布局

- 条目命名 `NNN-topic.md`，按创建顺序从 `001`、`002` 依次累加，补零至三位；新条目取现有最大编号加一，编号不复用。编号之后是 `kebab-case` 主题 slug。用 [dsh-learning-note](../skills/dsh-learning-note/SKILL.md) 落一篇。
- 不能离开本机的笔记放 `.agents/learning/private/`，同目录的 `.gitignore` 已忽略该子树：勿提交。
- 当笔记中的持久事实已被 Agent Note 或已发布文档吸收后，删除该笔记或在文首标明已吸收——本目录绝不成为第二套权威来源。
