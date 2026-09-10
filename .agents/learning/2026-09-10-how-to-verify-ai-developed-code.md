# 当前项目中，针对 AI 开发完成的代码，如何进行验证测试？

首次撰写：2026-09-10

> 学习笔记，非正式权威。权威入口：`docs/testing.md` / `docs/testing.zh.md`、根 `AGENTS.md` 的 Commands / Run relevant checks、`.agents/skills/dsh-pre-push-checks/SKILL.md`、`snapshots/AGENTS.md`。

## 一句话

**按变更表面选最窄证据；验证外部世界而非 agent 自述；单元与覆盖率不够，模型/用户可见变更还要录制会话快照，产品路径优先带密钥冒烟；CI 负责全量，本地不默认跑全套。**

## 问题

AI（含本仓库 agent）写完代码后，用哪些手段证明行为正确、产品路径未断？与「单测绿了就算完」差在哪里？

## 分层手段

| 层级 | 命令 | 验证什么 |
|---|---|---|
| 单元 | `pnpm run test` | 包内行为、边界、错误路径、竞态、HMR 清理 |
| 覆盖率门禁 | `pnpm run test:coverage` | `packages/*/*/src` 按文件 100%；CI 门禁；行跑过 ≠ 功能正确 |
| 真实 API e2e | `pnpm run test:e2e` | 真实模型/提供方；无密钥自跳过 |
| 所属预期输出 | `pnpm run test:expected` | 无会话录制的 CLI/进程预期 |
| 录制会话快照 | `pnpm run test:snapshot` | 模型/协议/用户可见行为的无密钥回放 |
| Web 浏览器快照 | `pnpm run test:web` | Chromium 下会话驱动与 UI-only 预期 |
| 性能基准 | `pnpm run test:bench` | 用户路径的耗时/堆/缩放预算 |
| 静态质量 | `typecheck` / `lint` / `hygiene` / `doc-sync` | 类型、风格、包卫生、文档一致性 |

推送前用 `dsh-pre-push-checks` 按 diff 选最小集合；不要默认跑全套。

## 针对 AI 产出特别重要的规则

1. **验证外部世界，不信自述**
   e2e 应重新读文件、重跑命令、比对字节；不要只在 agent 回复里搜关键词（作弊 agent 也能通过关键词探测）。

2. **优先真实现，少 mock**
   只 mock LLM / 网络 / 时钟等开销高或不确定边界；工具注册表、loop、持久化尽量真实。

3. **测真实入口**
   产品可见插件要走 Loader + 测试用 `cordis.yml`；发布路径测构建后的 `lib/`（plain `node`），不只测 tsx 源码路径。

4. **模型/用户可见变更必须有快照**
   非平凡的 transcript、协议、UI 变更，同一 PR 更新 `snapshots/` 下录制会话；包级/e2e/仅 mock 不能替代组装后的 transcript。

5. **带密钥冒烟价值最高**
   启动已交付 `dsh` profile → 发一条 prompt → 检查文件系统/外部状态。抓「单测全绿、产品已坏」这一类。

6. **手工试跑**
   `pnpm dsh --profile headless "task"`（需 `DEEPSEEK_API_KEY`）。

## 按变更类型怎么选

| 变更表面 | 最小证据 |
|---|---|
| 包逻辑 | 聚焦 Vitest；（必要时）该包 `--coverage.include` |
| 模型/CLI/终端可见输出 | 对应 `test:snapshot` / `test:expected` / `test:web` |
| 能力 seam / 生命周期 | 计划阶段写清：单元 + e2e + snapshot |
| Agent-loop / SessionEventMap | 同时更新 TS（`snapshots/sdk/`）与 Python SDK 投影 |
| 文档 / Agent Notes | `pnpm run doc-sync` |
| 构建 / 导出 / bin / worker | `build` + hygiene + 所属 built-artifact smoke |
| 真实 provider / agent 行为 | 有密钥时跑相关 `test:e2e` |

## 快照与预期输出放哪

- **有录制 Session 往返**（JSONL 既是回放输入又是预期持久化结果）→ 顶层 `snapshots/`，`snapshot.yml` 声明 shipped `dsh` profile。
- **无会话往返的预期**（ARIA、CLI、generator 等）→ 所属 app/包/脚本的 `tests/expected/`，走 `test:expected` / `test:web` / `test`，不要塞进 `snapshots/`。

变更 workspace 的场景另有独立 oracle：`workspace.expected/`；record/refresh 不改写它；模型散文与 tool-result 文本不能代替外部效果证明。

## 易混点

| 说法 | 实际含义 |
|---|---|
| `pnpm run test` | 单元；不是 CI 覆盖率门禁 |
| `pnpm run test:coverage` | CI 覆盖率门禁；证明行执行过，不证明交付行为 |
| `test:e2e` | 带密钥真实 API；无密钥自跳过 |
| `test:snapshot` | 无密钥录制会话回放；模型可见变更的必需证据 |
| `test:expected` | 无会话录制的组装预期 |
| mock 桥接测试 | 证明桥接通路；不替代真实工具/Loader 组合 |

## 推荐工作顺序（AI 改完后）

1. 聚焦单测证明局部行为（必要时带窄 `--coverage.include`）。
2. 若触及可见输出 / 能力 seam：更新或新增 snapshot / expected，并回放。
3. 若触及产品入口：Loader 组合或 built smoke；有密钥则 profile 冒烟。
4. 文档/契约变更：`doc-sync` 等表面匹配检查。
5. 推送前按 `dsh-pre-push-checks` 选相关证据；全量留给 CI。
