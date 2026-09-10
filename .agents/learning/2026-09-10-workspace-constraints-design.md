# Workspace constraints 设计分析

首次撰写：2026-09-10

> 学习笔记，非正式权威。权威入口：`scripts/check-workspace-constraints.ts`、`docs/cookbook/adding-a-package.md`、相关 Agent Note。

## 一句话

本仓库把「workspace 里每个 `package.json` 必须长什么样」写成**包管理器无关的、只检查不改写的门禁脚本**，用计算出来的期望值对照现实，例外一律显式命名。

## 它在约束栈里的位置

仓库里「约束」一词出现在多层，职责不同：

| 层 | 代表 | 约束什么 | 失败形态 |
|---|---|---|---|
| Workspace constraints | `pnpm run constraints` | manifest / 目录拓扑 / 发布面 / 依赖协议 | CI / hygiene 非零退出 |
| 相邻 hygiene 门禁 | publint、`verify-package-dependencies`、`verify-package-invariants`、`verify-runtime-closure` 等 | 发布正确性、依赖闭包、`./invariant` 配套 | 同上，各管一段 |
| 文档 Known Limitations | 各包 README 固定小节 | **当前**能力边界（不是 backlog） | `verify-package-readme-limitations` |
| 运行时 invariant / policy | `dsh-invariants`、sandbox / permission / fs observation | Session 事件关系、执行权限 | 运行时拒绝或诊断 |

本文只展开 **workspace constraints** 这一层：它是「包长什么样」的机械合同，不是运行时策略，也不是 README 里的 Known Limitations。

## 设计来源

1. **Yarn 4 时代**用 `yarn.config.cjs` + `@yarnpkg/types`，可 `workspace.set()` **自动改写** manifest。
2. 迁到 pnpm 后（[pnpm-over-yarn](../notes/implemented/process/2026-06-16-pnpm-over-yarn.md)），约束改成 `scripts/check-workspace-constraints.ts`，经 `pnpm run constraints` 调用。
3. 刻意做成 **check-only**：只报错、不修文件。理由是 CI 本来就不跑 `--fix`，手工改一行够用；换来的是门禁与包管理器解耦。
4. 曾考虑用 `syncpack` / `manypkg` 替换（[NIH audit 拒绝项](../notes/rejected/simplification/2026-07-26-dependency-swaps-rejected-by-nih-audit.md)）：它们只覆盖约 20 行的版本对齐；真正承重的是**仓库私有政策**（计算 `files`、cordis peer=dev、层级形状），通用引擎表达不了。

这条线与 [mechanical quality gates](../notes/implemented/process/2026-06-11-quality-gates.md) 一致：对 agent 友好的约定必须是**可退出非零的命令**，而不是散文。

## 执行面怎么挂

- 根脚本：`"constraints": "tsx scripts/check-workspace-constraints.ts"`。
- 聚合：`hygieneLeafGates` 与 `ciStaticGates` 都跑它（见 `scripts/run-gates.ts`），与 publint、package-dependencies 等并列，不依赖 `build`。
- 单元测试：`scripts/check-workspace-constraints.spec.ts` 钉住 experimental 政策、`files` 推导、dsh 家族版本一致性等**可导出函数**；全树扫描留给门禁本身。

## 扫描范围与分层规则

脚本按固定 depth 发现 workspace：

- `vendor/*`、`native/*`、`native/system/packages/*`、`apps/*`（depth 1）
- `packages/<group>/<pkg>`（depth 2；group 目录本身**禁止**有 `package.json`）

然后再按**身份**套不同规则，而不是一张表打天下：

```
根 version 形状
  └─ 每个 manifest
       ├─ experimental 命名 / private / publishConfig
       ├─ dsh 家族 version == 根 version
       ├─ release member vs 必须 private vs Landlock 特例
       ├─ vendored：过完发布身份后提前 return（不套 dsh 形状）
       ├─ 发布 payload 禁止项（src、map 等）
       ├─ apps 的 files 白名单
       ├─ native public 包 version == native workspace
       └─ packages/@deepseek-ai/dsh-*：ESM / main / types / exports / cordis peer+dev / 计算 files
  └─ workspace: 协议（所有依赖段）
  └─ experimental 不得进入 release 运行时依赖
  └─ packages 层级形状
  └─ tsconfig project-reference face（委托 project-reference-faces.ts）
```

设计要点：**身份先分类，再约束字段**。同一字段（如 `private`、`repository`、`files`）在不同身份下含义相反——release member 必须可发布且 `publishConfig.access: public`；普通 experimental 必须 `private: true` 且省略 `publishConfig`；公开 experimental（Agent Teams 等）再开白名单。

## 约束内容按意图归类

### 1. 拓扑：仓库物理布局即政策

`checkHierarchyShape` 强制 `packages/<group>/<pkg>`，拒绝：

- group 目录自带 `package.json`（扁平化）
- 更深嵌套（没有 package.json 的「空壳层」）

布局本身成为门禁，避免「目录约定」只活在 AGENTS.md 里。

### 2. 发布身份：谁可以上 npm

- **Release member**（标准 `packages/` / 部分 `apps/` / vendor / 公开 experimental）：不得 `private`，必须 `publishConfig.access: public`，`repository` 指向 `publishedRepositoryUrl` + 正确 `directory`。
- **Landlock / node-addon-system 公开包**：另一套 `repositoryUrl`（trusted publishing 与源仓库绑定），version 跟 native workspace，不跟 dsh 根版本。
- **其余包**：必须 `private: true`。
- **Experimental**：名字前缀 `@deepseek-ai/dsh-experimental-`；默认私有；公开例外走 `isPublicExperimentalPackageDirectory`。

再加一条隔离：`checkExperimentalDependencyIsolation`——正式 release 与 `python/sdk-runtime` 的**运行时依赖段**不得引用 experimental 包（dev 仍可，便于测试）。

### 3. dsh 包形状：统一消费品面

对 `packages/**` 下 `@deepseek-ai/dsh-*`：

- `type: module`，`main` / `types` / `exports["."]` 固定指向 `lib/` 产物
- `@deepseek-ai/cordis` **同时** peer + dev，且 range 字符串完全一致
- `exports["./invariant"]` 若存在，types/default 必须成对且路径固定
- `files` **不是手写自由列表**，而是 `expectedDshPackageFiles(manifest)` 算出来再全等比较

`files` 的计算规则体现「约束怎么设计」的核心手法：

- **默认基线**：`lib/index.js` + `lib/types/**/*.d.ts`
- **从 exports 推导**：有 `./invariant`、`bin`、特定 `./worker`/`./client`/`./loader`/`./store`/`./startup`、typert 面、emitted tree 等 → 追加对应产物
- **从 `dsh.bundle.patch` 推导**：bundle 补丁文件进包，无需按包名登记
- **少数额外产物**：`packageFileExtras` 按包名显式追加（CSS、preset 目录、worker 私有入口等）

即：**能从 manifest 结构推出的不进白名单；推不出的才点名。** 禁止发布源码 / map 等用 `isForbiddenPublicationFile` + 极窄 `publicationSourceAllowlist`。

### 4. 版本与依赖协议

- 根 `version` 必须是 `X.Y.Z`（可带 prerelease）——这是 dsh release 家族的单一版本源。
- 所有 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 version 必须等于根（`checkDshFamilyVersion`）；cordis / native 等其他序列故意不碰。
- 凡依赖指向 workspace member，range 必须以 `workspace:` 开头。手写 `^0.0.1` 在 `pnpm pack` 时不会替换成真实版本，会发布出不存在的版本号（[npm-release-sequences](../notes/implemented/process/2026-08-10-npm-release-sequences.md)）。

## 设计手法（可复用的模式）

1. **机械门禁优先于散文**
   AGENTS / cookbook 描述同一套规则，但以脚本为真；散文跟脚本漂移时修散文或扩门禁。

2. **Check-only，失败即大声**
   收集全部错误再一次性打印退出；不做 silent skip、不做 auto-fix。与仓库「misconfiguration fails loud」一致。

3. **期望值由函数生成，再严格相等**
   `files`、部分 app payload 用「算出 expected → `sameStringList`」而不是「允许超集」。超集会让多余文件悄悄进 tarball。

4. **例外是命名数据，不是注释**
   `packageFileExtras`、`appPackageFiles`、`publicationSourceAllowlist`、`publicNativePackages`、公开 experimental 目录集合——新例外必须改脚本（通常还要加 spec），review 看得见。

5. **身份分派，拒绝一张万能 schema**
   experimental / release / vendor / native / app 字段语义不同；过早统一会逼出错误的 `private` 或错误的 repository URL。

6. **与相邻门禁切分，不重复权威**
   - constraints：manifest 形状与 workspace 政策
   - publint：打包结果是否「像合法 npm 包」
   - `verify-package-dependencies` / runtime-closure：import 与声明是否闭合
   - `verify-package-invariants`：`./invariant` 该不该存在
   换工具替换其中一层时，其它层仍在；这也是拒绝 syncpack 的原因——替换不了「仓库私有」那一大块。

7. **可测的政策抽成导出函数**
   `checkExperimentalManifest`、`expectedDshPackageFiles`、`checkDshFamilyVersion` 等导出供 spec 钉；`main()` 只做发现与汇总。政策变更优先改导出函数 + 测试，再跑全树门禁。

## 与「Known Limitations」别混

README 的 Known Limitations 也常被英文写成 *current package constraints*，但那是**产品能力边界的文档合同**（还有门禁要求段落存在或 allowlist）。
Workspace constraints 管的是 **package.json / 目录 / 发布面**。两者都「约束」，权威与失败路径完全不同。

## 阅读顺序（想改规则时）

1. `scripts/check-workspace-constraints.ts`（实现 + 注释里的 why）
2. `scripts/check-workspace-constraints.spec.ts`（已钉住的拒绝路径）
3. `docs/cookbook/adding-a-package.md`（贡献者可见合同）
4. Agent Note：`2026-06-16-pnpm-over-yarn`、`2026-08-10-npm-release-sequences`、`2026-08-18-experimental-agent-teams-packages`、NIH audit 里对 syncpack 的拒绝

## 小结

Workspace constraints 的设计不是「列一堆 lint 规则」，而是：

- 把 monorepo 身份模型编码进一个独立脚本；
- 用**推导 + 全等**固定发布 payload；
- 用**显式例外表**吸收真正特殊的包；
- 用 **check-only + CI hygiene** 让 agent 与人类在同一失败信号上对齐。

若以后加新约束：先问「这是哪一种身份的政策？能否从现有 manifest 字段推导？必须点名的例外叫什么？」——答得清，再落进脚本与 spec；不要先写 AGENTS 散文。
