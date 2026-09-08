# 010 · Host 端内部启动顺序

> DeepSeek Harness 源码专题 · 第 10 篇
> 接 [004 · 双进程](./004-Web-UI双进程与dual-face.md) · [008 · dsh-base](./008-dsh-base挂载了哪些插件.md) · [009 · patch vs agent.cordis](./009-cordis.patch与agent.cordis的区别.md) · 流程见 [000](./000-当前项目开发流程.md)
> 主线：`dsh web` 时 Host 进程从 argv 到就绪（再到首个 preset）的真实时序

本篇只讲 **一个 Node Host 进程**。浏览器里再启的 Cordis 树是后续客户端阶段（见 [004](./004-Web-UI双进程与dual-face.md)），不在此展开。

权威入口：

| 入口 | 管什么 |
|---|---|
| [`apps/cli/src/bin.ts`](../apps/cli/src/bin.ts) / [`args.ts`](../apps/cli/src/args.ts) | argv、`web` 别名、分发 |
| [`apps/cli/src/profile-boot.ts`](../apps/cli/src/profile-boot.ts) | `runProfile`、组 patch、live watch、`appReady` |
| [`packages/boot/app-boot`](../packages/boot/app-boot/README.md) | `boot` / `loadLayeredEnv` / Include / `watchUserPatches` |
| [`docs/architecture.md` · Profiles](../docs/architecture.md#profiles-and-bundles) | 层序与 live vs startup |
| [`packages/bundle/web-app/cordis.patch.yml`](../packages/bundle/web-app/cordis.patch.yml) | Web 注入链（startup → server → runtime → /api） |
| [`apps/cli/composition.md`](../apps/cli/composition.md) | 生成的组合图 |

---

## 先说结论

```text
argv / env
  → 解析 profile + 叠 patch（只组配置，不跑插件）
  → prepare：cmdlineArgs / appExit / appReady
  → Loader 并发挂树（inject 决定谁先活）
  → loader.await + 激活审计
  → [web] 打 URL / 可选开浏览器
  → [web live] 监视用户 patch
  → appReady.commit()
  ── 之后，首个会话 RPC ──
  composeAgent → mount preset（agent.cordis.yml）
```

三点纪律：

1. **YAML 行序 ≠ 启动序**；同层 peer 按 `inject` / 服务可用性激活（base 文件内也写明）。
2. **`webserver.listen` 早于产品就绪**：套接字可先开，`/api` 与 SPA fallback 稍后才齐。
3. **Host 启动只挂 `agent-presets` roster**；某个 preset 的 `agent.cordis.yml` 要等首个会话 create/resume 才 `ensureStanding`。

---

## 1. 进程入口与 argv

| 步 | 做什么 | 位置 |
|---|---|---|
| 1 | `parseDshArgs`：`--profile`、可重复 `--patch`、内层 args；`dsh web` → `profile: 'web'` | `apps/cli/src/args.ts` |
| 2 | `loadLayeredEnv('dsh')`：继承 `process.env` → cwd `.env` → `$DSH_HOME/.env` | `bin.ts` → `app-boot` |
| 3 | `mode: 'profile'` → `runProfile({ environment, profile, patchFiles, args })` | `profile-boot.ts` |

`--dump-config` / `--dump-default-config` **不**进 `boot()`，只叠同一套 patch 后打印。

---

## 2. Profile 解析与 patch 叠层（尚未挂插件）

| 步 | 做什么 |
|---|---|
| 1 | `resolveDshHome`；目录 `$DSH_HOME/profiles/<name>`；缺 `package.json` 则用 shipped 模板 `initProfile` |
| 2 | 把该 profile 的 `cordis.yml` **写成空 `[]`**（Loader 需要 include 锚点；叠完的行不写回该文件） |
| 3 | `healProfilesModuleFallback`（安装闭包 / profile 本地 fallback 链接） |
| 4 | `composeEntries`：对空列表依次 `applyEntryPatches` |

**层序（后层按 `id` 整行覆盖 config，不深合并）：**

```text
bundle 1…n（profile 的 dsh.profile.bundles 顺序）
  web:      dsh-base → dsh-web-app
  headless: dsh-base → dsh-headless
→ profiles/<name>/cordis.patch.yml
→ $DSH_HOME/cordis.patch.yml
→ --patch（argv 顺序）
→ 遥测合成 overlay（可关掉 session-telemetry-otel 行）
```

| Profile | Bundles | `patchReload` |
|---|---|---|
| **web** | base + web-app | **live** |
| headless / sdk / acp | base + 对应 app | **startup**（只叠一次） |
| sdk-minimal | 仅 sdk-minimal（无 base） | startup |
| 自定义默认 | `[dsh-base]` | 默认 live |

**Profile ≠ patch：** profile 是具名组装（选哪套 bundles + 自己的用户层）；patch 是叠在空列表上的补丁层。词汇对照见 [009 §1](./009-cordis.patch与agent.cordis的区别.md#1-profile-与-patch)；base 行清单见 [008](./008-dsh-base挂载了哪些插件.md)。

---

## 3. `boot()`：prepare → Loader → Include

`runProfile` 在 `boot()` 前还会：按 env 快照装代理、`createAppReady`、信号 → 退出码、`installFailLoud`（Loader 并发时一处失败也要标名退出）。

`boot()` 内顺序（`packages/boot/app-boot`）：

```text
new Context()
  baseUrl = profile 目录（cordis.yml 所在）
  provide dshHomePath
ctx.plugin(Loader)
prepare(hostCtx)                 # ★ 任何 YAML 行之前
mountRootInclude(空 yml, patches)
loader.await()
assertEntriesActivated()         # 仍 PENDING / FAILED → 启动失败
```

**`prepare` 提供的服务（YAML 行可 `inject`）：**

- 启动环境快照
- `cmdlineArgs` / `appExit` / `appReady`（`provideCmdline`）

因此 `web-startup` / `headless-startup` 能在配置树里声明 `inject: [cmdlineArgs]`。

---

## 4. Web：可推的依赖链（可用性驱动）

同层大量 base 行（`llm`、`sessions`、`agent`、`tools`、sandbox、approval…）**并发**挂载，彼此等 `inject`。Web 上另有一条**显式**链：

```text
cmdlineArgs
  → web-startup          # 解析 --host / --port / --no-open …
       provide webStartup
  → webserver            # inject: [webStartup]
       Service.init → server.listen（默认 127.0.0.1:3080）
  → web-runtime          # inject: webServer + webStartup
       provide webRuntime；挂 FrontendStatic（SPA fallback）
  → connection           # /api + 信任围栏（需 webRuntime、credentials）
  → client-hmr           # /plugins/events（无 pnpm run dev:web 时基本空闲）

并行（同一 loader.await 窗口内）：
  agent-presets          # 仅 roster（ctx.agentPresets）；不 mount agent.cordis.yml
  … base 其余 seam …
```

`web-app` patch 还会 **disable** 一批本应由 preset 拥有的进程级工具行（`tool-bash`、`tool-fs`、`tool-skill`…），避免 Host 平面与 Agent 平面抢注册。

**Listen vs 路由：** listen 发生在 activation；具名路由与 SPA fallback 稍后注册。匹配规则是 exact → 最长前缀 → fallback，**不**由注册先后定义语义。

`--help` / 用法错误：`parseCmdline` 可走 `appExit` 且不提供 `webStartup` → 不 listen；树 teardown 与剩余 PENDING 竞态。

---

## 5. 就绪时刻（由早到晚）

| 时刻 | 含义 |
|---|---|
| `webserver.listen` | 套接字已开；`/api` / SPA 可能尚未齐 → 短暂 404 |
| `loader.await` + `assertEntriesActivated` | **Host 组合就绪** |
| `announceReady`（web-app） | 等 `connection` 与 loader 落地后打印 `dsh web: <url>`，可选开浏览器 |
| live：watch-only Cordis HMR + `watchUserPatches`(profile + home) | 用户 patch 热更；**不**等于 Client HMR |
| `appReady.commit()` | 启动窗口正式结束（stdio 类应用也靠它决定何时听 stdin 结束） |

两种 HMR 勿混：

| 系统 | 重载什么 | 何时 |
|---|---|---|
| Cordis HMR（`cordis-plugin-hmr`） | Host 用户 patch（live）；base 里模块 HMR 行默认 **disabled** | web / 默认 custom |
| Client HMR（`dsh-client-hmr`） | 浏览器 `lib/client.js` via SSE | 始终挂在 web；无 `dev:web` 则空闲 |

---

## 6. 启动之后：首个会话才挂 Preset

Host boot **不会** Include 各 `agent.cordis.yml`。

| 何时 | 做什么 |
|---|---|
| Host boot | `agent-presets` 服务：扫 shipped + `$DSH_HOME/.agent-presets`，建 roster |
| 首个 Web 会话 create/resume | `ApiSessionController.composeAgent` → `presets.mount(agentCtx, id)` |
| `mount` | `ensureStanding`（每 preset id 单飞）→ Include 该目录 `agent.cordis.yml` → `bindScopeParent` |
| 同 preset 后续会话 | 加入同一常驻 fiber，不再第二棵树 |
| 子 agent | 亲缘 bind，不 remount |

详见 [006](./006-四种Agent-Presets对比.md)、[009](./009-cordis.patch与agent.cordis的区别.md)。

---

## 7. Headless 差异（one-shot）

- 第二层 bundle = `dsh-headless`：无 webserver / connection / `agent-presets`
- `patchReload: startup`：无 live watch、无 launcher HMR fallback
- 树 settle 后：`headless-runner` 在 **Host 平面** `agents.create` → 跑一题 → `appExit`
- Runner 在 `agents.create` 前 **await `loader.await()`**，避免 scoped 工具半组成

---

## 8. 紧凑时序（`dsh web`）

```text
parseDshArgs                         # profile=web, patches[], inner args
loadLayeredEnv
installProxyFromEnvironment
loadProfile / initProfile            # ~/.dsh/profiles/web
rewrite empty cordis.yml
healProfilesModuleFallback
compose patches                      # base → web-app → profile → home → --patch → telemetry
signals + fail-loud
prepare: cmdlineArgs, appExit, appReady, launch env
Loader + include(empty, patches)
  concurrent fibers; inject waits
  web-startup → webserver.listen → webRuntime → /api, SPA, client-hmr
  agent-presets roster（尚无 standing trees）
loader.await + assertEntriesActivated
  [announceReady: URL / 可选开浏览器]
boot() returns
live: watch-only HMR + watchUserPatches(profile+home)
appReady.commit()
── later, first session RPC ──
composeAgent → ensureStanding → mountPreset(agent.cordis.yml) → bindScopeParent
```

本机核对叠完后的树（不启动 listen 业务）：

```sh
pnpm dsh --profile web --dump-config
```

---

## 9. 和本专题其它篇

| 篇 | 关系 |
|---|---|
| [001 · hi](./001-一次hi对话的源码之旅.md) | 就绪之后一次最短对话落在哪条路径 |
| [004 · 双进程](./004-Web-UI双进程与dual-face.md) | 本篇止于 Host；浏览器 Cordis / dual-face 在 004 |
| [006 · Presets](./006-四种Agent-Presets对比.md) | §6 之后挂上的 `agent.cordis.yml` 内容差 |
| [008 · dsh-base](./008-dsh-base挂载了哪些插件.md) | 并发窗口里第一层实际 insert 了哪些行 |
| [009 · patch vs agent.cordis](./009-cordis.patch与agent.cordis的区别.md) | Profile vs patch；叠的是谁；preset 挂的是谁 |
| [000 · 流程](./000-当前项目开发流程.md) | 改启动路径时证据落点 |
| [011 · 插件分组](./011-插件分组与主要作用.md) | 仓库全量包速查（≠ 本篇挂载集） |
| [012 · 插件启动与事件流](./012-插件启动范围顺序与事件流.md) | 是否全挂、inject 序、服务 vs 事件、一回合链 |

---

*本文为 wiki 专题稿，整理自当前 checkout 的 `apps/cli`、`dsh-app-boot`、`dsh-web-app` / `dsh-headless` patch 与 `docs/architecture`；契约以那些权威源为准，随版本演进时以当前 checkout 与 `dsh --dump-config` 核对。*
