# Agent Note: Turn usage panel monetary cost

Status: proposed

English | [中文](2026-09-04-turn-usage-money-cost.zh.md)

## Problem

The Web Chat Turn usage disclosure already shows exact provider-reported token buckets for a completed Turn ([per-Turn token usage](../../implemented/feature/2026-08-24-web-per-turn-token-usage.md)), but it does not show money. Users who care about spend still have to leave the product and multiply tokens by an external price sheet. The existing `LlmImageRequestPricing` and token-meter "pricing" vocabulary measure visual or occupancy tokens, not currency, so nothing in the product converts a Turn's uncached / cache-read / cache-write / output buckets into dollars.

## Proposal

Add an estimated USD cost to the existing Turn usage UI without changing the session log or the exact token fold.

### Accounting

Keep `@deepseek-ai/dsh-token-meter`'s `deriveTurnTokenUsage` as the sole exact token authority. Introduce a pure Client-safe function that takes one `TurnTokenUsage` plus a rate table and returns a monetary total (and optional per-bucket money rows) only when every contributing route has rates for every bucket that appears in the total.

Rate dimensions match the fail-closed token buckets:

- uncached input
- cache read (when the aggregate is present)
- cache write (when the aggregate is present)
- output (reasoning remains a labeled subset of output tokens; it does not add a second charge unless a rate table explicitly prices reasoning separately and every attempt reported it)

A Turn with multiple routes prices each attempt's buckets under that attempt's provider/model rates, then sums. When routes are omitted from `TurnTokenUsage` because attribution was incomplete, money is omitted too — the same fail-closed rule as model rows today.

### Rate ownership

LLM adapters declare optional **monetary** token rates for `(provider, model)`, parallel to but distinct from `imageRequestPricing`. The declaration is USD per million tokens (or an equivalent exact rational the UI formats as currency). Shipped DeepSeek adapters publish the current public list prices for the models they advertise; unknown models omit rates and the panel omits money rather than guessing.

Ship both layers: adapters publish defaults for official routes, and a Cordis-config or user-settings overlay overrides or supplies rates for custom endpoints and local adjustments. Missing overlay entries fall back to the adapter table; missing adapter rates still omit money. Rates are not written into session events: replaying an old Turn always recomputes money from today's rate table over the historical token buckets, and the UI labels the figure as an estimate.

### UI

`TurnUsagePanel` keeps the token pill and dialog. When a monetary total is available, the dialog adds a Cost section (total plus the same bucket rows already shown for tokens). The pill may show a compact currency hint beside or under the token total when space allows; if rates are missing, the panel looks exactly as it does today. All new copy lives under `message.turnUsage.*` in the ui-chat locale dictionaries.

### Packaging and tests

- Rate types and the pure multiply/sum helper live next to token-meter's browser-safe Turn fold (or a thin sibling export) so Chat does not invent accounting.
- Adapter rate tables and the Chat panel wiring land in their owning packages.
- Focused unit tests pin fail-closed omission, multi-route summation, cache-bucket gating, and currency formatting.
- A Web snapshot (or component fixture under `test:gui` plus an assembled replay when visible output changes) pins the Cost rows.

### Out of scope for this note

Session-wide money on `StatsLine`, trajectory inspector columns, model-visible cost tools, and non-USD currencies. Those can reuse the same rate table later.

## Alternatives considered

- **Hardcoded Client-only DeepSeek price sheet** — rejected as the sole source: multi-provider profiles and custom models would silently show wrong or zero costs, and adapters already own route-specific declarations for visual pricing.
- **Persist money on session events or `TokenUsage`** — rejected: cost is not model-visible, freezing rates at call time adds durable schema without helping the model, and recomputing from tokens keeps one truth for buckets.
- **Show a lower-bound cost when some rates are missing** — rejected for the same reason the token disclosure rejects partial totals: a footer figure that looks like a bill must not understate incompleteness.
- **Reuse `LlmImageRequestPricing`** — rejected: that type prices visual tokens into the occupancy meter, not currency.
- **Settings-only rates with no adapter defaults** — rejected as the primary path: every official install would ship blank until configured; settings remain a valid overlay for custom endpoints.

## Acceptance criteria

- A completed Turn with exact `TurnTokenUsage` and rates for every contributing route shows a USD cost in the Turn usage dialog that equals the sum of priced buckets; missing rates omit the Cost section without removing token rows.
- Multi-route Turns price each attempt under its own rates; incomplete route attribution omits money.
- Cache read/write money rows appear only when the corresponding token aggregates are present and rated.
- No new session events, projections, or wire fields are required for the Cost rows.
- Locale-owned copy and `verify-client-ui-i18n` stay green; focused token-meter/helper and ui-chat tests pass; an intentional UI change updates the owning Web snapshot or expected fixture under the testing policy.
- Package READMEs for token-meter (or the rate helper owner) and ui-chat document the estimate semantics and fail-closed rule.

## Risks

- **Published list prices drift** — adapter tables can lag the provider's website; the UI must present the figure as an estimate, not an invoice.
- **Custom or unlisted models** — no rate means no money row; users may expect a settings escape hatch in the same change or immediately after.
- **Cache and reasoning billing quirks** — providers differ on whether cache write is billed and whether reasoning is additive; the rate table must model the provider's published rule, and unknown rules omit those buckets' money rather than inventing one.
- **Replay under new rates** — historical Turns change displayed dollars when rates update; that is intentional for an estimate and must not be confused with durable accounting.
