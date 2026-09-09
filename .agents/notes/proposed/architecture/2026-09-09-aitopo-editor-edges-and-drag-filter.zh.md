# Agent Note: AITopo Editor 连线与拖拽绘制过滤

Status: proposed

[English](2026-09-09-aitopo-editor-edges-and-drag-filter.md) | 中文

## 问题

Editor 演示此前只有移动/投放/框选，缺少示例边与创建/删除连线（AT-E7）。宿主还需要可选的「拖拽时隐藏其他元素」，默认仍绘制全场景。

后续缺陷：`hideOthersWhileDragging: false`（默认）时，拖动仍像在隐藏其他元素——根因是 `beginFrame` **整幅 clear** 后再按小 dirty rect clip，非脏区像素被擦掉且得不到重绘。

## 方案

1. `CreateEdgeInteraction`：默认 Alt+拖节点连线（或 `requireAlt: false` 独占连线模式），橡皮筋预览；`commitEdgeCreate` → `addEdge` + `edgeCreated`。
2. `DeleteEdgeInteraction`：Delete/Backspace 删除选中边；`commitEdgeRemove` → `edgeRemoved`。
3. `editor.json` 补充带标签的 `data` / `control` 边，便于拖节点时看到边跟随。
4. `MoveNodeInteraction({ hideOthersWhileDragging })` 默认 **false**（全部绘制）；为 true 时拖动期间仅绘制 movers 与关联边；过滤开启时强制全帧清除。
5. `previewNodePosition` 使用 `dirty.markAll()`，保证默认不全场景被脏区擦除。
6. `beginFrame` 在部分 dirty 时只清除对应屏幕矩形（禁止整幅 clear 再 clip）。
7. Demo：Link mode、Kind、Hide others、Delete edge。

相关：[Editor interactions](2026-09-09-aitopo-editor-interactions.zh.md)。

## 备选

- **拖动时始终只画 movers**：否决；产品默认全场景绘制，隐藏为可选项。
- **Delete 同时删节点**：否决；本次键盘删除仅针对边。
- **只靠 preview markAll、不改 beginFrame**：否决；其他部分 dirty 路径仍会整幅擦除。

## 验收

- 单测覆盖创建/删除、自环与重复跳过、hideOthers 开闭、Move 对 Alt 让路。
- Editor fixture 含边；文档写明 Alt 连线与 Hide others 默认关闭。
- Hide others 关闭时拖动仍可见其他节点/组；开启时手势期间隐藏。
- `vendor/aitopo/src` 无 `twaver` / `SDK2D` 引用。
