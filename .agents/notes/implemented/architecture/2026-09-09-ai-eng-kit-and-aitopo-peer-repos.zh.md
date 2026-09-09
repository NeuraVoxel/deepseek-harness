# Agent Note: AI eng kit and aitopo peer repositories

Status: implemented

[English](2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md) | 中文

## Problem

DeepSeek Harness 已沉淀的可复用 AI 工程化实践（Agent Notes、AGENTS 站桩指令、skills、文档门禁与测试工程策略）困在本 monorepo。`@neuravoxel/aitopo` 作为 first-party 源码落在 `vendor/aitopo`，阻碍独立迭代，并迫使非 Cordis 库走 Cordis 式 vendor 记账。

## Decision

三个 GitHub 项目在 K1 下为完全并列的 peer（仅 cherry-pick，无父子权威）：

| Peer | Remote | Role |
|---|---|---|
| `ai-eng-kit` | `NeuraVoxel/ai-eng-kit` | 可移植工具包 `@neuravoxel/ai-eng`（`init`、`verify-notes`、skills、测试政策文档）。 |
| `aitopo` | `git@github.com:NeuraVoxel/aitopo.git`（私有） | Canvas 拓扑引擎。在自身 CI/贡献者工作流中使用 ai-eng-kit；引擎内无 React/Cordis/`@deepseek-ai/dsh-*`。 |
| `deepseek-harness` | 本仓库 | 仅通过 `vendor/aitopo` git submodule 消费 aitopo（日后 npm）。不依赖 ai-eng-kit。托管未来的 `agent-observe` 适配层。 |

`vendor/aitopo` 钉扎到 `NeuraVoxel/aitopo`。不适用 Cordis sync。引擎改动在 peer 仓完成；本仓只 bump submodule SHA。克隆需 `--recurse-submodules`（或随后 `git submodule update --init --recursive`）。

本决策取代 [2026-09-07-aitopo-dual-face-canvas-engine.zh.md](../../proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.zh.md) 中仓内 first-party 所有权选择。Dual-face 协议、clean-room 规则与引擎纯净性仍然有效。

## Alternatives considered

- **Kit 仅作拷贝模板：** 否决——易漂移。
- **Kit 作为完整 starter monorepo：** 否决——对库消费者过重。
- **Harness 自身门禁依赖 kit（K2）：** 否决——K1 保持 peer 独立。
- **aitopo 永远作为 `vendor/` first-party：** 否决——阻碍独立节奏。
- **Harness 第一天就用 npm 消费 aitopo：** 否决——在 API/发布节奏稳定前用 submodule 保留 monorepo DX。
- **React/Session 适配放进 aitopo 仓：** 否决——破坏引擎纯净。
- **层级化放在 deepseek-harness org：** 否决——明确为 NeuraVoxel peer。

## Consequences

- Harness 贡献者需要 submodule init；缺少 `vendor/aitopo/package.json` 会破坏 `@neuravoxel/aitopo` 解析。
- 在 `vendor/aitopo` 仍是 workspace 成员时，`pnpm install` 可能解析 aitopo 锁定的 `@neuravoxel/ai-eng` git pin；贡献者与 CI 需要对 `NeuraVoxel/ai-eng-kit` 有读权限。该安装并不使 harness 用 kit 跑自身门禁（K1）。
- CI checkout 设置 `submodules: true`，使用仓库 secret `NEURAVOXEL_PRIVATE_READ_TOKEN`（对私有 `aitopo` 与 `ai-eng-kit` 可读），并在 `pnpm install` 前运行 `scripts/ci-configure-private-git.sh`。submodule URL 为 HTTPS，以便 token checkout。
- harness 与 kit 的流程理念可能分叉；用偶尔 cherry-pick 改进。
- `agent-observe` 集成与 aitopo 的 npm 发布仍是后续工作。
- 计划见 `docs/superpowers/plans/2026-09-09-peer-ai-eng-and-aitopo-index.md`。
