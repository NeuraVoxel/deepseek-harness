# hello-bundle

[English](README.md) | 中文

最小的 DeepSeek Harness **组合包**（bundle）示例：把插件做成带 `dsh.bundle` 的 npm 包，用 `dsh plugin add` 装进 profile，之后启动不再需要 `--patch`。

同目录的 [hello-patch](../hello-patch/README.zh.md) 演示启动时临时 `--patch`；本示例演示可持久安装的 bundle。

## 怎么跑

在仓库根目录，先装进一个专用 profile（首次会初始化该 profile）：

```sh
pnpm dsh plugin --profile hello-demo add ./plugins/hello-bundle
```

验证层已叠上：

```sh
pnpm dsh --profile hello-demo --dump-config
```

输出中应出现 `# == dsh-hello-bundle` 一类层注释，以及 `id: hello` / `name: dsh-hello-bundle`。

再启动（无需 `--patch`）：

```sh
pnpm dsh --profile hello-demo
```

终端应打印：

```text
[hello-bundle] plugin loaded!
```

卸下：

```sh
pnpm dsh plugin --profile hello-demo remove dsh-hello-bundle
```

## 目录里有什么

| 文件 | 作用 |
|---|---|
| `package.json` | 声明包名与 `dsh.bundle.patch` |
| `cordis.patch.yml` | 该组合包贡献的配置层：`insert` 插件行 |
| `index.js` | 插件入口；patch 里用**包名**引用它 |

## 基本原理

### 组合包 vs profile

- **组合包（bundle）**：一个 npm 包，回答「这个包贡献什么？」。`package.json` 里的 `dsh.bundle.patch` 指向一份 patch 文件。
- **profile**：`$DSH_HOME/profiles/<name>` 下的可启动组合，回答「由哪些组合包、按什么顺序组成？」。`dsh.profile.bundles` 列出层；一般由 `dsh plugin` 维护，不必手写。

本包的关键声明：

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```

没有 `dsh.bundle` 时，`dsh plugin add` 仍可把包装成普通依赖，但不会激活任何配置层（并打印警告）。

### patch 里为什么写包名

```yaml
- insert:
    - id: hello
      name: dsh-hello-bundle
```

装进 profile 后，模块经该 profile 的 `node_modules` 解析。写成包名（与 `package.json` 的 `name` 一致），Node 才能找到已链接的 `index.js`。这与 hello-patch 里写 `./hello.ts` 相对路径不同。

### 加载顺序

生效配置在空根之上大致按此顺序叠加（后层按行胜出，整份 `config` 替换而非深合并）：

1. `dsh.profile.bundles` 中的各组合包 patch（含 `@deepseek-ai/dsh-base` 与本包）
2. 该 profile 自己的 `cordis.patch.yml`
3. home 级 `$DSH_HOME/cordis.patch.yml`
4. 命令行上每个 `--patch`（按 argv 顺序）

因此 bundle 适合「装一次、长期启用」；临时试验仍可用 `--patch`。

## 和 hello-patch 的对比

| | [hello-patch](../hello-patch/README.zh.md) | 本示例 |
|---|---|---|
| 启用方式 | 每次 `pnpm dsh … --patch ./…/cordis.yml` | `dsh plugin add` 后普通 `--profile` 启动 |
| 模块引用 | 相对 / 绝对文件路径 | 包名 `dsh-hello-bundle` |
| 持久性 | 不改 profile | 写入 profile 的依赖与 `bundles` |

官方说明见[打包与安装插件](../../docs/user/develop/basic/publish.zh.md)。
