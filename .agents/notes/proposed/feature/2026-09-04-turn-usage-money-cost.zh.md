# Agent Note: Turn usage 面板的金钱消耗统计

Status: proposed

[English](2026-09-04-turn-usage-money-cost.md) | 中文

## Problem

Web Chat 的 Turn usage 披露已展示已完成 Turn 的精确提供方上报 token 分桶（[逐 Turn token 用量](../../implemented/feature/2026-08-24-web-per-turn-token-usage.zh.md)），但不展示金钱。关心花费的用户仍须离开产品，按外部价目表自行换算。现有的 `LlmImageRequestPricing` 与 token-meter 中的「pricing」词汇度量的是视觉或占用 token，不是货币，因此产品内没有任何路径把 Turn 的 uncached / cache-read / cache-write / output 分桶换成美元。

## Proposal

在不改 session log、也不改精确 token fold 的前提下，为现有 Turn usage UI 增加估算的 USD 花费。

### 计量

继续以 `@deepseek-ai/dsh-token-meter` 的 `deriveTurnTokenUsage` 作为唯一精确 token 权威。新增一个 Client 安全的纯函数：接受一份 `TurnTokenUsage` 与费率表，仅当每一个贡献 route 都具备合计中出现的全部分桶费率时，才返回金钱总额（以及可选的分桶金钱行）。

费率维度与 fail-closed 的 token 分桶对齐：

- uncached input
- cache read（当该汇总值存在时）
- cache write（当该汇总值存在时）
- output（reasoning 仍是 output token 的标注子集；除非费率表显式单独为 reasoning 定价且每次 attempt 都上报了该值，否则不第二次计费）

多 route 的 Turn 按每次 attempt 的 provider/model 费率计价其分桶后再求和。若因归属不完整而从 `TurnTokenUsage` 省略了 routes，则金钱一并省略——与今日模型行的 fail-closed 规则相同。

### 费率归属

LLM adapter 为 `(provider, model)` 声明可选的**货币** token 费率，与 `imageRequestPricing` 平行且互不相同。声明单位为每百万 token 的 USD（或 UI 可格式化为货币的等价精确有理数）。已发布的 DeepSeek adapter 为其公布的模型发布当前公开目录价；未知模型省略费率，面板省略金钱而不是猜测。

同时交付两层：adapter 为官方路由发布默认费率；Cordis 配置或用户 settings 覆盖层覆盖或补充自定义 endpoint 与本地调整。覆盖层缺项回退到 adapter 表；adapter 仍无费率时继续省略金钱。费率不写入 session 事件：回放旧 Turn 时，始终用**今天的**费率表乘以历史 token 分桶重算金钱，UI 将数字标注为估算。

### UI

`TurnUsagePanel` 保留 token 药丸与对话框。当金钱总额可用时，对话框增加 Cost 区（总额以及与 token 相同的分桶行）。空间允许时，药丸可在 token 总量旁或下方显示紧凑货币提示；若缺少费率，面板外观与今日完全一致。所有新增文案落在 ui-chat locale 字典的 `message.turnUsage.*` 下。

### 分包与测试

- 费率类型与纯乘加辅助函数放在 token-meter 的浏览器安全 Turn fold 旁（或薄的同级导出），避免 Chat 自造计量。
- adapter 费率表与 Chat 面板接线落在各自归属包。
- 聚焦单元测试钉住 fail-closed 省略、多 route 求和、cache 分桶门控与货币格式化。
- Web 快照（或在可见输出变化时，`test:gui` 下的组件夹具加组装回放）钉住 Cost 行。

### 本笔记范围外

`StatsLine` 上的会话级金钱、trajectory 检查器列、模型可见的花费工具，以及非 USD 货币。它们以后可复用同一费率表。

## Alternatives considered

- **仅硬编码在 Client 的 DeepSeek 价目表** — 作为唯一来源被否决：多提供方 profile 与自定义模型会静默显示错误或零花费，且 adapter 已为视觉定价拥有按路由声明。
- **把金钱持久化到 session 事件或 `TokenUsage`** — 否决：花费对模型不可见；在调用时冻结费率会增加持久 schema 却不帮助模型；从 token 重算可保持分桶单一真相。
- **部分费率缺失时显示花费下界** — 否决，理由同 token 披露拒绝部分合计：页脚数字若看起来像账单，就不得掩盖不完整。
- **复用 `LlmImageRequestPricing`** — 否决：该类型把视觉 token 计入占用计量，不是货币。
- **仅 settings 费率、无 adapter 默认** — 作为主路径否决：每个官方安装在配置前都是空白；settings 仍可作为自定义 endpoint 的合法覆盖层。

## Acceptance criteria

- 已完成 Turn 在具备精确 `TurnTokenUsage` 且每个贡献 route 都有费率时，Turn usage 对话框显示等于已计价分桶之和的 USD 花费；缺少费率时省略 Cost 区而不移除 token 行。
- 多 route Turn 按各自费率计价每次 attempt；route 归属不完整时省略金钱。
- 仅当对应 token 汇总值存在且已定价时，才出现 cache read/write 金钱行。
- Cost 行不需要新的 session 事件、投影或线协议字段。
- 文案由 locale 拥有且 `verify-client-ui-i18n` 保持绿；聚焦的 token-meter/辅助函数与 ui-chat 测试通过；有意的 UI 变更按测试策略更新属主 Web 快照或预期夹具。
- token-meter（或费率辅助函数属主）与 ui-chat 的包 README 记录估算语义与 fail-closed 规则。

## Risks

- **公开目录价漂移** — adapter 表可能落后于提供方网站；UI 必须把数字呈现为估算，而非发票。
- **自定义或未列出的模型** — 无费率则无金钱行；用户可能期望同变更或紧随其后提供 settings 逃生舱。
- **Cache 与 reasoning 计费差异** — 提供方对 cache write 是否计费、reasoning 是否加算规则不一；费率表须建模该提供方的公开规则，未知规则省略这些分桶的金钱而非臆造。
- **新费率下的回放** — 费率更新后，历史 Turn 显示的美元会变；对估算而言这是有意的，不得与持久会计混淆。
