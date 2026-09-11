# `verify-archived-agent-notes` 如何封存归档 Agent Note

首次撰写：2026-09-11

> 学习笔记，非正式权威。政策与后果：[Agent Note — frozen Agent Note archive](../notes/implemented/process/2026-07-26-frozen-agent-note-archive.md)。实现：[`scripts/verify-archived-agent-notes.ts`](../../scripts/verify-archived-agent-notes.ts)、[`scripts/archived-agent-notes.ts`](../../scripts/archived-agent-notes.ts)。操作流程：[`dsh-archive-agent-notes`](../skills/dsh-archive-agent-notes/SKILL.md)。对比 kit「仅流程约定」见 [ai-eng-kit 与 harness 规范对比](2026-09-11-ai-eng-kit-vs-harness-conventions.md)。

## 一句话

**用一份仅追加（append-only）的内容清单 `manifest.json`，按路径记下每个归档文件字节的 SHA-256；校验时对照磁盘内容与 Git 基线 manifest，禁止改 hash、删条目——封存不是加密，是「承诺表 + 哈希 + 门禁」。**

## 要防什么

归档 = 历史快照，不是「旧文档偶尔维护」。若普通 `doc-sync`（双语、换行、链接、格式…）继续扫归档源，标准一变就会有人去「修」历史。

因此：普通文档门禁**排除** `archived/`；改由专用门禁管 **完整性 + 不可变**。

## 封存物长什么样

`.agents/notes/archived/manifest.json`：

```json
{
  "version": 1,
  "files": {
    "process/yyyy-mm-dd-topic.md": "sha256:<64 hex>",
    "process/yyyy-mm-dd-topic.zh.md": "sha256:<64 hex>",
    "process/yyyy-mm-dd-topic.i18n.yaml": "sha256:<64 hex>"
  }
}
```

每个路径 → **原始文件字节** 的 SHA-256（`sha256:` 前缀）。与 Git 对象格式无关；改一个空格 hash 就变。

## 两层哈希，职责不同

| 层 | 算法 | 用途 |
|---|---|---|
| **manifest 封存** | 纯 `SHA-256(file bytes)` | 「这个归档文件从此字节不可变」——冻结主链 |
| **`.i18n.yaml` sidecar** | Git blob SHA-1（`blob <len>\0` + content） | 「英/中配对仍是当初那两份」——双语一致性，不是 freeze 主链 |

## 校验怎么走（无 `--write`）

1. **扫盘**：`archived/{kind}/**`；封闭 kind 集合；三元组完整；`Status: implemented`；`Archived: YYYY-MM-DD` 合法且英中一致；sidecar 对得上当前 Git blob hash。
2. **读当前 manifest**，再读 **基线**（本地默认 `HEAD`；PR CI 用 `DSH_ARCHIVE_BASE_REF` = base SHA / `github.event.before`）：
   - `validateArchiveManifestExtension(baseline, current)` → 基线已有 path：**不能删、hash 不能改**（manifest 自身也只能追加）。
3. **`extendArchiveManifest`**：对已封存 path，用磁盘内容重算 SHA-256，必须等于 manifest；磁盘有而 manifest 无的 path 记为 `added`。
4. **普通模式对 `added` 报错**——新归档必须先 `--write` 封进 manifest 再提交。

## `--write` 在干什么

合法归档流程：

1. 完整三元组挪进 `archived/`，两边插入相同 `Archived:` 行，重录 sidecar，修入站链接。
2. `pnpm run verify-archived-agent-notes --write`：先证明**旧 seals 仍匹配**；再**只追加**新 path 的 hash；写出 `manifest.json`。
3. 再跑无 `--write` 的校验应通过。

## 为什么还要相对 Git 基线比一遍

若有人改旧文件，同时把 manifest 里对应 hash **改成新值**，只比「磁盘 ↔ 当前 manifest」会绿。
再比 `baseline → current`：旧条目的 hash 一变就红。CI 用可信 base，避免浅克隆缺基线。

## 心智模型

像 **lockfile / SBOM 的 append-only 子集**：归档时给每个文件贴内容指纹；之后任何「改文 + 改指纹」或「删文」都会在门禁上露馅；唯一合法演进是 **新增条目**。

## 相关命令

```sh
pnpm run verify-archived-agent-notes          # 校验
pnpm run verify-archived-agent-notes --write  # 追加封存新产物
```

pre-commit / `doc-sync`（quick）会跑该门禁；权威政策与 rejected 方案见上方 Agent Note。
