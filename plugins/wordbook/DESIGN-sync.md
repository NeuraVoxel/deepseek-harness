# 单词学习台 v2：自持存储、全文检索与多设备同步

状态：设计已评审，待实现 ｜ 日期：2026-09-13 ｜ 范围：`plugins/wordbook/`

前置阅读：[DESIGN.md](DESIGN.md)（v1，已实现）。本文只覆盖 v2 的存储与同步，**不改变任何用户可见的命令、工具、参数或卡片**。

## 0. 决策摘要

| 决策 | 选定 | 备选与否决理由 |
|---|---|---|
| 同步拓扑 | **本地优先 + 变更日志** | 中心权威需要长期运维一个服务，服务不可用即单点；单库文件无真并发合并 |
| 归并规则 | **字段级合并**（义项取并集） | 整条后写胜会丢掉另一台设备花了一次模型调用换来的释义 |
| 传输载体 | **同步目录 + 不可变段** | 自建 HTTP 顶点最好但要运维；git 在移动端不现实；现成云仍需 schema 与凭证 |
| 加密 | **明文 + 段信封预留 `format`** | 整段加密使同步盘不可 grep 且丢密钥即丢数据；预留字段保证将来可加而不改模型 |

**三个子决策共同的前提**：这是单用户的几台设备，写入是"想到了就查一个词"的频率，冲突概率极低但**离线必须能用**。

## 1. 目标、非目标与兼容承诺

**目标**：多设备共享同一本词书；检索从内存全表扫描升级为带索引的查询；离线天然可用；无中心服务。

**非目标**：多人协作与权限、云账号体系、实时协同编辑、复习算法。复习字段在 schema 中留位，但本期不实现调度。

**兼容承诺**：`/word [--refresh] <单词>`、`word_lookup`、`word_query` 的命令名、工具名、参数、输出 schema、两张卡片**全部不变**。`word_query` 只新增可选参数（分页、按词性/时间过滤），缺省行为与 v1 一致。v1 已存的 `$DSH_HOME/storages/wordbook.json` 通过一次性导入迁移，导入后可回退到 v1 插件版本。

## 2. 架构与接缝

```text
src/storage/
  repository.ts     领域唯一读写入口：get / put / query / size
  sqlite.ts         node:sqlite + FTS5：words 主表、words_fts 检索表、meta 表
  migrate.ts        schema 版本管理 + v1 JSON 一次性导入
src/sync/
  log.ts            操作日志与段文件读写（只写一次）
  merge.ts          纯函数：两份记录 → 归并结果
  transport.ts      传输接口：listSegments / readSegment / publishSegment
  dir-transport.ts  同步目录驱动（第一期唯一驱动）
  engine.ts         同步编排：拉段、归并、记账、缺口检测
```

**关键接缝**：`store.ts` 由 `repository.ts` 取代，但成员名与语义保持完全一致（`get` / `put` / `query` / `size`）。因此 `service.ts`、`command.ts`、`tools.ts` 与整个 Client 半**不需要改动**——这是 v1 把全部读写收敛在单个模块里的直接回报，也是 v2 能分阶段落地的前提。

`spec.ts` 的 zod 记录 schema 保留：它从"存储域的校验器"变成"repository 边界的校验器"。`WORD_RECORD` 的字段语义不变。

## 3. 数据模型与检索

```sql
CREATE TABLE words (
  word TEXT PRIMARY KEY,           -- 规范化键（trim + 小写 + 空白折叠）
  display TEXT NOT NULL,
  phonetic_us TEXT,
  phonetic_uk TEXT,
  senses TEXT NOT NULL,            -- JSON 数组，保序
  meanings TEXT NOT NULL,          -- 由 senses 派生的扁平串，供 FTS 与 LIKE 使用
  model_provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,              -- 墓碑；不做物理删除
  origin_device TEXT NOT NULL      -- 平局决胜与诊断
);

CREATE VIRTUAL TABLE words_fts USING fts5(
  word, display, meanings, content='words', content_rowid='rowid', tokenize='unicode61'
);

CREATE TABLE sync_segments (
  segment_id TEXT PRIMARY KEY,     -- "<device>/<seq>"
  applied_at INTEGER NOT NULL,
  ops INTEGER NOT NULL,
  format TEXT NOT NULL             -- 段信封格式，加密扩展点
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- schema_version、device_id 等
```

`words_fts` 采用 **external content**（`content='words'`），索引不复制正文；主表插入、更新、删除都由同一事务内的触发器同步维护 `words_fts`。`meanings` 是 `senses` 的派生列，在同一事务内由 repository 重新计算——不允许调用方直接写它。

**中文分词的取舍（必须写清，否则检索会静默失效）**：`unicode61` 分词对中文几乎无效。规则是**按查询文本是否含 CJK 分流**：不含 CJK 走 `words_fts MATCH`（支持 `token*` 前缀）；含 CJK 走 `meanings LIKE '%…%'` 回退。两条路径都必须用 `EXPLAIN QUERY PLAN` 验证索引命中。`trigram` 分词器理论上兼顾中英文，代价是索引体积显著增大，**待实测后再决定是否切换**，不作为默认。

`word_query` 的 `total` 语义保持不变：截断前的命中总数，与 `entries.length` 分开报告。

## 4. 操作日志：不可变段

- 每台设备只写自己的目录：`<syncRoot>/wordbook/<deviceId>/<seq:08d>.jsonl`。
- **段只写一次**：先写 `.partial`，写完 `rename` 成最终名（原子发布），此后永不修改。"半写"与"同步盘冲突副本"这两类最难定位的故障从根上消失。
- 段内每行一条 op，自带 `v`（信封格式版本）、`device`、`seq`、`at` 与**完整记录体**。段文件不依赖任何外部元数据即可解释自己。
- 段边界：写满 200 条、256 KB 或 5 分钟任一触发即封段；末行写入 `segment-end` 与条数，供自校验。
- **不变量：本地 SQLite 是日志的物化视图。** 清空数据库后重放本地全部段即可完全恢复。这条把"日志缺一条"从静默损坏降级为可检测的段号缺口。

op 信封（`v: 1`，明文）：

```json
{"v":1,"device":"d-7f3a91","seq":12,"at":1789313379776,
 "op":{"kind":"upsert","record":{"word":"hello","display":"hello","senses":[],"meanings":"…","model":{"provider":"deepseek-official","model":"deepseek-v4-flash"},"createdAt":0,"updatedAt":0,"originDevice":"d-7f3a91"}}}
```

## 5. 归并规则

给定同键的本地记录 `L` 与日志记录 `R`：

| 字段 | 规则 |
|---|---|
| `display` | `updatedAt` 较新者；平局比 `originDevice`（或 op 的 `device`）字典序 |
| `phonetic_us` / `phonetic_uk` | 逐字段独立比较：各自取非空且较新者；一方缺失时保留另一方 |
| `senses` | **并集**：按 `(pos, meaning)` 去重（`meaning` 先 trim）；顺序为较新一侧在前，再追加另一侧的新义项 |
| `senses[].examples` | 同一义项内按字符串去重合并，每条义项上限 2 条（与提示词一致） |
| `model` | 取较新一侧。它是来源标记，不合并 |
| `created_at` | `min(L, R)` |
| `updated_at` | `max(L, R)` |
| `deleted_at` | 取较新一侧；仅当删除时间晚于两侧 `updated_at` 时记录保持墓碑 |
| 义项上限 | 归并后按 `maxSenses`（默认 8）截断；**截断优先保留较新一侧的义项**，再按另一侧顺序补齐；被截掉的条数记入 `meta`（键 `merge_truncated_total`），使"数据没丢只是没显示"可诊断 |

**三条必须由属性测试守住的正确性属性**（段的到达顺序不可控，这三条是全部正确性来源）：

1. **幂等**：同一段重复应用，结果不变。
2. **交换律**：`merge(A, B)` 与 `merge(B, A)` 结果相同。
3. **结合律**：三段以任意顺序归并，最终结果一致。

`merge.ts` 必须是**纯函数**：不读时钟、不读数据库、不读配置（`maxSenses` 作为参数传入）。这一层是 v2 里最值得投入测试的地方。

## 6. 同步编排

**写路径**：`repository.put` → SQLite 事务提交 → 追加 op 到当前段 → 立即返回，不等网络。

**同步路径**（手动触发 + 可选定时）：

1. `listSegments()` 扫描同步根下所有设备的段目录。
2. 与本地 `sync_segments` 对比得出待拉取集合；**段号缺口只记警告、不阻塞**——迟到的段会补上，缺口本身就是"还有段在路上"的信号。
3. 逐段读取 → 校验设备、段号、信封格式 → 按 op 顺序归并进 SQLite（单事务）→ 记录 `sync_segments`。
4. 自己的段在写入那一刻就已位于同步根，**"发布"即封段**，无需额外步骤。

**本地库不参与同步**：SQLite 留在 `$DSH_HOME/storages/wordbook.db`，只有段文件进同步盘。把 bin 文件放进同步盘本就是禁忌（WAL 依赖共享内存文件，部分同步客户端会损坏它）。

**时钟护栏**：以 `(updated_at, device)` 决胜；额外**拒绝 `updated_at` 超前本地时钟 `clockSkewToleranceMs`（默认 24 小时）的记录**并记为待确认。没有这条，一台时钟错乱的设备会在所有冲突中永久获胜。

**可观测性**：每次同步产出 `{pulled, merged, tombstoned, conflicts, gaps}`；`conflicts` 是触发过字段级合并的 op 数。v2 先写运行日志；界面展示留待后续。

## 7. 迁移（v1 → v2）

读旧 `$DSH_HOME/storages/wordbook.json` → 逐条 `repository.put`（`origin_device = 'legacy'`）→ **导入本身也写成日志段**，因此其它设备也能获得 v1 时期的历史词条。脚本可重复执行（upsert 与归并均幂等）。旧 JSON 文件**只读保留、不删不改**，迁移失败时可直接回退到 v1 插件版本。

## 8. 与 harness 存储接缝的取舍

| 失去 | 得到 | 补偿 |
|---|---|---|
| 域层的 zod 校验与格式版本错误码 | SQL 查询与 FTS5 全文检索 | repository 边界自己用 zod 校验；`meta.schema_version` + 显式迁移函数 |
| `domain/changed` 变更事件 | 事务、跨设备同步日志 | repository 自己发变更事件 |
| `single` / `per-record` 布局与介质路由 | 可控的 schema 演进 | 迁移函数按版本号显式执行 |

这是**有意从"复用 harness 存储接缝"改为"自持存储"**。理由：storage 域给不了 FTS，也给不了跨进程新鲜度——域的内存态在 `open` 时一次性加载且没有 reload，`domain/changed` 只在本进程内广播。多设备共享恰恰要求后者。

因此 v1 [DESIGN.md](DESIGN.md) §5 中"切换介质是配置变更而非代码变更"只对 v1 的介质替换成立，v2 起不再适用。

## 9. 配置项

全部为 validated `Config` 字段，可从 patch 覆盖。

| 字段 | 默认 | 含义 |
|---|---|---|
| `syncRoot` | 未设置 | 同步根目录；未设置时同步整体关闭，只用本地库 |
| `deviceId` | 自动生成 | 稳定设备标识，落在 `$DSH_HOME/storages/wordbook-meta.json` |
| `segmentMaxOps` | 200 | 单段最大 op 数 |
| `segmentMaxBytes` | 262144 | 单段最大字节数 |
| `segmentMaxAgeMs` | 300000 | 单段最长存活时间 |
| `syncOnStart` | true | 启动时同步一次 |
| `syncIntervalMs` | 0 | 定时同步间隔；0 表示仅手动 |
| `clockSkewToleranceMs` | 86400000 | 允许的超前时钟 |
| `encryption` | `none` | 段信封编码；预留扩展点 |
| `maxSenses` | 8 | 沿用 v1：提示词上限、解析上限、归并上限 |

## 10. 安全与威胁模型（明文）

**选择**：v1 的同步段为**明文 JSONL**。段信封预留 `format` 字段，将来可加整段加密而不改数据模型。

**暴露面**：同步目录若落在 iCloud / Dropbox / OneDrive，则**词条的明文与所用模型 id 对该服务商可见**。段中不含会话内容、提示词、API 凭证或任何 session 事件——只有词条记录本身。

**不构成暴露**：`deviceId` 是随机标识，不含机器名或用户信息；本地 SQLite 与旧 JSON 文件都在 `$DSH_HOME` 下、权限 `0600`，不进同步盘。

**将来加密的约定**（本期不实现，但设计上预留）：密钥由口令经 scrypt 派生，只存本地 `$DSH_HOME/credentials`（`0600`）或环境变量；段文件名后缀标记编码（`.jsonl` / `.jsonl.enc`），`sync_segments.format` 记录实际格式；解码器按 `format` 注册。加密的直接代价：同步盘内不可 grep，且**密钥丢失即数据全丢**。

## 11. 测试矩阵

| 层 | 覆盖 |
|---|---|
| `merge.ts` | 三条属性（幂等 / 交换 / 结合）+ 逐字段用例：墓碑、时钟倒挂、义项超限截断、`display` 平局比 deviceId、一方缺音标 |
| `log.ts` | 段边界三条件、`.partial` 未完成段被忽略、段号缺口、末行 `segment-end` 自校验、重复应用同一段 |
| `sqlite.ts` | schema 版本迁移、FTS 与主表一致性（删除后搜不到）、`total` 与 `limit` 语义不回退、`meanings` 派生正确 |
| `migrate.ts` | v1 JSON 导入可重跑、导入生成日志段、失败可回退 |
| 端到端 | 两个"设备"目录 + 一个临时同步目录：A 写 → 同步 → B 可见；双方同词写入 → 义项并集；删除传播；段乱序到达收敛一致 |

端到端测试只使用临时目录，**不触碰用户的同步盘**。

## 12. 分阶段实施

1. **repository + SQLite + FTS**（不含同步）+ v1 数据导入。先拿到检索收益，本地行为不回退。
2. **日志 + 归并纯函数 + 属性测试**（不含传输）。先证明归并是对的。
3. **同步目录驱动 + 编排 + 两设备端到端**。
4. **运维面**：同步状态、冲突计数、备份建议。

风险最高的归并逻辑被隔离在第 2 阶段，可用纯函数彻底测透；第 1 阶段独立回本；同步在第 3 阶段才引入，此时本地库与日志的正确性已经被测试守住。

## 13. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 中文检索静默失效 | 按 CJK 分流 + `EXPLAIN QUERY PLAN` 断言 |
| 归并规则在实现里"随手决定" | 规则表逐字段写入本节；`merge.ts` 纯函数 + 属性测试 |
| 时钟错乱的设备永久获胜 | `clockSkewToleranceMs` 护栏 + 待确认标记 |
| 段文件被同步客户端部分上传 | 段只写一次 + `.partial` → rename 原子发布 |
| 日志与数据库不一致 | 不变量"库是日志的物化视图" + 可重放 + 段号缺口检测 |
| 迁移动摇 v1 数据 | 旧文件只读保留；导入幂等可重跑；可回退插件版本 |
| 义项在并集后无限膨胀 | 归并上限 + 截断优先级 + 截断计数可诊断 |

## 14. 待定项

- **FTS 分词器**：`unicode61` + LIKE 回退是否够用，或改 `trigram`；需实测中文检索质量与索引体积。
- **删除入口**：v2 的墓碑机制就绪，但界面上还没有删除动作（`/word --forget` 或词汇本面板）。
- **同步的界面呈现**：状态、冲突计数、上次同步时间；本期只写日志。
- **复习字段**：`senses` 之外是否加 `mastery` / `dueAt`，以及它们如何参与归并。
