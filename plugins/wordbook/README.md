# wordbook

English | [中文](README.zh.md)

Example plugin: a personal word notebook on top of the shipped Web profile. `/word apple` — or the dock above the composer — asks the model for one dictionary entry, stores it durably, and gives the model `word_lookup` / `word_query` tools for chat.

- **Deterministic entry, no main-model turn**: the `/word` command makes the auxiliary request itself.
- **Durable**: entries live in `$DSH_HOME/storages/wordbook.json` through the storage domain.
- **Queryable in chat**: the model calls `word_query`, and the result renders as a word list card.
- **Repeat-safe**: looking a word up again returns the stored entry without asking the model; `/word --refresh apple` forces a new request.

## Run

From the repository root:

```sh
pnpm install
pnpm --filter dsh-wordbook bundle
pnpm dsh web --patch ./plugins/wordbook/cordis.patch.yml
```

Or install it into a profile:

```sh
pnpm dsh plugin --profile web-wordbook add ./plugins/wordbook
pnpm dsh --profile web-wordbook
```

Then, in the running Web session:

1. Type `apple` in the "add a word" dock above the composer and submit, or type `/word apple` in the composer.
2. Check that `$DSH_HOME/storages/wordbook.json` gained an `apple` entry.
3. Ask the model whether `apple` was looked up before: it calls `word_query` and a word list card appears.
4. Restart the process and repeat step 3 — the entry is still there.

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | Host half: opens the store, publishes `ctx.wordbook`, registers the command and both tools |
| `src/spec.ts` | The `wordbook` domain declaration: zod record schema plus `defineDomain` |
| `src/store.ts` | The only reader and writer over that domain |
| `src/lookup.ts`, `src/prompts.ts` | Pure request-text construction and strict answer parsing |
| `src/service.ts` | Idempotent lookup orchestration over `ctx.llm` |
| `src/command.ts` | `/word [--refresh] <word>` |
| `src/tools.ts` | `word_lookup` and `word_query` |
| `src/client/` | Browser half: dictionaries, both tool cards, the entry dock |
| `src/testkit.ts` | Shared scripted adapter and harness for the specs |
| `cordis.patch.yml` | Opt-in insert layer (`dsh.bundle.patch`) |

## Configuration

Every field is a validated `Config` field, patchable from `cordis.yml`.

| Key | Default | Meaning |
|---|---|---|
| `provider` / `model` | agent default model | auxiliary lookup route; set them together |
| `maxOutputTokens` | `1024` | output cap for one answer |
| `temperature` | model default | passed through to the adapter |
| `timeoutMs` | `20000` | end-to-end deadline for one lookup |
| `maxSenses` | `8` | sense bound advertised to the model and enforced while parsing |
| `refreshByDefault` | `false` | treat every lookup as a refresh |
| `maxQueryResults` | `20` | result cap for one query |

## Tests

```sh
pnpm --filter dsh-wordbook test       # unit and behavior tests, no network
pnpm --filter dsh-wordbook test:e2e   # one real provider call; skips without DEEPSEEK_API_KEY
```

## Known limits

- **The lookup card is the built-in command card (text).** A rich card needs a plugin-owned session event, and `Session.append()` cannot mark an unknown event `ignorable`; a stored event of our own would make the session log unreadable to the harness. The query path is unaffected because `tool/call` and `tool/result` are already known events.
- **The auxiliary request is not in the session log**, for the same reason: the prompt and the raw answer are not reconstructable from the log. The `command/run` / `command/done` pair and the stored record are.
- **The auxiliary call carries no `purpose`**: that field is a closed union (`compaction` | `session-title`), so a plugin cannot classify its own call.
- **A breaking record-schema change needs a manual migration.** Under the default `single` layout the domain version must equal the stored file's, and `compatibleVersions` does not apply; add new fields as optional to stay at version 1.

Design and plan: [DESIGN.md](DESIGN.md) · [PLAN.md](PLAN.md)
