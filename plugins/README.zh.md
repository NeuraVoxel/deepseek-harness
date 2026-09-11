# plugins/

[English](README.md) | 中文

可选演示与本地实验包，挂到已发布的 `dsh` profile 上。它们**不是** `packages/` 下的产品包。

**Agent 站立指令**（含：禁止修改 harness 与 `vendor/` 源码；AITopo 需求以提案提交给 peer 仓库）见 [AGENTS.md](AGENTS.md)。

## 本目录下的包

| 目录 | 作用 |
|---|---|
| [hello-patch](hello-patch/README.zh.md) | 一次性 `--patch` 示例 |
| [hello-bundle](hello-bundle/README.zh.md) | 持久安装的 bundle 示例 |
| [agent-observe](agent-observe/README.zh.md) | 观察 Tab（Session / Agent 拓扑） |
| [agent-orchestrator](agent-orchestrator/README.zh.md) | Orchestrator 画布实验 |
| [turn-cost](turn-cost/README.zh.md) | 每轮费用展示 |

每个包自有 README、构建与测试。按该包说明在仓库根目录运行。
