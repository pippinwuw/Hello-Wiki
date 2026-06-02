# agent-ai

TypeScript gateway for Hello-Wiki agent flows: main Agent chat, knowledge extraction, tag initialization, and retrieve sub-agent. Default HTTP port `8766`.

## Prompt sources (two layers)

| Layer | Location | Loader | Purpose |
|-------|----------|--------|---------|
| **User skills** | `apps/skills/` | `src/ingest/skill-loader.ts` | Domain prompts users can customize (e.g. `knowledge-extraction`, `tag-initialize`) |
| **Built-in templates** | `packages/agent-ai/prompts/` | `src/utils/prompt-loader.ts` | Fixed operational prompts (main agent system, retrieve expand/judge/answer) |

Do not embed long prompt strings in `.ts` files. Add or edit markdown under `prompts/` and register the id in `prompts/index.yaml`, then call `loadPrompt("your.id", { vars })`.

Override the prompts directory with `AGENT_AI_PROMPTS_DIR` (used in tests).

## Layout

```
prompts/           # index.yaml + *.md templates
src/
  agent/           # main Agent loop + tools
  ingest/          # extract / init-tags (skills + schemas)
  retrieve/        # sub-agent loop, search client
  utils/           # env, model gateway, session store, prompt-loader, monorepo-root
  server.ts        # HTTP: /agent/chat, /extract, /init-tags, /retrieve
```

## Commands

```bash
pnpm --filter agent-ai build
pnpm --filter agent-ai serve
pnpm check:agent-ai
```

Python backend calls this service for LLM steps; retrieval search hits `POST /api/v1/retrieve/search` on the backend.

## Retrieve flow (TypeScript scope)

1. **Main Agent** calls `retrieve` with `contextSummary`, `questionRestatement`, and initial `searchQueries` (declarative statements for vector search).
2. **Retrieve judge sub-agent** (`runRetrieveSubAgent`): per step, RRF search via Python; **Insight** fast path reserved (stub).
3. **Judge** (`judgeRound`): coherent session — context, restatement, plan, history, round hits, accumulated evidence; may **revise** remaining `searchQueries` for better semantic recall.
4. **build_answer**: packages `answerGuidance` + `excerpts` for the main Agent.

Initial decomposition is the main Agent’s job; the sub-agent may refine queries after reading retrieval results.
