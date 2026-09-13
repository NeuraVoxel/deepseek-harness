# 单词学习台（wordbook）技术方案

状态：设计已评审，待实现 ｜ 日期：2026-09-13 ｜ 范围：`plugins/wordbook/`

## 1. 目标与非目标

**目标**：在现有 DSH Web 外壳内，以纯插件方式实现「输入单词 → 调用大模型查词 → 结构化数据落库 → Chat 内直接查询」。插件不得改动 `packages/`、`apps/`、`vendor/` 或任何 shipped profile。

用户可见的三件事：

1. 在 Chat 里输入 `/word apple`，或在工作台的「添加单词」输入框里输入 `apple`，得到该词的音标、词性、中文释义与例句，并自动入库。
2. Chat 中用自然语言查询已存词汇（模型调用 `word_query` 工具），结果以词汇卡片呈现。
3. 重启 dsh 进程后数据仍在。

**非目标（v1 明确不做）**：词汇本浏览器面板、复习曲线/SRS、标签与掌握度、导入导出、多用户与权限、编辑既有记录、删除记录。

## 2. 已核实的仓库约束

这些事实决定了本方案的骨架，均已在实现前的源码勘察中确认。

| 约束 | 事实 | 证据 |
|---|---|---|
| 插件不能自建 `@Remote` | Typert 生成只扫描 `vendor/*`、`packages/*/*`、`apps/cli`，`plugins/*` 不在其中；客户端 `api-remotes` 只挂载 harness 构建期选定的业务包 | [`tsdown.config.ts`](../../tsdown.config.ts)；`plugins/agent-orchestrator/src/index.ts` 注释 "no dedicated Typert Remote yet" |
| 插件可以复用既有 Remote | 内置 composer 用 `remote.commands.execute(sessionId, line, [])` 派发斜杠命令，插件 Client 半可声明同样的注入后调用 | [`session.ts`](../../packages/api/session-controller/src/client/sessions/session.ts)；[`commands/src/index.ts`](../../packages/interaction/commands/src/index.ts) 的 `CommandRuntime extends TypertRemoteService` |
| 插件可以发起辅助模型请求 | `ctx.llm.stream(GenerateOptions)` 可用，`session-title-llm` 是完整的先例：先记录请求、再收流、再严格校验输出 | [`session-title-llm/src/index.ts`](../../packages/session/session-title-llm/src/index.ts) |
| `GenerateOptions.provider` / `model` 必填 | 插件必须显式解析一条模型路由，不能省略 | [`llm/src/types.ts`](../../packages/llm/llm/src/types.ts) |
| `purpose` 是闭集 | `purpose?: 'compaction' \| 'session-title'`，插件不得自造用途值，只能不传 | 同上 |
| 插件不能写自建 session 事件 | `Session.append()` 不暴露 `ignorable` 标记，未知事件类型在持久化发布时被 `validateStoredEvents` 拒绝（fail-closed） | [`session/src/index.ts`](../../packages/core/session/src/index.ts)；[`storage-contract.ts`](../../packages/session/session-persistence/src/storage-contract.ts) |
| 域存储开箱可用 | base 已挂载 `dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`，默认路由 `json`，落盘 `$DSH_HOME/storages/`；KV 表暴露 `get/entries/keys/size` | [`base/cordis.patch.yml`](../../packages/bundle/base/cordis.patch.yml)；[`storage-domain/README.md`](../../packages/storage/storage-domain/README.md) |
| 富呈现需要一条权威域事件 | `command/done` 的 `sourceEventSeq` 只能指向一条已落库的域事件；插件写不了自建 session 事件（见下行），所以录入结果 v1 只能用文本卡片 | [`commands/src/types.ts`](../../packages/interaction/commands/src/types.ts) |
| 富卡片走工具位槽 | Client 插件按 wire 工具名向 `tool.call.toolview` 注册键控渲染器 | [`adding-a-tool.md`](../../docs/cookbook/adding-a-tool.md)；[`ui-deliverables`](../../packages/client/ui-deliverables/src/client/index.ts) |
| 插件自带构建与测试 | 共享 `clientBundle` 只扫 `packages/`，插件需要自己的 `tsdown.config.mjs` 与 `vitest.config.ts` | [`turn-cost/tsdown.config.mjs`](../turn-cost/tsdown.config.mjs)；[`agent-orchestrator/vitest.config.ts`](../agent-orchestrator/vitest.config.ts) |

## 3. 包结构与挂载

```text
plugins/wordbook/                 # 包名 dsh-wordbook
├── package.json                  # dsh.bundle.patch + dsh.client{inject, platform:'web'} + scripts
├── cordis.patch.yml              # - insert: [{ id: wordbook, name: './src/index.ts' }]
├── tsdown.config.mjs             # 插件自带 Host + Client 构建
├── tsconfig.json
├── vitest.config.ts              # 插件自带测试
├── README.md / README.zh.md / README.i18n.yaml
└── src/                          # 见 §4
```

两种挂载方式，二者等价：

- 临时试用：`pnpm --filter dsh-wordbook bundle` 后 `pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml`。
- 持久安装：`pnpm dsh plugin --profile web-wordbook add ./plugins/wordbook`，之后用 `pnpm dsh --profile web-wordbook` 启动。

补丁里的插件名用相对路径 `./src/index.ts`（相对 patch 文件解析），这样 Loader 不会去 `$DSH_HOME/profiles/web` 下找裸包名。

## 4. 组件与职责

Host 半（`src/`）：

| 单元 | 职责 | 依赖 | 对外用法 |
|---|---|---|---|
| `types.ts` | 共享类型：`WordRecord`、`LookupResult`、`QueryRequest` | — | 类型导出 |
| `spec.ts` | `defineDomain` 声明 `wordbook` 域、`words` 表与 zod 记录 schema | `@deepseek-ai/dsh-storage-domain` | 模块加载即校验 |
| `store.ts` | 唯一持久化读写单元：open / get / put / query | `ctx.storageDomain` | `get(word)`、`put(record)`、`query(req)` |
| `prompts.ts` | 词典式系统提示与 JSON 输出协议文本 | — | 常量 |
| `lookup.ts` | 纯函数：构造请求文本、严格解析与规范化模型输出 | 无 I/O | `buildLookupPrompt(word, opts)`、`parseLookup(text, opts)` |
| `service.ts` | `WordbookService`（服务键 `wordbook`）：幂等查词编排与查询 | `ctx.llm`、`store`、`ctx.agentDefaultModel` | `lookup(word, {refresh})`、`query(req)` |
| `command.ts` | `/word [--refresh] <word>` 适配器 | `ctx.commands` | 注册随 effect 回收 |
| `tools.ts` | `word_lookup` 与 `word_query` 的 `defineTool` 定义 | `ctx.tools` | 同上 |

设计原则：**命令与工具都只是适配器**，编排逻辑只存在于 `service.ts`。两者共享同一份幂等判断、同一份解析校验、同一份错误语义，因此「聊天查」与「输入框查」不会分叉成两套行为。

Client 半（`src/client/`）：

| 单元 | 职责 |
|---|---|
| `index.ts` | 注册 locale 字典、两个工具卡片、添加单词输入框 |
| `locales.ts` | zh / en 文案字典 |
| `WordCard.tsx` | 单词卡片（音标、词性+释义、例句） |
| `WordQueryCard.tsx` | 查询结果列表卡片 |
| `WordbookDock.tsx` | 「添加单词」输入框 |
| `*.module.css` | 卡片样式 |

## 5. 数据模型与存储

复用 base 已挂载的 storage 家族，不自建数据库文件。域声明：

```ts
export const wordbookDomainSpec = defineDomain({
  name: 'wordbook',
  version: 1,
  tables: { words: domainTable(wordRecordSchema) },
})
```

记录 schema（`wordRecordSchema`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `word` | string | 规范化键：trim 后小写；与 KV 主键一致 |
| `display` | string | 用户输入的原始形式，用于展示 |
| `phonetic` | `{ us?: string; uk?: string }`（可选） | 音标 |
| `senses` | `{ pos: string; meaning: string; examples?: string[] }[]` | 词性、中文释义、例句 |
| `model` | `{ provider: string; model: string }` | 生成该记录的路由，可追溯 |
| `createdAt` / `updatedAt` | number | epoch 毫秒 |

存储布局：域 spec 不覆写 `layout`，沿用默认的 `single`——整个域是一个文件，即 `$DSH_HOME/storages/wordbook.json`，每次写入原子重写整份文件。选它的两个理由：`single` 下记录键是不透明字符串，因此 `give up`、`don't` 这类含空格或撇号的词条可以直接当键；介质损坏或版本不符时它**明确报错**而不是静默丢弃。

代价是写放大：每写一个词都要重写整份文件。以人工节奏的写入频率和千级词量估算，文件在百 KB 量级，可以接受。若将来写入变频繁再切 `layout: 'per-record'`：那时键必须匹配 `[a-zA-Z0-9_-]+`（词条需 slug 化并处理碰撞），且版本不在 `compatibleVersions` 内的记录会**静默读作不存在**，而不是报错。

写入以耐久性为先（后端确认后才更新内存并发出 `domain/changed`）；读取是内存中的同步读。

检索：精确词用 `table.get(key)`（O(1)）；模糊查询用 `table.entries()` 扫描，在个人词量级下开销可忽略。

切换介质是配置变更而非代码变更：在插件 patch 里插入 `storage-sqlite` 行，并覆写 `storage-domain` 的 `routes` 把 `wordbook` 指向 `sqlite`。注意 patch 替换目标行的整份 config，因此需要重述 `backend`。这是选择 storage 域而不是自建 SQLite 的主要原因。

schema 演进规则：`single` 布局要求域 `version` 与文件头版本严格相等，否则以 `version-mismatch` 拒绝打开，且 `compatibleVersions` 在该布局下不生效。

- **兼容演进（推荐）**：保持 `version: 1`，新增字段一律声明为可选。旧记录仍通过 zod 校验，读到时新字段为 `undefined`，不需要任何迁移。
- **破坏性变更**：升到 `version: 2` 后旧文件无法打开，必须做一次性人工迁移（读出 `wordbook.json` 改写为新版本，或改用新的域文件名）。代码不做隐式迁移，以免静默丢数据。

## 6. 数据流

### 6.1 录入（不消耗主模型 turn）

```text
[工作台输入框] 或 [Chat 直接输入 /word apple]
  → remote.commands.execute(sessionId, '/word apple', [])      既有 Remote
  → CommandRuntime 命中 word，先落 command/run
  → handler(invocation): ctx.wordbook.lookup('apple')
       store.get('apple') 命中且未 --refresh
         → 直接返回已存记录（0 次模型请求）
       未命中：
         用 lookup.buildLookupMessages 构造请求
         ctx.llm.stream({ provider, model, system, messages,
                          maxTokens, temperature?, sessionId, signal })
         BlockAssembler 收流 → parseLookup() → schema 校验 → 规范化
         store.put(record)
  → command/done { kind:'success', text:'apple /ˈæpl/ n. 苹果 …（已入库）' }
```

模型调用失败、输出无法解析、或识别不到释义时，返回 `{ kind: 'error', text }`，且**不写库**。

### 6.2 查询（Chat 工具，富卡片）

```text
用户：「我查过 apple 吗」/「有哪些和苹果有关的词」
  → 模型调用 word_query({ text: 'apple' })
  → service.query → store.query → { entries: WordRecord[] }
  → tool/result：
       canonical value      = { entries, total }（结构化、可编程取用）
       output.render        = 模型可读文本
       output.presentationMeta = 卡片所需的有界字段（可随日志回放）
  → Client 端 tool.call.toolview('word_query') 渲染词汇卡片
```

## 7. 命令协议

注册名 `word`，描述「查词并入库」，`input.hint: '<单词>'`。

`rawInput` 是命令名之后的**逐字文本**（含分隔空白），命令自己拥有其语法：

```text
/word apple              → 查词并入库；若已存在则返回旧记录
/word --refresh apple    → 强制重新查词并更新记录
/word                    → { kind:'error', text:'用法：/word [--refresh] <单词>' }
```

参数解析放在 `command.ts` 内，可单测：trim → 识别可选前置 `--refresh` → 余下整段为词条（允许短语）→ 空则报用法错误。命令名冲突（例如未来 harness 新增内置 `/word`）会在注册时立即抛错，启动即暴露，不会静默覆盖。

## 8. 工具契约

两个工具都用 `defineTool`，参数由 DSL 校验，`output.schema` 声明唯一权威 JSON 值。

**`word_lookup`**（模型可主动调用，例如用户直接说「帮我查一下 apple」）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `word` | string | 是 | 要查的单词或短语 |
| `refresh` | boolean | 否 | 忽略已有记录，强制重新查词 |

输出：`{ created: boolean; entry: WordRecord }`。已存在且未 `refresh` 时 `created` 为 `false`。

**`word_query`**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `text` | string | 否 | 匹配词条或任一释义的子串；省略时返回最近更新的记录 |
| `limit` | number | 否 | 上限，受 Config `maxQueryResults` 约束 |

输出：`{ entries: WordRecord[]; total: number }`；`total` 是命中总数，`entries` 可能被上限截断，二者不等即表示结果不完整。

两个工具都不在工具内做权限判断，也不自带重试/超时策略；这些属于部署策略，走 `tools/pre-execute` 等既有扩展点。工具注册是 effect，卸载即回收。

## 9. 模型调用与提示词

单次一次性请求，不开工具调用：

- `system`：固定的词典编纂指令，说明输出必须是**单个 JSON 对象**并给出字段协议。
- `messages`：一条 user 消息，含词条与输出要求；对模型的输入不拼接任何会话历史，保证幂等与可复现。
- `provider` / `model`：来自 Config 的可选成对字段；缺省取 `ctx.agentDefaultModel.currentSelection()`。
- `maxTokens`、`temperature`：来自 Config。
- `sessionId`：来自触发方（命令的 `invocation.agent.session`、工具的 `exec.agent.session`）。
- `signal`：`AbortSignal.any([调用方 signal, AbortSignal.timeout(timeoutMs)])`，取消与超时都透传到适配器。
- **不传 `purpose`**：该字段是闭集，插件不得自造用途值。

解析链（全部在 `lookup.ts` 中，纯函数，可单测）：只接受 text block（出现 `tool-call` 即失败）→ 剥去可能的 ``` 围栏 → `JSON.parse` → schema 校验 → 规范化（释义去重、条数截断至 `maxSenses`、字符串 trim、丢弃空释义）。首次解析失败时用更严格的提示重试一次；仍失败则以错误结束，不写库。

`senses` 为空视为「未识别该词」，按错误处理。

## 10. Client 半

- **locale 字典**：所有界面文案走 `ctx.locale.register(NS, { zh, en })`，不硬编码副本（仓库有 `verify-client-ui-i18n` 门禁覆盖 plugins/）。
- **工具卡片**：向 `tool.call.toolview` 注册键 `word_lookup` 与 `word_query` 的渲染器，数据只来自 `result.meta`（由 `output.presentationMeta` 产出）与 props，**不扫描 session**，因此在日志回放时同样正确。
- **输入框**：一个 composer dock 型组件（与 `turn-cost` 的 `SessionCostDock` 同槽位写法）。提交时调用既有 Remote：`ctx.remote.commands.execute(sessionId, '/word ' + text, [])`。需要 `inject: ['remote', 'remote.commands', …]`，并在 `package.json` 的 `dsh.client.inject` 中声明 `@deepseek-ai/dsh-api-remotes`。
- **录入结果的呈现**：v1 使用内置命令卡片（文本）。原因见 §14 限制 1。

## 11. 配置项

全部为 validated `Config` 字段，可从 patch 覆盖，不在代码里写死。

| 字段 | 默认 | 含义 |
|---|---|---|
| `provider` / `model` | 缺省 | 必须成对出现；省略时用 `ctx.agentDefaultModel.currentSelection()` |
| `maxOutputTokens` | 1024 | 单次查词输出上限 |
| `temperature` | 未设置 | 透传给适配器；不设置即用模型默认 |
| `timeoutMs` | 20000 | 端到端超时 |
| `maxSenses` | 8 | 规范化时保留的释义条数上限 |
| `refreshByDefault` | false | 是否默认忽略已有记录重新查词 |
| `maxQueryResults` | 20 | `word_query` 单次返回条数上限 |

## 12. 错误处理与幂等

| 场景 | 行为 |
|---|---|
| 词条已存在 | 默认直接返回旧记录并标注「已存在」，不发模型请求；`--refresh` 强制重查并 `put` 覆盖 |
| 模型输出非法 / 缺字段 / 全空释义 | 严格提示重试一次；仍失败返回错误，不写库 |
| 模型调用超时或被取消 | 返回错误；取消信号透传，绝不写部分结果 |
| 存储写入失败 | 直接报错。storage 写入以耐久性为先，不允许「报成功但没落盘」 |
| 路由无法解析 | 插件 `inject` 未满足时保持 pending，由 Loader 明确报出缺哪个服务；不做静默兜底 |
| 命令语法错误 | 返回 `{ kind:'error', text }`，不触发模型请求 |

## 13. 测试与验收

**纯函数单测**（`src/lookup.spec.ts`、`src/command.spec.ts`）：围栏 JSON、前后多余散文、缺字段、类型错误、多义项、超长释义、空释义；命令语法 `word apple`、`word   apple`、`word --refresh apple`、`word`。

**Host 行为测试**（`src/service.spec.ts`）：用脚本化的假 `llm` 与内存 storage，断言「首次查词只发一次模型请求」「二次命中零请求」「`--refresh` 再次请求」「写入后可查询」「插件卸载后命令与工具消失」。

**Client 测试**：卡片只消费 props 与 `result.meta`，不扫描 session 事件。

**手工验收**（写进插件 README）：

1. `pnpm install && pnpm --filter dsh-wordbook bundle`
2. `pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml`
3. 输入框输入 `apple` → 命令结果文本卡片出现 → 检查 `$DSH_HOME/storages/wordbook.json` 出现该词条
4. 在 Chat 里问「我查过 apple 吗」→ 模型调用 `word_query` → 出现词汇卡片
5. 重启进程后重复第 4 步 → 数据仍在（证明真落库）

**真机 e2e**：仅在存在 `DEEPSEEK_API_KEY` 时跑一次真实查词，否则 self-skip，与仓库 e2e 策略一致。

插件不进任何 shipped profile，因此不涉及根目录快照更新。

## 14. 已知限制

1. **录入结果只有文本卡片**。要呈现富卡片需要一个权威域事件，而插件无法写自建 session 事件（§2 第 6 条）。查询路径不受影响，因为工具结果本来就有 `tool/call` + `tool/result` 这对已知事件可用。
2. **辅助查词请求不进 session log**。因此查词时实际发送的提示词与原始响应无法从日志重建；可重建的是 `command/run`、`command/done` 与库中记录。这是有意接受的取舍，原因同第 1 条。若要消除，必须先确认外部插件写入带 `ignorable` 标记事件的可行路径。
3. **辅助调用不带用途分类**。`purpose` 是闭集，插件不能自造，因此适配器不会为该请求附加用途元数据。
4. **域 schema 无自动迁移**。`single` 布局下破坏性变更会以 `version-mismatch` 拒绝打开，`compatibleVersions` 不生效；v1 之后靠「只增可选字段」规避，破坏性变更需要一次性人工迁移。
5. **默认 json `single` 布局每次写入重写整份文件**。高频写入或大词量场景应改用 sqlite 路由，或切 `per-record` 布局（需接受键的路径安全约束）。

## 15. 后续（v2 候选）

- 词汇本浏览器面板（列表、搜索、排序）。这需要一条 Client → Host 的读取通道，届时评估自建 `/api` Fetch 路由与外部事件写入路径。
- 富录入卡片：先解决限制 1、2，再把权威事件或结构化结果接进 `ConversationNodeDefinition`。
- 标签、掌握度与复习调度；记录的编辑与删除。
- 词形还原与近义词，减少重复条目。

## 16. 实施顺序

1. 搭建 `plugins/wordbook/` 骨架（package.json、两个构建配置、patch、README），确认空插件能被 `--patch` 挂载。
2. `spec.ts` + `store.ts` + 单测：确认数据能落盘并能读取。
3. `prompts.ts` + `lookup.ts` + 单测：解析与规范化可离线验证。
4. `service.ts` + `command.ts` + 行为测试：打通录入链路。
5. `tools.ts` + 行为测试：打通 Chat 查询链路。
6. Client 半：locale、两张卡片、输入框 dock。
7. README 手工验收步骤 + 真机 e2e。

具体任务拆分与验收标准由后续的实现计划（writing-plans）细化。
