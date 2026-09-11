# deepseek-harness 测试范围：按粒度划分

首次撰写：2026-09-11

> 学习笔记，非正式权威。权威入口：[docs/testing.md](../../docs/testing.md)（中文：[testing.zh.md](../../docs/testing.zh.md)）。命令清单见根 [AGENTS.md](../../AGENTS.md)。与 kit 自闭环对照见 [ai-eng-kit 与 harness 规范对比](2026-09-11-ai-eng-kit-vs-harness-conventions.md)。

## 一句话

本仓用**多层测试**证明不同范围的事：窄层快、定位准；宽层抓「单测全绿、产品却坏」。**Snapshot** 是整机 **回放**（可重复、通常无 key）；**E2E** 是整机接 **真 API**（要 key、可 skip）。

## 粒度表（由窄到宽）

| 更窄 | 更宽 |
|---|---|
| **Unit**（`pnpm run test`）— 包内行为、边界、竞态；`tests/**` + `scripts/**/*.spec.ts` | |
| **Coverage**（`pnpm run test:coverage`）— `packages/*/*/src` **per-file 100%**；未覆盖常当死代码 | |
| **Expected**（`pnpm run test:expected`）— 组装后的 CLI/进程期望输出；可无 recorded Session | |
| **Snapshot**（`pnpm run test:snapshot`）— 整条 shipped `dsh` profile；模型用 **录好的 Session JSONL 回放** | |
| **Web**（`pnpm run test:web`）— Chromium 对比 UI/ARIA（常挂同一类 Session 证据） | |
| **E2E / Real-API**（`pnpm run test:e2e`）— 同类产品路径，但 DeepSeek 等为 **线上真调用**（`DEEPSEEK_API_KEY` 等；无 key 则 self-skip） | |
| **Bench**（`pnpm run test:bench`）— 时间/堆/扩展预算；证明性能，不是功能对错 | |

## 记忆口诀

**单测看零件，snapshot 看整机回放，e2e 看整机接真电源。**

## 易混三点

1. **E2E ≠ 「真机设备」** — 这里是 **真服务 / 真提供方 API**，不是手机真机调试。
2. **文件名带 `*.e2e.ts` 不一定是 `test:e2e`** — 例如 `*.expected.e2e.ts` 属于 **expected** 层。
3. **Snapshot 与 E2E 都「大」** — 证据不同：snapshot 可复现、keyless CI；e2e 证明线上模型/网络仍可用。政策：无 key 只证明管道，有 key 才证明对真模型可用。

## 和 ai-eng-kit 的对照（一眼）

| | harness | kit（自闭环） |
|---|---|---|
| 单元 + 覆盖率 | unit + **per-file 100%** | unit + **statements ≥ 90**（`test:coverage`） |
| 文档 / Note | `doc-sync` 等 | `verify-notes` + 轻量 docs 闸门 |
| 「产品」宽层 | expected / snapshot / web / **real-API e2e** / bench | **built `lib/cli` + `init`→`verify-notes` smoke**（无 session replay） |

kit 不搬 harness snapshot/e2e；只验证本包 CLI/脚手架承诺。

## 相关命令速查

```sh
pnpm run test
pnpm run test:coverage
pnpm run test:expected
pnpm run test:snapshot          # 回放；录制用 test:snapshot:record
pnpm run test:web
pnpm run test:e2e               # 需要 DEEPSEEK_API_KEY（等）
pnpm run test:bench
```
