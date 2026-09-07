# hello-patch

[English](README.md) | 中文

最小的 DeepSeek Harness 插件示例：用 `--patch` 覆盖层把本地插件插进已有 profile。

## 怎么跑

在仓库根目录：

```sh
pnpm dsh web --patch ./plugins/hello-patch/cordis.yml
```

启动时终端应打印：

```text
[hello-plugin] plugin loaded!
```

也可用其他 profile，例如 headless：

```sh
pnpm dsh --profile headless --patch ./plugins/hello-patch/cordis.yml "say hi"
```

只看组合结果、不真正启动应用：

```sh
pnpm dsh --profile web --patch ./plugins/hello-patch/cordis.yml --dump-config
```

输出里会出现 `id: hello`，以及解析后的 `hello.ts` 绝对路径（`file://...`）。

## 目录里有什么

| 文件 | 作用 |
|---|---|
| `hello.ts` | Cordis 插件：导出 `name` 与 `apply` |
| `cordis.yml` | patch 列表：用 `insert` 把该插件挂进 profile 树 |

## 基本原理

`dsh` 启动一个 **profile**（有序的 bundle patch 层叠）。`--patch <文件>` 再叠一层 **覆盖层**，在那之后应用。

本目录的 `cordis.yml` 不是完整应用配置，而是一段 **patch**：

```yaml
- insert:
    - id: hello
      name: './hello.ts'
```

- `insert`：向当前组合树追加插件行。
- `id`：该行的稳定标识，便于后续 patch 覆盖或禁用。
- `name`：插件模块路径。以 `./` 或 `../` 开头时，相对 **本 patch 文件所在目录** 解析为 `file://` URL，再交给 Loader 挂载。

插件本身是普通 TypeScript 模块。Loader 加载后调用 `apply(ctx)`；`ctx` 是 Cordis 上下文，后续可在此 `inject` 服务并注册工具、监听事件等。本示例只打一行日志，用来确认插件已挂上。

加载顺序由服务依赖（`inject`）决定，不由 YAML 列表位置保证。本示例无 `inject`，因此只要 profile 树挂载完成，就会执行 `apply`。

## 和「可安装 bundle」的区别

| 方式 | 本示例 | [hello-bundle](../hello-bundle/README.zh.md) |
|---|---|---|
| 配置入口 | 启动时 `--patch` | `dsh plugin add` → profile 的 `dsh.profile.bundles` |
| 模块引用 | 本地相对 / 绝对路径 | 包名（经 pnpm 安装） |
| 持久性 | 每次启动显式传入 | 写进 profile，之后普通 `dsh --profile …` 即可 |

学习下一步可走官方教程：[第一个插件](../../docs/user/develop/basic/index.zh.md)、[打包与安装](../../docs/user/develop/basic/publish.zh.md)。底层框架见 [Cordis 第一个插件](../../docs/cordis-tutorial/01-first-plugin.zh.md)。
