# 这个项目的 AI 工程化：一套弱约束 / 硬约束的治理体系

本文分析的是**规范体系本身**——这个仓库如何组织"弱约束（散文、惯例、评审注意力）"与"硬约束（门禁、类型、运行时不变式）"，以及二者之间如何升降。不涉及具体实现逻辑；涉及处给出决策记录链接，以那份记录为准。

## 0. 前提：主要开发者是 agent，所以规范的失效模式变了

整套体系的出发点写在 [2026-06-11-quality-gates](../notes/implemented/process/2026-06-11-quality-gates.md)：*"Agents follow enforced gates far more reliably than prose conventions"*，并且 *"a lot of work is not a cost argument when agents do the labor"*。早期证据是 vitest 不做 typecheck，于是没过 typecheck 的测试被合入，只靠评审才发现。

这句话决定了后面所有取舍：**凡机械可检查的约定，一律升格为退出码**；散文只负责无法机械判定的部分——取舍、品味、"这条是否适用"。所以这个仓库的规范密度看起来偏执，其实是按"谁来执行"重新校准过的结果。

## 1. 约束是分层的，不是一张清单

| 层 | 载体 | 失败时机 | 典型例子 |
|---|---|---|---|
| L0 编译期 | 类型系统、ESM、branded id | 写代码时 | `strict` + `noImplicitAny`；跨边界 id 用 `Branded<B>` 而不是裸 `string` |
| L1 静态门禁 | `scripts/verify-*.ts`（30 余个）、oxlint、jscpd、publint | 提交/推送/CI | `verify-cordis-config`、`verify-application-entrypoints`、`verify-export-jsdoc`、`verify-doc-budgets` |
| L2 运行时不变式 | `./invariant` + `verify-package-invariants` | 运行时 / Vitest 拓扑 | 断言两个独立可观测事实之间的关系 |
| L3 散文规范 | `AGENTS.md`、`docs/AGENTS.md`、skills | 评审 | "Prefer symmetry"、"Keep comments local"、"一行一段" |
| L4 记录与流程 | Agent Note、learning、labels、PR 历史 | 事后追溯 | 决策必须带 `## Alternatives considered` |

分层的关键不是"哪层更强"，而是**每层有明确的管辖范围**：L1/L2 管能判定的，L3 管要判断的，L4 管无法写进代码的取舍理由。

## 2. 硬约束的设计原则：只断言"独立可观测"的关系

[2026-07-19-package-invariant-runtime-contracts](../notes/implemented/architecture/2026-07-19-package-invariant-runtime-contracts.md) 定义了一条我很认同的门槛：一个 invariant 必须断言**两个独立可观测的运行时事实之间的关系**。因此：检查服务是否存在、插件元数据是否齐全、某个方法名在不在、固定示例是否跑通——全部**不算** invariant，因为类型和加载测试已经覆盖。空实现与"检查存在性"的检查会被门禁直接判为非法。

这条门槛的价值在于防止门禁通货膨胀：如果"存在即合规"的检查也算 invariant，那 invariant 数量可以无限增长而信息量为零。同样的洁癖也出现在别处：`verify-client-ui-i18n` 断言客户端 UI 源文件不少于 450 个，防止检查本身随着文件被误删而**静默缩小**。

## 3. 弱约束升格为硬约束的判据

这个仓库不是一开始就把一切门禁化；它反复在"散文守不住 → 升格"这个方向上移动，而且每次都留下理由。

- **判据一：散文已被证明守不住。** 文档预算（[2026-07-04](../notes/implemented/process/2026-07-04-doc-tiers-and-budgets.md)）的原文是 *"review alone did not prevent that growth"*——在已有写作规范和评审注意力的情况下，standing docs 仍然持续堆积重复规则、复述的事故、重复的 package map。另一个例子是类型：vitest 不 typecheck 导致漏网，于是把 typecheck 独立成门禁。
- **判据二：规则可判定且误报可控。** "Ban `prove` + `nance`"这条看起来像文字洁癖，但有 `verify-concrete-terms.ts` 强制执行，并且带**显式豁免清单**：`vendor/`、`.agents/notes/archived/`、以及生成的持久化 schema 区域（保留其被钉住的历史标识符）。
- **判据三（反向）：覆盖面过宽的门禁要撤。** [2026-08-19-remove-knip](../notes/implemented/process/2026-08-19-remove-knip.md) 记录了静态死代码扫描为何不在这套门禁里；文档预算也明确拒绝"对所有文档设上限"，理由是那会惩罚**恰好应该长**的文档（特性矩阵、类型目录，每一行都是事实），并制造 per-file override churn，把贡献者训练成橡皮图章。

一句话总结这个判据：**能被廉价判定、且误报不会训练出橡皮图章的规则，才配成为门禁**。

## 4. 硬约束的可信度来自它的例外通道

这里的每一条硬约束都配了一个"必须写理由"的出口，而不是"要么遵守要么绕过"：

- 覆盖率：不可达的防御性分支用 `/* v8 ignore */` 并**陈述理由**，不允许直接删掉代码来达标。
- 重复检测：jscpd 允许 narrow source-range exceptions，用于刻意的平行实现。
- 文档预算：未达标的文档冻结 ceiling 只能降不能涨；达标后保留 5% headroom 并持续 ratchet；要提高上限必须在 PR 里显式论证。
- 归档：`.agents/notes/archived/` 被永久冻结，明确"不得当作当前行为的权威"——历史记录不会因为曾经正确而获得解释现状的权力。
- 门禁自身也是代码，配置变更和变更本身一样要评审。

## 5. 默认收紧：不确定时选"响亮失败"，而不是"静默降级"

这是贯穿全仓库的一条元规则，且几乎每次都附带了风险评估：

- `ignorable` 事件标记**默认必需**：忘了标记只是过度拒绝一次可恢复会话（不便），默认可忽略则是静默恢复一个被掏空的会话（安全事故）（[2026-08-10](../notes/implemented/architecture/2026-08-10-session-log-version-mechanism.md)）。
- 权限守卫**单调**：只能收紧，后面的监听器不能撤销一次 deny。
- 审批 **fail closed**：没有 answerer、answerer 抛错或返回不合规，结果是 `unavailable` 即拒绝，而不是放行。
- 误配置**加载期就失败**（挂两个同类后端直接报错），未声明的能力请求被明确拒绝而不是"接受后忽略"。
- 读到更新版本的会话格式**拒绝并指明方向**，且已发布的代永不移动、覆盖、删除。

理由很实际：在 agent 执行的场景里，静默降级几乎不可观测——没人会读到那句"已跳过"。错误必须在离决策最近的地方爆炸。

## 6. 单一权威：一个事实只能有一个家

这条规则在四个层面同时生效，且都是为了防止"第二权威必然漂移"：

- **数据层**：会话日志是唯一真相，模型历史、transcript、telemetry、索引全是派生；SQLite 是派生索引而非源。
- **文档层**：docs tier 要求 *one home per fact*，禁止在归属层级之外复述同一事实。
- **API 层**：pre-stable 阶段**不做兼容别名**，所有仓库内消费者一起改——别理会保留重复的包身份与服务身份，使后续发现变得含糊（[2026-09-12 ptc-runtime-vocabulary](../notes/implemented/architecture/2026-09-12-ptc-runtime-vocabulary.md)）。
- **知识层**：决策（Agent Note，归档后冻结）/ 观察（learning，可弃）/ 合同（docs）/ 流程（skills）四类分开，任何一处都不能主张它维护不了的权威。

## 7. 规则的存放位置也是设计

[2026-07-04](../notes/implemented/process/2026-07-04-doc-tiers-and-budgets.md) 拒绝把写作标准塞进 `SKILL.md`，理由是：*合同写在 docs，流程写在 skills*；一个塞进 SKILL.md 的标准，对**没有调用该 skill 就去改文档的 agent 是不可见的**，而 `docs/AGENTS.md` 会以 subtree 指令的形式自动加载给任何在 `docs/` 下工作的人。

同一思路在代码侧的对应物是"显式优于隐式"：`resolve(request) -> Spec` 让默认值与上限只有一个集中且可检查的位置（[`packages/shell/shell/README.md`](../../packages/shell/shell/README.md)），插件内不许硬编码可调项。规范与默认值遵循同一原则：**放在会被加载到之处，而不是放在需要记得去查看之处**。

## 8. 成本纪律：不为"跑全套"付账

门禁很多，但执行策略是分层的，写在 AGENTS.md 与 `dsh-pre-push-checks` skill 里：pre-commit 只拦便宜缺陷，pre-push 跑增量，CI 拥有穷尽覆盖与平台矩阵；本地**按证据匹配表面**只跑相关命令，不重复已通过的检查，"never default to the full suite"。真实 API 的 e2e 无 key 时 self-skip，文档里明确写了这不是成本信号——*"We are DeepSeek — do not ration real-API tests"*。

这解释了为什么可以承受 30 余个 `verify-*` 脚本：成本被分摊到不同的执行时机，而不是每次全跑。

## 9. 可带走的清单（另起一个 AI 项目时怎么搭这套体系）

1. 先分类：这条规则是**能判定**还是**要判断**？能判定的一律写成退出码，要判断的才留在散文里。
2. 给硬约束设门槛：只断言独立可观测的事实关系，拒绝"存在即合规"的检查，否则门禁会通胀为零信息量。
3. 给每条硬约束配一个**写理由的例外通道**；没有出口的门禁会逼出绕过。
4. 默认收紧，失败响亮；把"过度拒绝"和"静默放行"的成本显式对比后再定默认值。
5. 一个事实一个家；pre-stable 阶段不做兼容层，让所有消费者一起动。
6. 规则放在会被自动加载的位置（subtree 指令、gates），而不是塞进需要主动调用的 skill。
7. 定期回看门禁：是否在制造 override churn 与橡皮图章？是就缩小覆盖面或撤掉（knip 就是这么走的）。
8. 为 agent 校准密度：门禁密度 > 散文密度；流程写进 skill，合同写进 docs，决策带被击败方案。

## 待观察 / 未吸收

- 100% 每文件覆盖率的已知失败模式是"无断言测试"，对冲手段 mutation testing 仍停在 `notes/proposed/`。
- `verify-*` 脚本已 30 余个，门禁自身的维护成本与认知负担是个未定价的负债，仓库目前用聚合（`doc-sync`、`hygiene`、`ci-primary`）而不是精简来应对。
- 纯弱约束层（对称性、注释局部性、措辞）完全依赖评审，没有任何机械兜底；是否有规则会在这里漂移并被事后升格，值得下次回来对照。
