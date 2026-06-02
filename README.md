# hello-wiki

`hello-wiki` 是一个基于 **pnpm workspace** 的 monorepo，当前包含：

- `apps/web`：Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- `apps/backend`：FastAPI 分层架构 + Agent + Ingest Pipeline（已可端到端运行）
- `packages/agent-ai`：统一 TS 后端 LLM 网关（Agent Loop、Ingest 提取、Retrieve SubAgent、会话上下文）
- `apps/skills/`：LLM Skill 定义（tag-initialize、knowledge-extraction）

## 当前开发进度

### Web（`apps/web`）

- [x] 已完成 Next.js 工程初始化与基础依赖接入
- [x] 已接入 shadcn 风格侧边栏与 12 个业务模块路由
- [x] 已基于 `openspec/原型功能说明_知原_v2.md` 搭建基础前端页面
- [x] 已新增前端 API 客户端：文件/CRUD/固定工作流调用 Python API，Chat/Agent 可直连 TS Agent API
- [x] 已将根路径 `/` 导向 `/home`，并补齐 `/login`、`/about` 基础页面
- [ ] 前端页面仍以 Mock 数据为主，上传/编译/审核/导出等写操作待后续接入真实业务接口

### Backend（`apps/backend`）

- [x] 已完成 FastAPI 分层目录骨架（`api/application/domain/infra/workers/core`）
- [x] PostgreSQL + pgvector + zhparser 数据库（Docker 环境，`deploy/dev/docker-compose.yml`）
- [x] Ingest 模型网关（`packages/agent-ai` `/extract`、`/init-tags`，Python 管道 HTTP 调用）
- [x] Agent Loop（`packages/agent-ai` `/agent/chat`，JSONL 会话记忆，历史写入 `messages[]`）
- [x] 检索 SubAgent（`packages/agent-ai/src/retrieve`，主 Agent `retrieve` tool 进程内调用；快路径 Insight 占位）
- [ ] Compile / Chat QA 业务逻辑仍为占位
- [ ] Wiki / Compile / QA 业务逻辑（占位 stub，待替换为 Agent + 检索驱动）

## 环境要求

建议本地与 CI 保持一致：

- **Node.js** >=22.19.0
- **pnpm** 10
- **Python** 3.11+（用于 `apps/backend`）

安装 pnpm 参考：[pnpm 安装文档](https://pnpm.io/installation)

## 本地开发

在仓库根目录执行：

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装 workspace 依赖 |
| `pnpm dev` | 并行启动 web 与 backend 开发服务 |
| `pnpm serve:agent-ai` | 启动统一 TS LLM 网关（默认 `127.0.0.1:8766`：`/agent/chat`、`/extract`、`/init-tags`、`/retrieve`） |
| `pnpm check:agent-ai` | 类型检查 + 测试 agent-ai |
| `pnpm build` | 构建 web 应用 |
| `pnpm start` | 启动 web 生产服务（需先 build） |
| `pnpm lint` | 运行 web 的 ESLint |

### 访问地址

- Web: <http://localhost:3000>
- Backend API: <http://127.0.0.1:8000/api/v1>
- Backend 健康检查: <http://127.0.0.1:8000/health>
- Agent AI Gateway: <http://127.0.0.1:8766/health>（同时提供 `/extract`、`/init-tags`、`/retrieve`）

本地联调：`pnpm serve:agent-ai` + `python run.py`（backend）。

## 当前路由与接口状态

### Web 路由

- `/`：重定向到 `/home`
- `/home`：工作台，展示 Wiki 指标、最近文档、最近对话、快捷入口
- `/knowledge`：知识库，展示文档管理、状态筛选、Wiki 产物预览
- `/compile`：知识编译，展示状态仪表板、编译队列、7 步流水线和日志
- `/chat`：智能对话，展示 Wiki 导航、消息流和引用上下文
- `/wiki`：Wiki 浏览，展示目录树、页面内容、标签和来源
- `/ops`：运营后台，展示指标、趋势、对话日志和未知问题分析
- `/audit`：知识审核，展示审核队列、冲突对比和审核动作
- `/simulation`：模拟测试，展示场景选择、评分概览和测试报告
- `/channels`：多渠道接入，展示 JS SDK、公众号/小程序、API Key 配置
- `/permissions`：权限管理，展示成员、角色和团队空间
- `/devops`：系统运维，展示服务监控、告警、模型池、备份恢复
- `/settings`：系统设置，展示基础设置、CLAUDE.md、AGENTS.md、LLM、安全、版本定价
- `/login`：登录视觉页（鉴权待接入）
- `/about`：产品定位与系统闭环说明

### Backend 接口

| 端点 | 状态 | 说明 |
|---|---|---|
| `GET /health` | ✅ | 健康检查 |
| `POST /api/v1/agent/chat` | ✅ | Python 兼容代理，转发 TS Agent，不管理对话记忆 |
| `POST /api/v1/ingest/upload` | ✅ | 文件导入 + TS 模型网关结构化提取 |
| `GET /api/v1/ingest/status/{id}` | ✅ | 导入进度查询 |
| `POST /api/v1/init/tags` | ✅ | Python 固定工作流，LLM 子步骤由 TS agent-ai 执行 |
| `POST /api/v1/retrieve/search` | ✅ | 四路 RRF 混合检索（Tag + 语义 + BM25 + 时间），无 LLM |
| `GET /api/v1/wiki/pages` | ✅ | Wiki 页面列表 |
| `GET /api/v1/wiki/pages/{id}` | ✅ | Wiki 页面详情 |
| `POST/PUT/DELETE /api/v1/wiki/pages` | ✅ | Wiki 页面基础 CRUD |
| `GET /api/v1/wiki/tree` | ✅ | Wiki 目录树 |
| `GET /api/v1/wiki/stats` | ✅ | Wiki 统计信息 |
| `POST /api/v1/chat/stream` | ✅ | Chat SSE 流式响应骨架 |
| `POST /api/v1/ingest/compile` | ⚠️ 501 | 占位接口 |
| `POST /api/v1/chat/ask` | ⚠️ 501 | 占位接口 |

> **当前状态**：主应用入口已注册 `/api/v1` 路由；前端已优先复用健康检查、Wiki、workspace 等已提供接口，并在接口不可用或暂无数据时回退到原型 Mock 数据。Chat QA 与 Compile 仍有 501 骨架，Ingest 上传通过 Python 管道调用 `packages/agent-ai`（`:8766`）完成模型网关提取；领域 prompt 在 `apps/skills/`，内置运维 prompt 在 `packages/agent-ai/prompts/`。

### TS AI Gateway 边界

| 服务 | 端点 | 状态 | 说明 |
|---|---|---|---|
| `agent-ai` | `POST /agent/chat` | ✅ | 主 Agent 编排 + JSONL 会话 |
| `agent-ai` | `POST /extract` | ✅ | Ingest 结构化提取（Python 调用） |
| `agent-ai` | `POST /init-tags` | ✅ | 标签树 LLM 生成（Python init 工作流调用） |
| `agent-ai` | `POST /retrieve` | ✅ | 检索 SubAgent Loop（也可由主 Agent tool 进程内调用） |

> **职责边界**：Python 负责 DB CRUD 与源文件接口；TS（`packages/agent-ai`）负责全部 LLM 调用与会话上下文。主 Agent 的 `retrieve` tool 在进程内调用 `src/retrieve/sub-agent-loop.ts`，慢路径检索 HTTP 调 Python `/api/v1/retrieve/search`（后端待你审查后联调）。

## 项目结构

```
hello-wiki/
├── apps/
│   ├── web/                     # Next.js 前端
│   ├── backend/                 # FastAPI 后端
│   │   ├── deploy/dev/          # Docker 开发环境（PG + Redis）
│   │   └── src/
│   │       ├── api/             # HTTP 路由 + schemas
│   │       ├── application/     # 业务用例（agent/init/ingest/chat/wiki）
│   │       ├── domain/          # 领域实体 + 端口（ai/knowledge/wiki）
│   │       ├── infrastructure/  # 实现（ai/db/parser/storage）
│   │       ├── core/            # 配置/日志/追踪
│   │       └── workers/         # TaskIQ 后台任务
│   └── skills/                  # LLM Skill 定义
│       ├── tag-initialize/      # 标签体系生成
│       └── knowledge-extraction/ # 结构化知识提取
├── packages/
│   └── agent-ai/                # TS gateway: agent chat, ingest extract, retrieve (pi-agent-core)
│       ├── prompts/             # 内置固定模板（loadPrompt）
│       └── src/ingest/          # 用户 skill 见 apps/skills/
├── .github/workflows/           # CI 工作流
├── package.json
└── pnpm-lock.yaml
```

## 后续任务

| 优先级 | 任务 | 说明 |
|---|---|---|
| **高** | Pages/Tags 主路径统一 | 统一文件 Wiki 与 PostgreSQL knowledge 路径 |
| **高** | Pages 基础 CRUD | `GET/PUT/DELETE /pages/{id}` — 知识实体的增删改查，目前只能通过 ingest 导入 |
| **高** | Tags 管理接口 | `GET /tags`（树形结构）、`PUT /tags/{id}`（重命名/移动）— 标签体系的可视化与管理 |
| **中** | 知识检索（RRF 混合检索） | `POST /search` — 多路融合：Tag 匹配 + 语义向量 + BM25 关键词 + 时间范围 |
| **中** | Embedding 向量生成 | `raw_chunks.summary_vector` / `pages.truth_embedding` 目前为 NULL，需要调用 embedding 模型填充 |
| **中** | 扫描件 PDF 支持 | `PyPDFLoader` 无法处理图片型 PDF，需接入 MinerU OCR 或 `pypdf` + `pdf2image` |
| **低** | Chat / QA 替换 | 用 Agent Loop + 检索驱动替换现有 `ChatExecutor` stub |
| **低** | Tenant 隔离 | `X-Workspace-ID` 过滤 tags/raw_chunks/pages 的读写 |
| **低** | OCR 文本校验提醒 | `effective_range.stale_risk` 前端可视化 + 过期内容标记 |

## 协作与 Pull Request

团队在 GitHub 采用「功能分支 -> Pull Request -> 合并到 `main`」流程，避免直接向 `main` 推送。

1. 同步主分支：`git checkout main` -> `git pull origin main`
2. 从 `main` 拉分支：如 `feat/xxx`、`fix/xxx`、`docs/xxx`
3. 开发与自测：提交前执行 `pnpm lint`、`pnpm build`
4. 推送并创建 PR：说明问题背景、主要改动、是否有迁移/配置影响
5. Review 与合并：CI 绿灯后再合并

## CI 检查说明

CI 位于 `.github/workflows/ci.yml`，在 `push` 与 `pull_request` 上执行：

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm build`
- `pnpm check:agent-ai`

## Git Commit 规范

建议使用 Conventional 风格前缀，便于检索与生成变更说明：

- `feat`：新增功能
- `fix`：修复问题
- `docs`：文档更新
- `style`：仅格式调整（不改逻辑）
- `refactor`：重构（无新增功能/无修复）
- `perf`：性能优化
- `test`：测试相关
- `chore`：工程配置/脚手架/依赖维护
- `revert`：回滚提交

示例：`feat: 添加词条搜索`、`docs: 更新项目开发进度`

## 参考文档

- [Next.js 文档](https://nextjs.org/docs)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [pnpm Workspace 文档](https://pnpm.io/workspaces)
- [JS 开发命名规范](https://juejin.cn/post/6844903492415406088)
