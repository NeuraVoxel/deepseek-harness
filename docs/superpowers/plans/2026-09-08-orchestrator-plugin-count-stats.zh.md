# 编排工具栏插件数量 — 实现计划

[English](2026-09-08-orchestrator-plugin-count-stats.md) | 中文

> **给 Claude：** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 按任务实现本计划。

**目标：** 在编排工具栏显示只读的 Preset 与宿主已加载插件数量；数字始终取自当前 Preset 的完整 inventory 文档（与 Host-loaded checkbox 无关）。

**架构：** 对 `orchestrationDoc` 取 `composition.length` / `catalog.length`。不要用 `canvasDoc` / `documentForCanvas` 做统计。在 Preset 选择后增加 locale 键与弱化内联文案。规格：[`../specs/2026-09-08-orchestrator-plugin-count-stats-design.zh.md`](../specs/2026-09-08-orchestrator-plugin-count-stats-design.zh.md)。

**技术栈：** TypeScript、React（`OrchestratorView` + locales + CSS）、可选薄辅助 + vitest。

---

### 任务 1：Locale 键 + 工具栏数量 UI

**文件：**
- 修改：`plugins/agent-orchestrator/src/client/locales.ts`
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.module.css`

**步骤 1：Locale**

```ts
// zh
'toolbar.pluginCounts': '本 Preset {composition} · 宿主已加载 {catalog}',
// en
'toolbar.pluginCounts': 'This Preset {composition} · Host-loaded {catalog}',
```

**步骤 2：从完整文档取数**

当 `orchestrationDoc !== null`：

```ts
const compositionCount = orchestrationDoc.composition.length
const catalogCount = orchestrationDoc.catalog.length
```

切勿从 `canvasDoc` 取数（checkbox 关闭时其 `catalog` 可能为空数组）。

**步骤 3：工具栏 UI**

在 Preset `<select>` 之后（Host-loaded checkbox 之前）渲染：

```tsx
<span className={css.pluginCounts} aria-live="polite">
  {t('toolbar.pluginCounts', {
    composition: compositionCount,
    catalog: catalogCount,
  })}
</span>
```

仅在已有 `orchestrationDoc` 的成功路径渲染（与画布同一路径）。

CSS：12px、弱化透明度（约 0.7–0.85）、无边框/背景/卡片；与现有 toolbar 项对齐。

**步骤 4：手工确认** — Host-loaded 未勾选时，若存在仅宿主插件则 catalog 计数仍非 0；切换 Preset 两个数字都会更新。

**步骤 5：提交**

```sh
git add plugins/agent-orchestrator/src/client/locales.ts \
  plugins/agent-orchestrator/src/client/OrchestratorView.tsx \
  plugins/agent-orchestrator/src/client/OrchestratorView.module.css
git commit -m "$(cat <<'EOF'
Show Preset and Host-loaded plugin counts on Orchestrate.

EOF
)"
```

---

### 任务 2：可选计数辅助测试 + README

**文件：**
- 可选新建：`plugins/agent-orchestrator/src/plugin-counts.ts` + `.spec.ts`，若抽出 `countsFromDocument(doc) => { composition, catalog }` 比接 React 更易测「不从 canvasDoc 取数」。
- 修改：`plugins/agent-orchestrator/README.md` + `.zh.md`（一句说明工具栏显示来自完整文档的 Preset / 宿主已加载数量）。
- 新建：`.agents/notes/implemented/feature/2026-09-08-orchestrator-plugin-count-stats.md`（+ zh / i18n）；若属机械/局部改动可按 Agent Note 范围规则跳过。

优先在单测更便宜时抽出辅助：

```ts
export function pluginCountsFromDocument(document: OrchestrationDocument): {
  composition: number
  catalog: number
} {
  return {
    composition: document.composition.length,
    catalog: document.catalog.length,
  }
}
```

测试：`documentForCanvas(full, false)` 之后，对 `full` 取数仍报告 `full.catalog.length`；工具栏不得对过滤后的文档取数。

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm run verify-translation-pairing --write plugins/agent-orchestrator/README.md
# if Agent Note:
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-orchestrator-plugin-count-stats.md
git add …
git commit -m "$(cat <<'EOF'
Document Orchestrate toolbar plugin count stats.

EOF
)"
```

---

## 非范围

- 只统计当前画布可见节点
- 持久化 / Host Remote 改动
- UI 文案使用 Session / Global
- Live 高亮或详情面板改动
