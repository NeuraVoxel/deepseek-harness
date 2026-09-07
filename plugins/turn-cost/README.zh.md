# turn-cost

示例插件：在不改 `packages/` 的前提下，把 **Turn usage** 的 token 桶换算成 **人民币花费**。

- **每个 Turn**：助手操作行上的分项花费 pill（与 Turn usage pill 并列）
- **会话**：composer 旁的整段 durable log 累计
- 按 `provider/model`（来自 `TurnTokenUsage.routes`）查表；未知或多路由的 Turn 不计价

内置 Turn usage 弹层没有扩展点，本示例挂在它旁边。

## 怎么跑

在仓库根目录（先构建 Client bundle；Host 由 patch 从 `src/` 加载）：

```sh
pnpm install
pnpm --filter dsh-turn-cost bundle
pnpm dsh web --patch ./plugins/turn-cost/cordis.patch.yml
```

patch 插入的是相对本文件的 `./src/index.ts`，Loader 不会去 `$DSH_HOME/profiles/web` 找裸包名 `dsh-turn-cost`。Client 扫描仍会沿路径找到本目录的 `package.json`（`dsh.client`）。

或装进 profile（之后无需每次 `--patch`）：

```sh
pnpm --filter dsh-turn-cost bundle
pnpm dsh plugin --profile web-cost-demo add ./plugins/turn-cost
pnpm dsh --profile web-cost-demo
```

在已知 DeepSeek 路由上完成一个 Turn 后，应看到：

1. **Usage … tok** 旁的 **花费 ¥…**
2. composer 统计附近的 **会话花费 ¥…**

## 目录

| 路径 | 作用 |
|---|---|
| `src/rates.ts` | 纯函数 `priceTurnUsage` + 演示费率表 |
| `src/projection.ts` | Host 侧 `sessionCost` 整 log fold |
| `src/index.ts` | Host 插件（`Config.rates`） |
| `src/client/` | 浏览器半：操作行 pill + composer dock |
| `cordis.patch.yml` | 可选插入层（`dsh.bundle.patch`） |
| `tsdown.config.mjs` | 本地 Host+Client 构建（共享 `clientBundle` 只扫描 `packages/`） |

## 计价规则

1. 费率为 **人民币元 / 百万 token**，键为 `provider/model`；展示前缀为 `¥`。
2. 仅当 `routes` **恰好 1 条**且费率表命中时计价。
3. 桶映射：`uncachedInputTokens` → `input`，`cacheReadTokens` → `cacheRead`，`cacheWriteTokens` → `cacheWrite`，`outputTokens` → `output`。
4. 演示默认用公开美元价表 × `DEMO_USD_TO_CNY`（7.2）得到元价；有官方「元/百万」时请用 patch `config.rates` 覆盖。Client pill 从 `sessionCost` projection 读取同一张表。
5. 花费弹层与 Turn usage 同级：不透明菜单底 + `z-index: 1100`，避免与对话正文叠透。

## 为什么不用 `conversation.chat.turnTail`？

该 slot 是 **chain**（第一个命中的 entry 独占）。`ui-deliverables` 已用于产物文件，费用行会与之争座位。`assistant-actions` 是 **list**，可与 feedback 以及内置 usage/time pill 并存。

## 相关

- [hello-patch](../hello-patch/README.zh.md) / [hello-bundle](../hello-bundle/README.zh.md) — 最小加载方式
- [token-meter Turn usage](../../packages/llm/token-meter/README.zh.md) — `deriveTurnTokenUsage`
- [Web Turn usage 面板](../../.agents/notes/implemented/feature/2026-08-28-web-turn-stat-pills.zh.md)
