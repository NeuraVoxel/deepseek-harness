# wordbook

[English](README.md) | 中文

示例插件：架在现成 Web profile 之上的个人单词本。`/word apple`——或 composer 上方的输入框——让插件自己向大模型要一条词典条目、持久化保存，并把 `word_lookup` / `word_query` 两个工具交给模型在聊天里调用。

- **录入确定，不消耗主模型 turn**：`/word` 命令自己发起辅助模型请求。
- **真落库**：词条经 storage 域写入 `$DSH_HOME/storages/wordbook.json`。
- **Chat 内可查**：模型调用 `word_query`，结果渲染为词汇列表卡片。
- **可重复**：再次查同一个词直接返回已存条目、不再请求模型；`/word --refresh apple` 强制重新请求。

## 运行

在仓库根目录：

```sh
pnpm install
pnpm --filter dsh-wordbook bundle
pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml
```

或装进一个 profile：

```sh
pnpm dsh plugin --profile web-wordbook add ./plugins/wordbook
pnpm dsh --profile web-wordbook
```

随后在运行中的 Web 会话里：

1. 在 composer 上方的「添加单词」输入框里输入 `apple` 并提交，或直接在 composer 里输入 `/word apple`。
2. 检查 `$DSH_HOME/storages/wordbook.json` 里多出了 `apple` 条目。
3. 问模型之前是否查过 `apple`：它会调用 `word_query`，出现词汇列表卡片。
4. 重启进程后重复第 3 步——条目仍在。

## 目录结构

| 路径 | 职责 |
|---|---|
| `src/index.ts` | Host 半：打开存储、发布 `ctx.wordbook`、注册命令与两个工具 |
| `src/spec.ts` | `wordbook` 域声明：zod 记录 schema 加 `defineDomain` |
| `src/store.ts` | 该域唯一的读取与写入方 |
| `src/lookup.ts`、`src/prompts.ts` | 纯函数：请求文本构造与严格的答案解析 |
| `src/service.ts` | 基于 `ctx.llm` 的幂等查词编排 |
| `src/command.ts` | `/word [--refresh] <单词>` |
| `src/tools.ts` | `word_lookup` 与 `word_query` |
| `src/client/` | 浏览器半：字典、两张工具卡片、输入框 |
| `src/testkit.ts` | 测试共用的脚本化适配器与挂载装置 |
| `cordis.patch.yml` | 可选插入层（`dsh.bundle.patch`）|

## 配置

每个字段都是经过校验的 `Config` 字段，可从 `cordis.yml` 覆盖。

| 字段 | 默认 | 含义 |
|---|---|---|
| `provider` / `model` | agent 默认模型 | 辅助查词路由；必须成对设置 |
| `maxOutputTokens` | `1024` | 单次答案的输出上限 |
| `temperature` | 模型默认 | 透传给适配器 |
| `timeoutMs` | `20000` | 单次查词的端到端超时 |
| `maxSenses` | `8` | 向模型声明并在解析时强制的释义条数上限 |
| `refreshByDefault` | `false` | 把每次查词都当作刷新 |
| `maxQueryResults` | `20` | 单次查询的结果条数上限 |

## 测试

```sh
pnpm --filter dsh-wordbook test       # unit and behavior tests, no network
pnpm --filter dsh-wordbook test:e2e   # one real provider call; skips without DEEPSEEK_API_KEY
```

第一条命令跑单测与行为测试，不联网；第二条跑一次真实 provider 调用，没有 `DEEPSEEK_API_KEY` 时自动跳过。

## 已知限制

- **录入卡片是内置命令卡片（文本）**。富卡片需要一条插件自有的 session 事件，而 `Session.append()` 无法为未知事件打上 `ignorable` 标记；自建事件会让 session 日志对 harness 不可读。查询链路不受影响，因为 `tool/call` 与 `tool/result` 本就是已知事件。
- **辅助请求不进 session log**，原因同上：提示词与原始答案无法从日志重建；可重建的是 `command/run` / `command/done` 与库内记录。
- **辅助调用不带 `purpose`**：该字段是闭集（`compaction` | `session-title`），插件无法为自己的调用声明用途。
- **记录 schema 的破坏性变更需要人工迁移**。默认 `single` 布局要求域版本与存储文件版本严格相等，且 `compatibleVersions` 不生效；保持版本 1 就要把新字段声明为可选。

设计与计划：[DESIGN.md](DESIGN.md) · [PLAN.md](PLAN.md)
