# Agent Note: Turn usage 面板的金钱消耗统计

Status: implemented

[English](2026-09-04-turn-usage-money-cost.md) | 中文

## 问题

Web Chat 的 Turn usage 披露已展示已完成 Turn 的精确提供方上报 token 分桶（[逐 Turn token 用量](2026-08-24-web-per-turn-token-usage.zh.md)），但关心花费的用户仍须离开产品，按外部价目表自行换算。现有的 `LlmImageRequestPricing` 与 token-meter 中的「pricing」词汇度量的是视觉或占用 token，不是货币。

## 决策

保持 `@deepseek-ai/dsh-token-meter` 的 `deriveTurnTokenUsage` 为唯一精确 token 权威。当每次计费尝试都有提供方/模型归属时，该 fold 还发布 `attempts`——每次尝试一行，含分桶、路由与结算 `time`——以便金钱计价永不拆分合计。纯 Client 安全的 `deriveTurnMoneyCost` 接受一个 `TurnTokenUsage`、费率查找与币种，仅在 `attempts` 存在且每个贡献路由对出现的分桶都有费率时返回金钱总额。

费率维度与 fail-closed 的 token 分桶一致：未缓存输入、缓存读取、缓存写入与输出（除非费率表单独为推理计价，否则推理仍是输出的标注子集）。多路由 Turn 按各尝试费率计价后求和；归属不完整则省略金钱。

适配器为 `(provider, model)` 声明可选货币费率（每百万 token 目录价），与 `imageRequestPricing` 分离。DeepSeek Host 适配器发布 off-peak USD 默认值；Chat 通过 `@deepseek-ai/dsh-token-meter/client` 上的浏览器安全 DeepSeek 表解析估算，该表同时携带 CNY 目录价。Peak 在工作日 UTC `01:00–04:00` 与 `06:00–10:00` 为 2 倍，按每次尝试的结算 `time` 选用。活动 Chat locale 的 `message.turnUsage.currencyCode` 选择 USD 或 CNY；格式化使用 locale 拥有的 `message.turnUsage.money`。费率不写入 session 事件：回放用今天的费率表乘历史分桶重算，UI 将数字标注为估算（任一尝试落在 peak 窗口时使用高峰标题）。

`TurnUsagePanel` 保留 token 药丸与对话框；金钱可用时增加 Cost 区，并可在药丸上显示紧凑货币提示。缺少费率时面板保持仅 token。

## 考虑过的替代方案

- **仅 Client 硬编码 DeepSeek 价目作为唯一来源** — 否决：多提供方配置与自定义模型会静默显示错误或零花费。
- **把金钱写入 session 事件或 `TokenUsage`** — 否决：花费对模型不可见；在调用时冻结费率增加持久 schema 却无助于模型。
- **部分费率缺失时显示下界花费** — 否决：与 token 披露拒绝部分合计同一理由。
- **复用 `LlmImageRequestPricing`** — 否决：该类型为占用计量定价视觉 token，不是货币。
- **始终只用 off-peak USD** — 否决：用户与国内高峰 CNY 账单对比后偏差明显；按 attempt 时间选 peak 与 locale 拥有的 CNY 费率弥合该差距，且在缺少 `time` 时不臆造时钟（回退 off-peak）。

## 后果

具备归属尝试与已公布费率的已完成 Turn，在精确 token 分桶旁显示估算花费。Peak 窗口与 CNY locale 下的数字与用户对照 DeepSeek 控制台的公布列一致。自定义或未列出模型仍省略金钱。目录价漂移仍是估算风险；自定义 endpoint 的 settings 覆盖层仍延后。

## 验证

- 单元测试：`packages/llm/token-meter/tests/turn-money.spec.ts`、`deepseek-token-money-rates.spec.ts`、`packages/llm/llm-deepseek/tests/token-money-rates.spec.ts`、`packages/client/ui-chat/tests/turn-usage-panel.client.spec.tsx`（off-peak USD、peak USD、CNY）。
- Web 回放：`apps/web/tests/turn-tail-actions.e2e.ts` 按实时墙钟断言 peak/off-peak USD；ARIA golden 将金额归一为 `{{money}}`。
