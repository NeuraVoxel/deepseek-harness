# turn-cost

Example plugin: convert **Turn usage** token buckets into **CNY (人民币) spend**, without changing `packages/`.

- **Per Turn**: itemized cost pill on the assistant action row (next to the Turn usage pill)
- **Session**: durable whole-log total on the composer dock
- Pricing is by `provider/model` (from `TurnTokenUsage.routes`); unknown or multi-route Turns stay unpriced

The built-in Turn usage dialog is not extended (no slot). This plugin sits beside it.

## Run

From the repository root (build the Client bundle once; Host loads from `src/` via the patch):

```sh
pnpm install
pnpm --filter dsh-turn-cost bundle
pnpm dsh web --patch ./plugins/turn-cost/cordis.patch.yml
```

The patch inserts `./src/index.ts` relative to the patch file so the Loader does not look for a bare `dsh-turn-cost` package under `$DSH_HOME/profiles/web`. Client discovery still walks up to this directory's `package.json` (`dsh.client`).

Or install into a profile (then start that profile without `--patch`):

```sh
pnpm --filter dsh-turn-cost bundle
pnpm dsh plugin --profile web-cost-demo add ./plugins/turn-cost
pnpm dsh --profile web-cost-demo
```

After a completed Turn with a known DeepSeek route, you should see:

1. A **Cost ¥…** control next to **Usage … tok**
2. A **Session ¥…** line near the composer stats

## Layout

| Path | Role |
|---|---|
| `src/rates.ts` | Pure `priceTurnUsage` + demo rate table |
| `src/projection.ts` | Host `sessionCost` fold over the durable log |
| `src/index.ts` | Host plugin (`Config.rates`) |
| `src/client/` | Browser half: action pill + composer dock |
| `cordis.patch.yml` | Opt-in insert layer (`dsh.bundle.patch`) |
| `tsdown.config.mjs` | Local Host+Client build (shared `clientBundle` only scans `packages/`) |

## Pricing rules

1. Rates are **CNY (元) per 1M tokens**, keyed by `provider/model`. Display uses a `¥` prefix.
2. A Turn prices only when `routes` has **exactly one** entry and that key is in the table.
3. Buckets map to rates: `uncachedInputTokens` → `input`, `cacheReadTokens` → `cacheRead`, `cacheWriteTokens` → `cacheWrite`, `outputTokens` → `output`.
4. Demo defaults project the public USD DeepSeek table through `DEMO_USD_TO_CNY` (7.2). Override via patch `config.rates` with official 元/百万 figures when you have them. The Client pill reads the same table from the `sessionCost` projection view.
5. The cost dialog uses the same opaque menu surface and `z-index: 1100` as Turn usage, so it does not show transcript text through the panel.

## Why not `conversation.chat.turnTail`?

That slot is a **chain** (first matching entry wins). `ui-deliverables` already uses it for produced files, so a cost row there would fight for the seat. `assistant-actions` is a **list**, so the cost pill coexists with feedback and the built-in usage/time pills.

## Related

- [hello-patch](../hello-patch/README.md) / [hello-bundle](../hello-bundle/README.md) — minimal load patterns
- [token-meter Turn usage](../../packages/llm/token-meter/README.md) — `deriveTurnTokenUsage`
- [Web Turn usage panel](../../.agents/notes/implemented/feature/2026-08-28-web-turn-stat-pills.md)
