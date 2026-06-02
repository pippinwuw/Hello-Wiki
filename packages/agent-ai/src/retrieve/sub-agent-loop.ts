import type { Context } from "@earendil-works/pi-ai";

import { contentToText, extractJsonObject } from "../utils/content.js";
import { completeWithGateway, type ModelGatewayOptions } from "../utils/model-gateway.js";
import { loadPrompt } from "../utils/prompt-loader.js";
import { createInsightClient, type InsightClient } from "./insight-client.js";
import { judgeRound } from "./judge.js";
import {
  parseAnswerGuidance,
  type RetrieveExcerpt,
  type RetrieveRequest,
  type RetrieveResponse,
  type RetrieveSessionRound,
  type SearchHit,
  type SearchQuery,
} from "./schemas.js";
import { createSearchClient, type SearchClient } from "./search-client.js";

export type RetrieveSubAgentOptions = ModelGatewayOptions & {
  searchClient?: SearchClient;
  insightClient?: InsightClient;
  judgeRoundFn?: typeof judgeRound;
};

/**
 * Retrieve judge sub-agent: decomposed search, unified per-step judge with coherent
 * session history, optional plan revision for better semantic retrieval.
 */
export async function runRetrieveSubAgent(
  request: RetrieveRequest,
  options: RetrieveSubAgentOptions = {},
): Promise<RetrieveResponse> {
  const judgeRoundFn = options.judgeRoundFn ?? judgeRound;
  const searchClient =
    options.searchClient ??
    createSearchClient({
      workspaceId: request.workspaceId,
    });
  const insightClient = options.insightClient ?? createInsightClient();

  let activePlan: SearchQuery[] = [...request.searchQueries];
  let planIndex = 0;
  const sessionHistory: RetrieveSessionRound[] = [];
  const accumulated: SearchHit[] = [];
  let sufficient = false;
  let steps = 0;
  const maxSteps = request.maxIterations ?? 12;

  while (steps < maxSteps && planIndex < activePlan.length) {
    steps += 1;
    const roundQuery = activePlan[planIndex]!;
    const excludePageIds = accumulated.map((hit) => hit.pageId);
    const roundHits = await retrieveOnce(
      roundQuery,
      request.topK!,
      searchClient,
      insightClient,
      excludePageIds,
    );

    const judged = await judgeRoundFn(
      roundHits,
      accumulated,
      {
        contextSummary: request.contextSummary,
        questionRestatement: request.questionRestatement,
        activePlan,
        planIndex,
        roundQuery,
        sessionHistory,
      },
      options,
    );

    mergeHits(accumulated, judged.relevantHits);

    const planRevised = Boolean(judged.revisedSearchQueries?.length);
    sessionHistory.push({
      step: steps,
      query: roundQuery.query,
      purpose: roundQuery.purpose,
      roundHitCount: roundHits.length,
      relevantCount: judged.relevantHits.length,
      analysis: judged.analysis,
      planRevised,
    });

    if (judged.sufficient) {
      sufficient = true;
      break;
    }

    if (planRevised && judged.revisedSearchQueries) {
      activePlan = judged.revisedSearchQueries;
      planIndex = 0;
      continue;
    }

    planIndex += 1;
  }

  const built = await buildAnswer(request, accumulated, sufficient, options);
  return {
    sufficient,
    iterations: steps,
    answerGuidance: built.answerGuidance,
    excerpts: built.excerpts,
    searchQueries: activePlan,
    sessionRounds: sessionHistory,
  };
}

async function retrieveOnce(
  searchQuery: SearchQuery,
  topK: number,
  searchClient: SearchClient,
  insightClient: InsightClient,
  excludePageIds: string[] = [],
): Promise<SearchHit[]> {
  const [slowResult, fastResult] = await Promise.all([
    searchClient.search(searchQuery, topK, excludePageIds),
    insightClient.search(searchQuery, topK),
  ]);

  const hits = [...slowResult.hits];
  if (!fastResult.skipped && fastResult.hits.length > 0) {
    mergeHits(hits, fastResult.hits);
  }
  return hits;
}

function mergeHits(target: SearchHit[], incoming: SearchHit[]): void {
  const seen = new Set(target.map((hit) => hit.pageId));
  for (const hit of incoming) {
    if (seen.has(hit.pageId)) continue;
    seen.add(hit.pageId);
    target.push(hit);
  }
}

async function buildAnswer(
  request: RetrieveRequest,
  hits: SearchHit[],
  sufficient: boolean,
  options: ModelGatewayOptions,
): Promise<{ answerGuidance: string; excerpts: RetrieveExcerpt[] }> {
  if (hits.length === 0) {
    return {
      answerGuidance: "未检索到足够相关的知识，请尝试换个问法或补充文档。",
      excerpts: [],
    };
  }

  const evidence = hits
    .map(
      (hit) =>
        `pageId=${hit.pageId}; title=${hit.title ?? "无标题"}; summary=${hit.summary ?? ""}; compiledTruth=${hit.compiledTruth}; originalText=${hit.originalText.slice(0, 800)}`,
    )
    .join("\n\n");

  const { system, user } = await loadPrompt("retrieve.build_answer", {
    contextSummary: request.contextSummary || "（未提供）",
    questionRestatement: request.questionRestatement,
    sufficient: sufficient ? "是" : "否",
    evidence,
  });
  const context: Context = {
    systemPrompt: system ?? "",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: user ?? "" }],
        timestamp: Date.now(),
      },
    ],
  };

  const assistant = await completeWithGateway(context, options);
  const parsed = parseAnswerGuidance(extractJsonObject(contentToText(assistant.content)));

  if (parsed.excerpts.length > 0) {
    return parsed;
  }

  return {
    answerGuidance: parsed.answerGuidance || "已整理检索结果，请结合 excerpts 回答用户。",
    excerpts: hits.map((hit) => ({
      pageId: hit.pageId,
      title: hit.title ?? "",
      compiledTruth: hit.compiledTruth,
      originalText: hit.originalText,
      summary: hit.summary ?? "",
      relevance: "自动收录的相关证据",
    })),
  };
}
