# dsh host 启动顺序与断点位置

2026-09-13 调试 `dsh web` 时梳理的启动链路记录。以符号名为准（行号会漂移，记录时的行号供快速定位）。

## 启动链总览

```
bin.ts (runCli)
  └─ profile-boot.ts (runProfile)         launcher 层:代理/信号/profile patch 栈组合
      └─ app-boot (boot)                  Cordis 应用创建 + Loader 挂载
          └─ mountRootInclude             按 patch 栈逐行挂插件树
              ├─ host/webserver           HTTP 监听 (127.0.0.1:3080)
              └─ bundle/web-app           打印 URL / 自动开浏览器
```

## 各阶段职责

### 1. CLI 入口 — `apps/cli/src/bin.ts`

`runCli()` 用 commander 解析 argv（`parseDshArgs`），分派四种 mode：`profile`（boot）、`plugin`（插件管理）、`dump-config`、`web`（`--profile web` 的别名）。`dsh web` 只是便利别名，不是独立入口（单一 launcher 决策，见 Agent Note `2026-08-22-single-dsh-application-launcher`）。

注意 `--dump-config` 是 launcher flag 而非子命令：`dsh --profile headless --dump-config`；放在 `--profile` 前会报 `--profile <name> is required`。

### 2. profile 启动 — `apps/cli/src/profile-boot.ts`（`runProfile`，约 L282）

按顺序做：

1. `installProxyFromEnvironment` — 必须在任何插件挂载前装好代理（Node fetch 不自己读 proxy env，`.env` 层里声明的代理靠 launcher 快照生效）。
2. `composeProfile` — patch 栈组合，顺序固定：**bundle 层**（`dsh.profile.bundles` 顺序，web = base → web-app）→ **profile 自己的 `cordis.patch.yml`** → **home 层**（`$DSH_HOME/cordis.patch.yml`，机器级偏好， outrank profile 层）→ **`--patch` overlay** → **telemetry 开关 patch**。
3. `prepareProfile` 会把 profile 目录下的根 `cordis.yml` 重写为空 entry 列表——整棵树都由 patch 层构成，根文件只是给 Loader 的 include 一个真实锚点。
4. `boot(...)` 第四个回调参数在任何配置树条目挂载**之前**执行：注入 `DSH_LAUNCH_ENVIRONMENT_KEY`（环境快照）和 `provideCmdline`（argv + exit/ready）。调试"插件拿不到启动环境"看这里。
5. boot 之后：`patchReload: live` 的 profile（web、自定义）装 config-only HMR watcher（`dsh-base` 默认禁用 module HMR）；最后 `appReady.commit()`。

### 3. Cordis 应用创建 — `packages/boot/app-boot/src/index.ts`（`boot`，约 L787）

`new Context()` → `ctx.provide('dshHomePath')` → `ctx.plugin(Loader)` → `prepare?.(ctx)` → `mountRootInclude`（约 L804，定义在 L516）→ `await ctx.get('loader')?.await()` 等全部 entry 激活 → `assertEntriesActivated` 审计（PENDING fiber 会 fail-loud）。

两个失败标签：`prepare` 抛错 = `host preparation failed`（树还没挂）；之后 = `plugin tree failed to load`。深层 cause 会被折叠进错误消息，栈底才是真正的抛错点。

### 4. 插件树激活

`mountRootInclude` 按 patch 栈逐行应用 insert/config。**激活是 service-availability 驱动的，行顺序不携带加载语义**：`inject: [webStartup]` 的行要等 `web-startup` 行提供 service 后才解析配置表达式。web profile 的完整插件清单见 `packages/bundle/web-app/cordis.patch.yml`（host 行 → 传输层 webserver/web-runtime → 浏览器 roster `dsh.client` 行 → agent 平面禁用段）。

### 5. 绑定与就绪

- `packages/host/webserver/src/index.ts` 约 L294：`this.server.listen(port, host)`，激活即监听，404 兜底到 index 渲染。
- `packages/bundle/web-app/src/index.ts` 约 L270-274：打印 `dsh web: http://127.0.0.1:3080/?token=…`（LAN URL 一并给出），`openBrowser` 时自动开浏览器。

## 断点建议（按调试目的）

| 目的 | 位置 |
|---|---|
| CLI 参数解析 | `bin.ts` `runCli()` / `case 'profile'`（L32 附近） |
| patch 栈组合 / 环境快照 | `profile-boot.ts` `runProfile()` 入口（L282）、`composeProfile` 返回处 |
| Cordis 应用创建（真正的启动入口） | `app-boot/src/index.ts` `boot()`（L787），`new Context()` 在 L794 |
| 每个插件激活的公共咽喉 | `boot()` 里的 `await ctx.get('loader')?.await()`（L804 之后）；单个插件直接在它的 `src/index.ts` 激活回调打断点 |
| HTTP 绑定 | `host/webserver/src/index.ts` `listen`（L294） |
| URL 打印 / 开浏览器 | `bundle/web-app/src/index.ts`（L270） |
| profile 组合结果快速验证 | `dsh --profile web --dump-config`（无需 API key） |

## 调试启动方式（VSCode）

仓库 `.vscode/launch.json`（2026-09-13 配置）的三个 dsh 配置都走 `node node_modules/tsx/dist/cli.mjs apps/cli/src/bin.ts …`。

一个坑：**`program` 不能直接指向 `.ts` 入口**。js-debug 看到 `.ts` 会按 tsconfig `outDir` 把入口重映射到编译产物（如 `apps/cli/lib/types/bin.js`），那个产物按 `../package.json` 找版本时落在 `lib/` 下，ENOENT；`--import tsx/esm` 也被绕过。指向 tsx 的 `.mjs` CLI（不会被重映射）就没有这个问题，tsx 的内联 sourcemap 让断点直接绑定 `apps/`、`packages/` 的 `.ts` 源文件——ESM realpath 解析后跨包源码（`packages/<group>/<pkg>/src`）同样可断。

`skipFiles: ["**/node_modules/**"]` 不影响 packages 源码，因为 workspace 依赖经符号链接 realpath 回 src。

## bundle 名字与代码入口的对应（清单层 vs 插件层）

`dsh.profile.bundles` 里的 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 是 **bundle（清单层）** 名字，入口分两层，解析链路在 `packages/boot/app-boot/src/profile.ts`（`loadProfile` 读 profile 包的 `dsh.profile.bundles`，再按每个 bundle 包的 `dsh.bundle.patch` 字段找 patch 文件）：

| 名字 | 清单入口 | 实际代码 |
|---|---|---|
| `@deepseek-ai/dsh-base` | `packages/bundle/base/cordis.patch.yml`（package.json 的 `dsh.bundle.patch` 声明） | **没有**——`src/index.ts` 是空占位（`export {}`），包的全部实质就是那份 yml |
| `@deepseek-ai/dsh-web-app` | `packages/bundle/web-app/cordis.patch.yml` | **有，双角色**——`src/index.ts` 是真实插件，被 yml 里的 `web-runtime` 行以 `name: '@deepseek-ai/dsh-web-app'` 挂载（dist 解析、静态回退、URL 打印、开浏览器都在这） |

bundle yml 本身不含逻辑，每行 `insert:`/`- id:` 的 `name:` 指向一个真正的插件 npm 包，入口是该包的 `src/index.ts`（构建后 `lib/index.js`）：

- **dsh-base 的行** = host 核心（timer、loader、session、system-prompt、llm、tools、persistence 等），代码在 `packages/core/`、`packages/host/`、`packages/session/` 等各组。找某行的代码：拿 `name` 里的包名 grep package.json，例如 `@deepseek-ai/dsh-host-webserver` → `packages/host/webserver/src/index.ts`。
- **web-app 的行** = web 传输层 + 浏览器 roster（`webserver`、`web-runtime`、`connection`、`modules`、`ui-*`），host 半在 `packages/host/`、`packages/api/`、`packages/client/`，浏览器半在对应包的 `./client` 导出。

本机 `~/.dsh/profiles/web/package.json` 的实际 bundle 栈有 7 层：`dsh-base → dsh-web-app → dshmarket → dsh-context → @vectorize-io/hindsight-coding-agents → @linxin666/dsh-client-ui-skill-explorer → dsh-cost-meter`。后 5 个是安装的第三方 bundle（装在 profile 的 node_modules），在 dsh-web-app 之上再叠 patch 层——调试时看到的某些行为（如 dsh-cost-meter 启动日志）来自这些层，仓库源码里没有。看某层内容：`~/.dsh/profiles/node_modules/<包名>/cordis.patch.yml`。

## 启动记录工具（scripts/observe-boot.ts）

2026-09-13 新增的配套工具，把上面的启动链录成 AITopo 文档：

```sh
pnpm exec tsx scripts/observe-boot.ts --profile web   # 记录并生成文档 + demo sample
```

- **记录方式**：in-process boot——脚本复刻 `runProfile` 的 patch 栈组合（约 40 行耦合，若 launcher 组合变化需同步），在 `boot()` 的 `prepare` 回调第一行订阅 `internal/plugin`，早于任何配置树行挂载，base 第一行的时序也能拿到。
- **产物**（`.artifacts/observe-boot/<profile>-<stamp>/`）：`boot-timeline.json`（原始事件）、`boot-topology.document.json`（GraphDocument，经 `parseDocument` 校验）、`boot-report.md`（阶段/层/激活顺序表）；另发射 demo sample 到 `vendor/aitopo/demo/samples/dsh/boot.ts`（submodule 改动，需在 aitopo 仓提交）。
- **文档结构**：根画布 = 阶段流程（compose → prepare → mount → settle → ready，带耗时）；下钻 `network:compose` = patch 层应用顺序；下钻 `network:mount` = 插件明细（x=真实激活顺序，y=patch 层车道，每层一条 Group 带，边=fiber 父子关系，未激活行 `status:'cold'`）。
- **本机 web profile 实测**：9 层（base 84 行、web-app 94 行、5 个第三方 bundle、profile/home 用户层），boot() 返回前 186 个 fiber，settle 后 221 个——懒挂载是真实波动，照实记录。
- 踩坑两则：`Loader.entries()` 返回 Generator，Node 22 iterator helpers 会让 `.filter().map()` 链返回迭代器而非数组，须先 `[...]` 物化；GraphGroup 的 `autoFit` 在 `style` 里而非顶层字段。

## 相关权威（学习笔记不是权威）

- Loader 插件职责详解：学习笔记 [cordis-plugin-loader 的作用](2026-09-13-cordis-plugin-loader-role.md)
- 单一 launcher 决策：Agent Note `implemented/architecture/2026-08-22-single-dsh-application-launcher.md`（application launch 范围、patchReload 表、协议 profile 的 stdout 纯净）
- profile bundle 分层：Agent Note `implemented/architecture/2026-08-05-profile-plugin-bundles.md`
- web 组合与传输分层：Agent Note `implemented/architecture/2026-07-24-web-config-tree-boot-and-transport-layering.md`（其中 base.cordis.yml 布局已被 profile patch 栈取代，以 launcher 笔记为准）
- 源码启动契约：Agent Note `implemented/architecture/2026-07-29-dsh-source-launch-tsx-esm.md`
