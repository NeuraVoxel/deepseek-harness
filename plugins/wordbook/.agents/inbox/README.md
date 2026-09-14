# Inbox

未承诺灵感的排队区：先捕获、不承诺必做；在 `QUEUE.md` 扫未完成项；值得做的再升格为正式 Agent Note。

## 边界

- **不经 `ai-eng verify-notes`。** format gate 只扫 `.agents/notes/`；inbox 靠本 README 与人工/Agent 纪律约束。
- **不是学习笔记。** 复盘与过程样例放 [`.agents/learning/`](../learning/README.md)；复盘里冒出的灵感应落到此处，learning 只链过来。
- **不是决策记录。** 值得正式审阅的想法升格为 `notes/proposed/` 的 Agent Note；禁止把 inbox 文件改名或迁进 notes 树。

同一想法不要同时以权威待办存在于 inbox 与 learning。`AGENT​S.md` 的设计草稿落点规则不受本目录影响：正式提案进 `.agents/notes/proposed/`。

## 书写语言

正文**优先使用中文**。专业名词、命令、路径、标识符可保留英文（例如 Agent Note、`QUEUE.md`、`Status: open`、`verify-notes`）。

## 布局

| 路径 | 职责 |
|---|---|
| `README.md` | 本目录合同 |
| `QUEUE.md` | checkbox 排队板（扫队列用） |
| `yyyy-mm-dd-slug.md` | 一条灵感；文件名日期 = 首次捕获日 |

## 单条文件形状

```markdown
# Inbox: <短标题>

Status: open

## Spark
<几句：想法是什么、为何此刻记下>

## Notes
（可选）上下文、链接、粗略代价；勿写完整 Proposal 骨架
```

`Status` 取值：

- `open` — 仍在排队
- `promoted` — 已升格离队；正文须链到归属 Agent Note
- `discarded` — 已丢弃离队；一行原因（写在 `## Notes` 或 Status 旁）

无 format gate。形状靠本 README 与人工/Agent 纪律约束。

## QUEUE.md

- `[ ]` 表示 `open`。
- `[x]` 表示已离队（`promoted` 或 `discarded`）；升格行链到 Agent Note；丢弃行可附短原因。
- 顺序：捕获日新→旧。

细节与正式 `Status` 以单条文件为准。`QUEUE.md` 是扫队列与勾选操作面。每次捕获 / 升格 / 丢弃须在同一变更中改条目文件并更新 `QUEUE.md` 对应行。发现不一致时，以条目 `Status` 为准，修 `QUEUE.md`。

`QUEUE.md` 由 `ai-eng init` 仅在缺失时写入，`--force` / `--upgrade` 均不刷新——里面的勾选行是本仓库状态，不是模板。

## 捕获

1. 新建 `yyyy-mm-dd-slug.md`，`Status: open`，`## Spark` 写几句即可。
2. 在 `QUEUE.md` 顶部（新→旧）加一行 `- [ ] [标题](./yyyy-mm-dd-slug.md)`。

也可用随包安装的 `kit-inbox-*` skills（kit 创作的技能统一位于 `.agents/skills/`，名称带 `kit-` 前缀；技能发现只读该目录的直属子项、不再递归，所以不放进子目录）：

| Skill | 用途 |
|---|---|
| [kit-inbox-capture](../skills/kit-inbox-capture/SKILL.md) | 只需**主体**（可选标题 / slug / Notes）；写 spark 并更新 `QUEUE.md` |
| [kit-inbox-promote](../skills/kit-inbox-promote/SKILL.md) | 明确升格某条 `open` spark → `proposed/` Agent Note，并改 Status / QUEUE |

捕获不升格；升格须当轮明确说「升格」或使用 `kit-inbox-promote`。

## 扫队列

打开 `QUEUE.md`，只看 `[ ]` 行。需要更多上下文再点进条目文件。不强制回顾节奏。

## 升格

1. 确认值得写完整 Agent Note 并认真审阅。
2. 在 `.agents/notes/proposed/<class>/yyyy-mm-dd-….md` 新建正式 note（禁止把 inbox 文件改名或迁进 notes 树）。
3. proposed → spark 互链；条目改为 `Status: promoted` 并链到该 Agent Note。
4. `QUEUE.md` 对应行改为 `[x]`，并加上 Agent Note 链接。
5. 优先同一变更完成；若拆提交，双向链接最终必须齐全。

Agent 可代写条目并改 `QUEUE.md`。除非当轮人明确要求升格，Agent 不得自行升格到 `proposed/`。

## 丢弃

1. 条目 `Status: discarded` + 短原因。
2. `QUEUE.md` 勾 `[x]`（可选短原因）。
3. 默认保留文件；仅在无引用价值时删除，并去掉 `QUEUE.md` 行。
