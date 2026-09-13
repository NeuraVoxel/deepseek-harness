# 单词学习台（wordbook）实现计划

对应设计：[DESIGN.md](DESIGN.md) ｜ 日期：2026-09-13 ｜ 范围：`plugins/wordbook/`

## 执行前提

- 不改动 `packages/`、`apps/`、`vendor/` 与任何 shipped profile（见 [`plugins/AGENTS.md`](../AGENTS.md)）。
- 每个任务自带可独立验证的验收标准；未通过验收不进入下一个任务。
- 已解决的前置核实项（原设计 §14 遗留）：输入框落位 `conversation.input.dock`（`{ kind: 'list', scope: 'session' }`）；客户端派发命令的既有写法是 `ctx.remote.commands.execute(sessionId, line, [])`，先例见 [`ui-plan/src/client/index.ts`](../../packages/client/ui-plan/src/client/index.ts) 的 `/plan off`。

## 任务 1：插件骨架能被 patch 挂载

**产出**：`package.json`、`cordis.patch.yml`、`tsconfig.json`、`tsdown.config.mjs`、`vitest.config.ts`、最小 `src/index.ts`。

**要点**

- `package.json`：`name: "dsh-wordbook"`、`private: true`、`type: "module"`、`main: "lib/index.js"`、`exports` 含 `./client` 与 `./src/*`；`dsh.bundle.patch: "./cordis.patch.yml"`；`dsh.client.inject` 至少含 `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-conversation`、`@deepseek-ai/dsh-client-ui-renderer`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-api-remotes`，`platform: "web"`；scripts `bundle` / `watch` / `test` / `typecheck`；`peerDependencies: { "@deepseek-ai/cordis": "workspace:^" }`。
- `tsdown.config.mjs`：照 [`turn-cost/tsdown.config.mjs`](../turn-cost/tsdown.config.mjs) 改造（共享 `clientBundle` 只扫 `packages/`，插件必须自带）。
- `vitest.config.ts`：照 [`agent-orchestrator/vitest.config.ts`](../agent-orchestrator/vitest.config.ts)（`include: ['src/**/*.spec.ts']`）。
- `cordis.patch.yml`：`- insert: [{ id: wordbook, name: './src/index.ts' }]`。

**验收**

1. `pnpm install` 后 `pnpm --filter dsh-wordbook bundle` 成功。
2. `pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml --dump-config` 输出含 `wordbook` 行。
3. 实际启动后无加载错误；去掉 `--patch` 后该行消失。
4. `pnpm --filter dsh-wordbook typecheck` 通过。

## 任务 2：域存储可落盘

**产出**：`src/types.ts`、`src/spec.ts`、`src/store.ts` 与 `src/store.spec.ts`。

**要点**

- `spec.ts`：`defineDomain({ name: 'wordbook', version: 1, tables: { words: domainTable(wordRecordSchema) } })`，**不覆写 `layout`**（沿用 `single`）。
- `store.ts`：在 `ctx.effect` 内 `await ctx.storageDomain.open(spec)` 并用 disposer 关闭；暴露 `get` / `put` / `query` / `entries`。
- `query({ text?, limit })`：`text` 为空时按 `updatedAt` 倒序返回；否则匹配 `word`、`display` 或任一 `senses[].meaning` 子串（大小写不敏感）。

**验收**

1. `pnpm --filter dsh-wordbook test` 通过。
2. 测试用临时目录的真实 json 后端：`put` 后 `get` 可取、`entries` 含该键、`query` 命中/不命中判断正确。
3. 持久化落盘：新开一次 domain 句柄仍能读到已写入记录。
4. 卸载插件后域被关闭（`ctx.effect` 回收）。

## 任务 3：模型输出的解析与规范化可离线验证

**产出**：`src/prompts.ts`、`src/lookup.ts` 与 `src/lookup.spec.ts`。

**要点**

- `prompts.ts`：词典式 `system` 指令 + 用户消息模板，明确要求输出**单个 JSON 对象**并给出字段协议。
- `lookup.ts` 纯函数：`buildLookupMessages(word, opts)` 返回 `{ system, messages }`；`parseLookup(text, opts)` 只接受文本、剥 ``` 围栏、`JSON.parse`、schema 校验、规范化（释义去重、截断至 `maxSenses`、trim、丢弃空释义），失败抛出可区分的错误。

**验收**

1. 覆盖用例全绿：正常 JSON、带围栏、前后有散文、缺字段、字段类型错、多个义项、超长释义、空 `senses`。
2. 空 `senses` 与解析失败抛出不同错误类型，供上层区分「未识别」与「输出非法」。
3. 函数无 I/O、无时钟依赖，重复调用结果一致。

## 任务 4：录入链路打通（命令 + 服务）

**产出**：`src/service.ts`、`src/command.ts` 与 `src/service.spec.ts`。

**要点**

- `WordbookService`（服务键 `wordbook`）：解析路由（Config 的 `provider`/`model`，缺省取 `ctx.agentDefaultModel.currentSelection()`）→ 幂等判断 → `ctx.llm.stream` → `BlockAssembler` 收流 → `parseLookup` → 失败用更严格提示重试一次 → `store.put`。
- 信号：`AbortSignal.any([调用方 signal, AbortSignal.timeout(timeoutMs)])`；`provider`/`model` 必填；**不传 `purpose`**。
- `command.ts`：注册 `word`，语法 `[--refresh] <词条>`；解析函数独立可测；返回 `{ kind:'success', text }` 或 `{ kind:'error', text }`。

**验收**

1. 假 `llm` 脚本化流下：首次查词**恰好 1 次**模型请求；二次同名**0 次**；`--refresh` **再次 1 次**。
2. 写入成功后 `store.query` 能查到该词。
3. 模型输出非法 → 重试 1 次 → 仍失败返回错误且**库里没有该词**。
4. 取消信号触发 → 返回错误且不写库。
5. 语法错误（`/word`、`/word --refresh`）不触发任何模型请求。
6. 卸载插件后命令注册被回收。

## 任务 5：Chat 查询链路打通（工具）

**产出**：`src/tools.ts` 与 `src/tools.spec.ts`。

**要点**

- `word_lookup({ word, refresh? })` → `{ created: boolean; entry: WordRecord }`。
- `word_query({ text?, limit? })` → `{ entries: WordRecord[]; total: number }`，`limit` 受 `maxQueryResults` 约束，`total` 反映截断前的命中数。
- `output.presentationMeta` 产出卡片需要的有界字段；`output.render` 只产出模型可读文本，不夹带 UI 格式。

**验收**

1. 两个工具注册后出现在 `ctx.tools` 的可见 schema 中。
2. `word_lookup` 首次 `created: true`、二次 `false`（且不重复请求模型）。
3. `word_query` 的 `total` 与 `entries.length` 在截断时正确区分。
4. 卸载后两个工具从注册表消失。
5. `presentationMeta` 是纯函数：同一输入输出一致，且不含会话状态。

## 任务 6：Client 卡片

**产出**：`src/client/index.ts`、`src/client/locales.ts`、`WordCard.tsx`、`WordQueryCard.tsx` 及样式。

**要点**

- 文案全部走 `ctx.locale.register(NS, { zh, en })`。
- 向 `tool.call.toolview` 注册键 `word_lookup` 与 `word_query` 的渲染器，数据只来自 `result.meta` 与 props，**不扫描 session**。

**验收**

1. `pnpm --filter dsh-wordbook test` 覆盖两个卡片的纯渲染（含降级：meta 缺失时回退通用行）。
2. `pnpm run verify-client-ui-i18n`（或该门禁的等价命令）不报硬编码文案。
3. Client 包构建产物通过 client bundle purity 检查。

## 任务 7：输入框 dock

**产出**：`WordbookDock.tsx` 与 `client/index.ts` 中的注册。

**要点**

- 注册到 `conversation.input.dock`（`inject: ['slots', 'remote', 'remote.commands', 'locale']`）。
- 提交时 `await ctx.remote.commands.execute(sessionId, '/word ' + text, [])`；处理 `undefined`（命令未解析）与 `kind: 'error'`；提交后清空输入。

**验收**

1. 在真实 Web 会话中输入 `apple` → 出现命令结果卡片；词条进入 `$DSH_HOME/storages/wordbook.json`。
2. 空输入或纯空白不提交。
3. 错误结果（如路由报错）在界面上可见，不是静默失败。
4. 无 session 时不渲染或禁用提交。

## 任务 8：README 与真机验证

**产出**：`README.md` / `README.zh.md` / `README.i18n.yaml`，真机 e2e（有 `DEEPSEEK_API_KEY` 才跑，否则 self-skip）。

**全局验收（照 DESIGN.md §13）**

1. `pnpm install && pnpm --filter dsh-wordbook bundle`
2. `pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml`
3. 输入 `apple` → 文本卡片出现 → `wordbook.json` 出现该词条
4. Chat 里问「我查过 apple 吗」→ 模型调用 `word_query` → 词汇卡片出现
5. 重启进程后重复第 4 步 → 数据仍在

**收尾**

- 在 [`plugins/README.md`](../README.md) 的包表里补一行，说明该插件的角色。
- 确认没有改动 `plugins/` 之外的任何文件（`git status` 自查）。

## 风险与对策

| 风险 | 对策 |
|---|---|
| Client 插件注入名或槽位与预期不符 | 任务 1 就注册一个空组件到 `conversation.input.dock`，先验证注入与渲染通路，再填内容 |
| 假 `llm` 与真实适配器的 chunk 形状不同 | 任务 4 的测试固定 `BlockAssembler` 的输入形状；任务 8 用真机 e2e 覆盖真实形状 |
| `tool.call.toolview` 键名与 wire 工具名不一致 | 任务 5 的验收要求工具注册后核对 `ctx.tools` 暴露的 wire 名，卡片键以该名称为准 |
| 命令名 `word` 与未来内置命令冲突 | 注册同名会立即抛错，属期望的 fail-loud；冲突时改名为 `wb` 并同步文档 |
