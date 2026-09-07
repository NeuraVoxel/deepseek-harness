# hello-patch

English | [中文](README.zh.md)

Minimal DeepSeek Harness plugin example: insert a local plugin into an existing profile with a `--patch` overlay.

## Run

From the repository root:

```sh
pnpm dsh web --patch ./plugins/hello-patch/cordis.yml
```

On start the terminal should print:

```text
[hello-plugin] plugin loaded!
```

Other profiles work too, for example headless:

```sh
pnpm dsh --profile headless --patch ./plugins/hello-patch/cordis.yml "say hi"
```

Inspect composition without starting the app:

```sh
pnpm dsh --profile web --patch ./plugins/hello-patch/cordis.yml --dump-config
```

The output includes `id: hello` and the resolved absolute `hello.ts` path (`file://...`).

## Layout

| File | Role |
|---|---|
| `hello.ts` | Cordis plugin: exports `name` and `apply` |
| `cordis.yml` | Patch list: `insert` mounts this plugin into the profile tree |

## How it works

`dsh` starts a **profile** (ordered bundle patch stack). `--patch <file>` adds one more **overlay** applied after that.

This directory’s `cordis.yml` is not a full app config; it is a **patch**:

```yaml
- insert:
    - id: hello
      name: './hello.ts'
```

- `insert`: append plugin rows to the current composition tree.
- `id`: stable row id for later patches to override or disable.
- `name`: plugin module path. Paths starting with `./` or `../` resolve relative to **this patch file’s directory** as a `file://` URL for the Loader.

The plugin is an ordinary TypeScript module. After load, the Loader calls `apply(ctx)`; `ctx` is the Cordis context where later examples `inject` services and register tools or listeners. This sample only logs one line to prove the plugin mounted.

Load order follows service dependencies (`inject`), not YAML list position. This sample has no `inject`, so `apply` runs once the profile tree has finished mounting.

## Versus an installable bundle

| Mode | This example | [hello-bundle](../hello-bundle/README.md) |
|---|---|---|
| Config entry | Launch-time `--patch` | `dsh plugin add` → profile `dsh.profile.bundles` |
| Module ref | Local relative / absolute path | Package name (via pnpm install) |
| Persistence | Pass explicitly every launch | Written into the profile; then ordinary `dsh --profile …` |

Next steps in the official tutorial: [First plugin](../../docs/user/develop/basic/index.md), [Packaging and install](../../docs/user/develop/basic/publish.md). Framework primer: [Cordis first plugin](../../docs/cordis-tutorial/01-first-plugin.md).
