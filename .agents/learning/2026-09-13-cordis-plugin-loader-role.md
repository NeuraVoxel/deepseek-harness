# @deepseek-ai/cordis-plugin-loader 的作用

2026-09-13 梳理 host 启动链时读 `vendor/loader` 源码的记录。姊妹篇：[dsh host 启动顺序与断点位置](2026-09-13-dsh-host-boot-order.md)。

## 它是什么

Cordis 的 **Loader 插件**——把"配置树"变成"运行中的插件"的执行引擎。源码在 `vendor/loader`（pinned 副本，上游 cordis 按 `vendor/README.md` 映射 rescoped，当前 1.0.3，约 1150 行 / 7 个文件）。在启动链中的位置：`boot()` 里 `ctx.plugin(Loader)` 装上它；`mountRootInclude`（include 插件）把 cordis.yml + patch 栈**喂**成 entry 列表，Loader 负责**执行**。一句话：**include 管"组合"（yml → patch → entry 树），Loader 管"执行"（entry → 模块 → fiber → 服务可用）**。

## 五个职责（含源码锚点）

1. **提供 `loader` 服务（Entry 模型）**。每行配置（id、name、config、inject、disabled…）是一个 `Entry`（`src/config/entry.ts`），可分组（`group.ts`）、可持久化（`EntryTree`，`tree.ts`）。挂载后 `ctx.loader` 可用；`ctx.loader.entries()` 是运行时插件清单的权威来源——`assertEntriesActivated` 审计和 `plugin-inventory` 行读的都是它。

2. **解析并激活插件**。`src/internal.ts` 的 `ModuleLoader` 把包名（`@deepseek-ai/dsh-host-webserver` 等）解析为真实模块（从 profile 的 node_modules），每个 entry 创建一个 fiber。**激活是 service-availability 驱动的**：`inject: [webStartup]` 声明的服务没就绪就等——"行顺序不携带加载语义"的机制出处。

3. **配置表达式求值**。yml 里的 `!!js process.env.DSH_TOOLS_MODE`、`ctx.webStartup.host` 由 Loader 在 `internal/config` 事件里 `interpolate` 求值（`src/index.ts` 约 L95）。注意它对树载体（Group/Include）跳过插值——树里存的是别的行的配置，`!!js` 表达式属于那些行自己的 fiber。

4. **生命周期与写回**。订阅 `internal/plugin` 把 entry 绑到 fiber、处理自处置；配置变更走 `internal/update` 重载并 **`tree.write()` 把当前树写回磁盘**——这就是 profile-boot 每次启动重写空根 `cordis.yml` 的原因（防止写回把组合结果烤进根文件，下次 boot 重复叠加）。对外事件：`loader/config-update`、`loader/entry-init`、`loader/partial-dispose`、`loader/patch-context`。

5. **运行时管理面**。`ctx.loader.create({ name, config })` 运行时挂新插件（profile-boot 用它兜底装 timer/hmr）；`await()` 等全部 entry 激活（boot 的节流点）；`exit` 事件给宿主决定全量重载是否重启进程。`watchUserPatches` 的配置热重载就是重新组合 patch 后交给它重新应用——`patchReload: live` 能成立的前提。

## dsh 代码里的使用点

| 位置 | 用法 |
|---|---|
| `packages/boot/app-boot/src/index.ts` `boot()` | `ctx.plugin(Loader)` 装载；`ctx.get('loader')?.await()` 节流；`assertEntriesActivated` 审计 entries |
| `apps/cli/src/profile-boot.ts` | `ctx.get('loader') !== undefined` 作树存活判据；`ctx.loader.create(...)` 兜底装 timer/hmr |
| `packages/bundle/web-app/cordis.patch.yml` 的 `plugin-inventory` 行 | 只读投影当前 Loader entries 给受信客户端 RPC |
| config-only HMR（`watchUserPatches`） | 重新组合的 patch 交给 Loader 重新应用 |

## 调试提示

调试插件激活问题时，最深的一层断点在 `vendor/loader/src/index.ts` 的 `internal/plugin` / `internal/update` 订阅处：所有 entry 的绑定、重载、写回都从这两处过。`internal/config` 的 `interpolate` 处则是排查 `!!js` 表达式求值错误的位置。

Vendored 包按 `vendor/README.md` 的 manifest + sync procedure 更新，不直接改源码；本地修改要在 sync 时 re-apply 或退役并记录。
