export { runAgentChat, type AgentLoopOptions } from "./agent/loop.js";
export { historyToAgentMessages } from "./agent/history.js";
export { buildAgentTools, type ToolRegistryOptions } from "./agent/tools/registry.js";
export {
  parseAgentChatRequest,
  type AgentChatRequest,
  type AgentChatResponse,
  type AgentHistoryMessage,
} from "./agent/schemas.js";

export { extractKnowledge, extractToolResult } from "./ingest/extract-knowledge.js";
export { initializeTags, extractTagTreeResult } from "./ingest/init-tags.js";
export { buildExtractionContext } from "./ingest/context-builder.js";
export {
  EMIT_EXTRACTED_KNOWLEDGE_TOOL,
  ExtractedKnowledgeSchema,
  ExtractionRequestSchema,
  extractionTool,
  parseExtractionRequest,
  parseInitTagsRequest,
  type EffectiveRange,
  type ExtractedKnowledge,
  type ExtractionRequest,
  type SuggestedTag,
  type TagTree,
} from "./ingest/schemas.js";
export { defaultReferencesDir, loadSkillPrompt } from "./ingest/skill-loader.js";

export {
  judgeRound,
  judgeRelevance,
  judgeSufficiency,
  judgeAfterRound,
  formatSearchPlan,
  formatSessionHistory,
  formatAccumulatedEvidence,
  type RetrieveJudgeSession,
  type RetrieveJudgeContext,
} from "./retrieve/judge.js";
export { createSearchClient, type SearchClient } from "./retrieve/search-client.js";
export { createInsightClient, type InsightClient } from "./retrieve/insight-client.js";
export { runRetrieveSubAgent, type RetrieveSubAgentOptions } from "./retrieve/sub-agent-loop.js";
export {
  parseRetrieveRequest,
  parseSearchQueries,
  parseJudgeRoundResult,
  type SearchQuery,
  type RetrieveExcerpt,
  type RetrieveRequest,
  type RetrieveResponse,
  type RetrieveSessionRound,
  type JudgeRoundResult,
  type SearchHit,
} from "./retrieve/schemas.js";

export {
  completeWithGateway,
  readModelGatewayConfig,
  resolveApiKey,
  resolveModel,
  type ModelGatewayConfig,
  type ModelGatewayOptions,
} from "./utils/model-gateway.js";
export { JsonlSessionStore, type SessionStore } from "./utils/session-store.js";
export {
  loadPrompt,
  renderTemplate,
  resetPromptLoaderCache,
  type PromptBundle,
} from "./utils/prompt-loader.js";
export {
  resolveMonorepoRoot,
  resolvePackageRoot,
  resolvePromptsDir,
  resolveSkillReferencesDir,
} from "./utils/monorepo-root.js";
export { createAgentAiServer, startServer, type AgentRunner, type Extractor, type TagInitializer, type RetrieveRunner } from "./server.js";
