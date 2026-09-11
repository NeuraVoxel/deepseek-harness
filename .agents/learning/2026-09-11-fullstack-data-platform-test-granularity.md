# 全栈数据管理平台：测试粒度设计

首次撰写：2026-09-11

> 学习笔记，非正式权威。对照本仓分层见 [harness 测试范围按粒度划分](2026-09-11-harness-test-tiers-by-granularity.md)；权威政策为 [docs/testing.md](../../docs/testing.md)。本文面向「TS 前端 + Python/Node 后端」的端到端数据管理平台，不绑定具体业务仓。

## 一句话

按 **「证明什么」** 分层，而不是按前后端语言硬拆。数据正确性压在 **后端集成 + API E2E**；前端偏交互规则；契约单独一门防接口漂移；UI E2E **少而精**；真依赖冒烟与 CI 日常分开。

## 粒度表（由窄到宽）

| 粒度 | 前端 (TS) | 后端 (Python / Node) | 证明什么 |
|---|---|---|---|
| **1. 单元 Unit** | 纯函数、状态机、表单校验、表格排序/过滤、权限判断 | domain/service、校验、聚合、权限、幂等 | 零件行为正确 |
| **2. 覆盖率 Coverage** | 关键 `src`（或核心包）设门槛 | 同理；库可 80–90%，核心域可更高 | 关键路径被跑到（不证明业务对） |
| **3. 组件 / Handler** | React/Vue 组件 + MSW/假 API | API handler + 内存/测试 DB 或仓储 mock | 单层组装正确 |
| **4. 契约 Contract** | OpenAPI/JSON Schema 生成客户端；消费方契约测 | 提供方契约 + schema 兼容 | 前后端接口不漂移 |
| **5. 集成 Integration** | — | 真 DB/队列/对象存储（testcontainers 等） | 持久化、事务、迁移、并发写 |
| **6. API 端到端（无 UI）** | — | 起真实服务，HTTP/gRPC 打完整用例 | 「数据链路」：导入→校验→查询→导出 |
| **7. UI 端到端** | Playwright/Cypress 对真实或预发环境 | 同一环境后端 | 用户路径：登录→建资源→改数据→看见结果 |
| **8. 真依赖 / 预发冒烟** | 可选 | 真 IdP、真对象存储、真外部数仓（可控） | 线上类依赖仍可用 |
| **9. 性能 / 负载** | 大表渲染、虚拟滚动 | 批量导入、查询、并发写入 | 预算内可接受 |

## 设计原则

1. **数据正确性** → 后端集成 + API E2E（导入、去重、权限过滤、审计、软删用真 DB；不要主要靠点 UI）。
2. **前端单测** → 展示与交互规则（列配置、筛选、脏数据提示、乐观更新回滚）；少测「后端算得对不对」。
3. **契约单独一门** → OpenAPI（或 protobuf）+ 提供方/消费方契约测，比堆 UI e2e 便宜。
4. **UI E2E 少而精** → 约 5–15 条黄金路径；细分支留给单元/API。
5. **真环境分层** → CI 日常：unit + coverage + contract + DB 集成 + 少量 API E2E；夜间/预发：UI E2E + 真依赖冒烟；无密钥要能 skip。
6. **Python vs Node 不改分层，只改工具** → pytest / vitest+supertest 等；前端 vitest + Testing Library + Playwright。

## 与 harness 口诀的对应

| harness | 数据管理平台 |
|---|---|
| Unit + Coverage | 前后端零件 + 覆盖率门禁 |
| Expected / Snapshot | API 固定响应夹具；或关键流程录制回放（可选） |
| Web | Playwright UI E2E |
| Real-API E2E | 真 IdP / 真对象存储 / 真数仓冒烟 |

**口诀：** 单测看零件，契约看接口，集成看库表，API E2E 看数据链路，UI E2E 看人话路径，真依赖看接电。

## 落地顺序

1. 后端领域单测 + 真 DB 集成
2. OpenAPI 契约
3. API 黄金路径 E2E
4. 前端单元/组件
5. 少量 Playwright
6. 覆盖率门槛与性能预算

## 按核心实体：每层用例清单

以常见数据平台实体为例（可替换成你们的名称）：**数据集（Dataset）**、**导入/任务（Job）**、**权限（ACL/Role）**。每条写「可观测结果」，不写「应正确」。

### 数据集 Dataset

| 层 | 建议用例 |
|---|---|
| Unit | 名称/标签校验；状态机（draft→published→archived）；字段 schema 合并/冲突规则 |
| Handler / 组件 | 创建表单校验提示；列表筛选空态；详情只读字段展示 |
| Contract | `POST/GET/PATCH /datasets` 请求响应字段与枚举与 OpenAPI 一致 |
| Integration | 创建写入 DB；软删后列表不可见、管理接口仍可读；唯一约束冲突 |
| API E2E | 创建 → 更新元数据 → 按标签查询 → 导出元数据 → 归档 |
| UI E2E | 登录 → 新建数据集 → 列表可见 → 打开详情 → 编辑保存 |
| 真依赖冒烟 | （若元数据在外部目录）对真实目录服务读一次 |

### 导入 / 任务 Job

| 层 | 建议用例 |
|---|---|
| Unit | 文件类型/大小校验；行级错误分类；重试/幂等键 |
| Handler / 组件 | 上传进度与失败 toast；任务状态徽章映射 |
| Contract | `POST /jobs`、`GET /jobs/{id}` 状态枚举与错误码 |
| Integration | 落对象存储 + DB 任务行；失败回滚或标记 failed；并发同 key 只成功一次 |
| API E2E | 上传样例文件 → 任务成功 → 查询行数/样例 → 下载错误报告 |
| UI E2E | 选择文件 → 开始导入 → 等待完成（或轮询）→ 结果页可见 |
| 性能 | 约定规模（如 N 行）在时间预算内完成 |

### 权限 ACL / Role

| 层 | 建议用例 |
|---|---|
| Unit | 角色→权限集合；资源级 allow/deny 合成 |
| Handler / 组件 | 无权限隐藏按钮；403 页文案 |
| Contract | 鉴权头/错误体形状稳定 |
| Integration | 用户 A 写入对 B 不可见；管理员可审计 |
| API E2E | 低权限调用写接口 → 403；提权或换角色后成功 |
| UI E2E | 低权限账号看不到「删除」；高权限可见并可完成删除 |
| 真依赖冒烟 | 对接真 IdP 登录一次拿 token |

### UI E2E 黄金路径配额（建议上限）

1. 登录 / 登出
2. 数据集 CRUD 主路径
3. 一次成功导入
4. 一次失败导入（可见错误报告）
5. 权限拒绝（按钮或提交被拒）
其余分支尽量下沉到 API / 单元。

## CI 怎么挂（示意）

| 时机 | 跑什么 |
|---|---|
| 每 PR | 前后端 unit + coverage 门槛 + contract + DB 集成 + 少量 API E2E |
| 夜间 / 预发 | UI E2E + 真依赖冒烟 +（可选）性能 |
| 本地推前 | 只跑 diff 碰到的最窄层；全量留给 CI |

## 工具速查（不强制）

| 侧 | 常用 |
|---|---|
| 前端 | Vitest、Testing Library、MSW、Playwright |
| Node 后端 | Vitest/Jest、Supertest、testcontainers |
| Python 后端 | pytest、httpx/TestClient、coverage.py、testcontainers |
| 契约 | OpenAPI（或 protobuf）+ 提供方/消费方契约测 |

持久合同与门禁以各产品仓自己的 `docs/testing*` / CI 为准；本笔记只固定「分层怎么切、每层写什么类用例」。
