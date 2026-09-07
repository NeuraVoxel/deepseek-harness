# hello-bundle

English | [中文](README.zh.md)

Minimal DeepSeek Harness **bundle** example: ship a plugin as an npm package with `dsh.bundle`, install it into a profile with `dsh plugin add`, and start without `--patch` afterward.

Sibling [hello-patch](../hello-patch/README.md) shows a one-shot `--patch` at launch; this example shows a persistently installed bundle.

## Run

From the repository root, install into a dedicated profile (first use initializes that profile):

```sh
pnpm dsh plugin --profile hello-demo add ./plugins/hello-bundle
```

Confirm the layer is stacked:

```sh
pnpm dsh --profile hello-demo --dump-config
```

The output should include a layer comment like `# == dsh-hello-bundle`, plus `id: hello` / `name: dsh-hello-bundle`.

Then start (no `--patch`):

```sh
pnpm dsh --profile hello-demo
```

The terminal should print:

```text
[hello-bundle] plugin loaded!
```

Remove:

```sh
pnpm dsh plugin --profile hello-demo remove dsh-hello-bundle
```

## Layout

| File | Role |
|---|---|
| `package.json` | Package name and `dsh.bundle.patch` |
| `cordis.patch.yml` | Config layer this bundle contributes: `insert` plugin rows |
| `index.js` | Plugin entry; the patch references it by **package name** |

## How it works

### Bundle vs profile

- **Bundle**: an npm package that answers “what does this package contribute?”. `dsh.bundle.patch` in `package.json` points at a patch file.
- **Profile**: a launchable composition under `$DSH_HOME/profiles/<name>` that answers “which bundles, in what order?”. `dsh.profile.bundles` lists layers; usually maintained by `dsh plugin`, not by hand.

This package’s key declaration:

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```

Without `dsh.bundle`, `dsh plugin add` can still install the package as an ordinary dependency, but it will not activate a config layer (and prints a warning).

### Why the patch uses a package name

```yaml
- insert:
    - id: hello
      name: dsh-hello-bundle
```

After install into a profile, the module resolves through that profile’s `node_modules`. Using the package name (same as `package.json` `name`) lets Node find the linked `index.js`. That differs from hello-patch’s relative `./hello.ts` path.

### Load order

Effective config stacks roughly in this order on an empty root (later layers win by row; whole `config` objects replace rather than deep-merge):

1. Each bundle patch in `dsh.profile.bundles` (including `@deepseek-ai/dsh-base` and this package)
2. The profile’s own `cordis.patch.yml`
3. Home-level `$DSH_HOME/cordis.patch.yml`
4. Each CLI `--patch` (argv order)

So bundles suit “install once, keep enabled”; one-off experiments can still use `--patch`.

## Versus hello-patch

| | [hello-patch](../hello-patch/README.md) | This example |
|---|---|---|
| Enable | Every `pnpm dsh … --patch ./…/cordis.yml` | Ordinary `--profile` after `dsh plugin add` |
| Module ref | Relative / absolute file path | Package name `dsh-hello-bundle` |
| Persistence | Does not change the profile | Writes profile deps and `bundles` |

Official guide: [Packaging and installing plugins](../../docs/user/develop/basic/publish.md).
