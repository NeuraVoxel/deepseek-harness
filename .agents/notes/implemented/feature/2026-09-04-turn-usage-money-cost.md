# Agent Note: Turn usage panel monetary cost

Status: implemented

English | [中文](2026-09-04-turn-usage-money-cost.zh.md)

## Problem

The Web Chat Turn usage disclosure already shows exact provider-reported token buckets for a completed Turn ([per-Turn token usage](2026-08-24-web-per-turn-token-usage.md)), but users who care about spend still have to leave the product and multiply tokens by an external price sheet. The existing `LlmImageRequestPricing` and token-meter "pricing" vocabulary measure visual or occupancy tokens, not currency.

## Decision

Keep `@deepseek-ai/dsh-token-meter`'s `deriveTurnTokenUsage` as the sole exact token authority. When every billed attempt has provider/model attribution, that fold also publishes `attempts` — one row per attempt with buckets, route, and settlement `time` — so monetary pricing never splits aggregates. Pure Client-safe `deriveTurnMoneyCost` takes one `TurnTokenUsage`, a rate lookup, and a currency, and returns monetary totals only when `attempts` is present and every contributing route has rates for every bucket on that attempt.

Rate dimensions match the fail-closed token buckets: uncached input, cache read, cache write, and output (reasoning is a labeled subset of output unless a rate table prices it separately). Multi-route Turns price each attempt under that attempt's rates, then sum. Incomplete route attribution omits money.

Adapters declare optional monetary rates for `(provider, model)` as per-million list prices, distinct from `imageRequestPricing`. DeepSeek's Host adapter publishes off-peak USD defaults; Chat resolves estimates through the browser-safe DeepSeek table on `@deepseek-ai/dsh-token-meter/client`, which also carries CNY list prices. Peak is exactly 2× during Mon–Fri UTC `01:00–04:00` and `06:00–10:00`, selected per attempt from settlement `time`. The active Chat locale's `message.turnUsage.currencyCode` chooses USD or CNY; formatting uses locale-owned `message.turnUsage.money`. Rates are not written into session events: replay recomputes money from today's table over historical buckets, and the UI labels the figure as an estimate (with a peak title when any attempt used peak windows).

`TurnUsagePanel` keeps the token pill and dialog; when money is available it adds a Cost section and may show a compact currency hint on the pill. Missing rates leave the panel as token-only.

## Alternatives considered

- **Hardcoded Client-only DeepSeek price sheet as the sole source** — rejected: multi-provider profiles and custom models would silently show wrong or zero costs; adapters already own route-specific declarations for visual pricing.
- **Persist money on session events or `TokenUsage`** — rejected: cost is not model-visible; freezing rates at call time adds durable schema without helping the model.
- **Show a lower-bound cost when some rates are missing** — rejected for the same reason the token disclosure rejects partial totals.
- **Reuse `LlmImageRequestPricing`** — rejected: that type prices visual tokens into the occupancy meter, not currency.
- **Always use off-peak USD only** — rejected after users compared the panel to domestic peak CNY bills; peak selection from attempt time and locale-owned CNY rates close that gap without inventing a clock when `time` is absent (off-peak then).

## Consequences

Completed Turns with attributed attempts and published rates show estimated spend next to exact token buckets. Peak windows and CNY locales produce figures that match the published list columns users compare against the DeepSeek console. Custom or unlisted models still omit money. List-price drift remains an estimate risk; settings overlays for custom endpoints remain deferred.

## Verification

- Unit tests: `packages/llm/token-meter/tests/turn-money.spec.ts`, `deepseek-token-money-rates.spec.ts`, `packages/llm/llm-deepseek/tests/token-money-rates.spec.ts`, `packages/client/ui-chat/tests/turn-usage-panel.client.spec.tsx` (off-peak USD, peak USD, CNY).
- Web replay: `apps/web/tests/turn-tail-actions.e2e.ts` asserts the live wall-clock peak/off-peak USD amount; ARIA goldens normalize currency figures to `{{money}}`.
