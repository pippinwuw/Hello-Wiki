# Hello-Wiki（知原）

面向组织知识管理的 **Wiki + 智能体** monorepo：把文档采编为结构化知识（PostgreSQL），再通过主 Agent 对话与 Retriever 子智能体检索回答。

## 职责边界

| 运行时 | 负责 |
|--------|------|
| **Python** (`apps/backend`) | Wiki 展示相关 API、PostgreSQL 与 Ingest/Retrieve 等 **数据库 API**（检索 RRF 在 Python；不调 LLM） |
| **TypeScript** (`packages/agent-ai`) | **一切 LLM 调用**与 **上下文管理**（Agent 会话、Retriever trace、提取与标签树生成） |

Web 管理端：业务数据走 Python `:8000`；智能对话可走 TS `:8766` 或 Python 代理。细则见 [`docs/dev.md`](docs/dev.md#职责边界主规范)。

## 能做什么

- **知识采编（Ingest）**：知识库页上传文档，经 `ingest/documents/{id}/compile` 跑分块 + TS 提取并写入 PostgreSQL。
- **标签体系（Init Tags）**：按知识域生成层级标签树，并注册到 `knowledge_domains`。
- **智能对话（Agent）**：`/chat` 直连 TS 主 Agent（`retrieve` 工具 + JSONL 会话），或经 Python `POST /api/v1/agent/chat` 代理。
- **混合检索（Retrieve）**：按 workspace + domain 的 Tag / BM25 / 语义（需 embedding）/ 时间 RRF；Retriever 多轮迭代（Insight 编排已接、库检索待补）。

## 技术栈一览

| 层 | 技术 |
|----|------|
| 前端 | Next.js 16、React 19、Tailwind CSS v4 |
| 后端 API | FastAPI、asyncpg、PostgreSQL + pgvector |
| AI 网关 | `packages/agent-ai`（`@earendil-works/pi-ai` / `pi-agent-core`） |
| 包管理 | pnpm workspace |

## 快速开始

```bash
pnpm install
pnpm serve:agent-ai          # 终端 1：TS 网关 :8766
cd apps/backend && python run.py   # 终端 2：API :8000
pnpm dev                     # 终端 3：Web :3000
```

环境、数据库、多租户 Header、API 列表与联调细节见 **[开发指南 `docs/dev.md`](docs/dev.md)**。

## 文档

| 文档 | 读者 |
|------|------|
| [**docs/dev.md**](docs/dev.md) | 日常开发、联调、API 速查、调试路径 |
| [**docs/README.md**](docs/README.md) | 里程碑变更说明（按日期） |
| [apps/backend/README.md](apps/backend/README.md) | 后端分层、schema、测试与 import-linter |
| [packages/agent-ai/README.md](packages/agent-ai/README.md) | Agent / Retriever 职责边界 |

近期实现说明（提交远程仓库）：

- [2026-06-03 — Retrieve 多租户与 Catalog API](docs/2026-06-03-mvp-retrieve-domains-implementation.md)
- [2026-06-03 — Ingest 提取迁至 TypeScript](docs/2026-06-03-ts-ingest-extraction-gateway.md)
- [2026-05-09 — Ingest 管道首版](docs/2026-05-09-ingest-pipeline-implementation.md)

> 仓库内 `openspec/` 为本地工作流目录（已在 `.gitignore` 中），不随 git 推送；对外以 `docs/` 为准。

## 仓库结构（简图）

```
apps/web          → 管理端 UI
apps/backend      → Wiki API + DB/Ingest/Retrieve（:8000，无 LLM）
packages/agent-ai → LLM + 上下文（:8766）
apps/skills       → 领域 Prompt / 标签模板
docs/             → 开发指南与变更文档
```

## 许可与协作

采用 GitHub 功能分支 + Pull Request；合并前请通过 CI（`pnpm lint`、`pnpm build`、`pnpm check:agent-ai` 等，见 `docs/dev.md`）。
