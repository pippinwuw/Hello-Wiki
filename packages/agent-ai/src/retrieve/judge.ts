import type { Context } from "@earendil-works/pi-ai";

import { contentToText } from "../utils/content.js";
import { completeWithGateway, type ModelGatewayOptions } from "../utils/model-gateway.js";
import { loadPrompt } from "../utils/prompt-loader.js";
import {
  parseJudgeRoundResult,
  parseJudgedPageIds,
  parseSufficiencyResult,
  type JudgeRoundResult,
  type RetrieveSessionRound,
  type SearchHit,
  type SearchQuery,
} from "./schemas.js";

/** Coherent context for the retrieve judge across the whole retrieval session. */
export type RetrieveJudgeSession = {
  contextSummary: string;
  questionRestatement: string;
  activePlan: SearchQuery[];
  planIndex: number;
  roundQuery: SearchQuery;
  sessionHistory: RetrieveSessionRound[];
};

export function formatSearchPlan(searchQueries: SearchQuery[]): string {
  return searchQueries
    .map((item, index) => {
      const purpose = item.purpose ? `；意图：${item.purpose}` : "";
      const tags =
        item.targetTags.length > 0 ? `；标签：${item.targetTags.join(", ")}` : "";
      return `${index + 1}. ${item.query}${purpose}${tags}`;
    })
    .join("\n");
}

export function formatRoundQuery(roundQuery: SearchQuery): string {
  const purpose = roundQuery.purpose ? `\n本轮意图：${roundQuery.purpose}` : "";
  return `检索语句：${roundQuery.query}${purpose}`;
}

export function formatSessionHistory(history: RetrieveSessionRound[]): string {
  if (history.length === 0) {
    return "（尚无已完成步骤）";
  }
  return history
    .map((round) => {
      const analysis = round.analysis ? `\n  分析：${round.analysis}` : "";
      const revised = round.planRevised ? "\n  已修订后续检索计划" : "";
      return `- 第${round.step}步：${round.query}${round.purpose ? `（${round.purpose}）` : ""}；召回${round.roundHitCount}条，采纳${round.relevantCount}条${analysis}${revised}`;
    })
    .join("\n");
}

export function formatAccumulatedEvidence(hits: SearchHit[]): string {
  if (hits.length === 0) {
    return "（暂无）";
  }
  return hits
    .map(
      (hit) =>
        `[${hit.pageId}] ${hit.title ?? "无标题"}\ncompiled_truth: ${hit.compiledTruth.slice(0, 600)}\nsummary: ${hit.summary ?? ""}`,
    )
    .join("\n\n");
}

function formatRoundCatalog(hits: SearchHit[]): string {
  if (hits.length === 0) {
    return "（本轮无召回）";
  }
  return hits
    .map(
      (hit) =>
        `- pageId=${hit.pageId}; title=${hit.title ?? "无标题"}; summary=${hit.summary ?? hit.compiledTruth.slice(0, 200)}`,
    )
    .join("\n");
}

/**
 * Unified per-step judge: relevance + sufficiency + optional search plan revision.
 * Session history keeps context coherent across the whole retrieve run.
 */
export async function judgeRound(
  roundHits: SearchHit[],
  accumulated: SearchHit[],
  session: RetrieveJudgeSession,
  options: ModelGatewayOptions = {},
): Promise<JudgeRoundResult> {
  const { system, user } = await loadPrompt("retrieve.judge_round", {
    contextSummary: session.contextSummary || "（未提供）",
    questionRestatement: session.questionRestatement,
    searchPlan: formatSearchPlan(session.activePlan),
    sessionHistory: formatSessionHistory(session.sessionHistory),
    roundIndex: String(session.planIndex + 1),
    roundQuery: formatRoundQuery(session.roundQuery),
    roundCatalog: formatRoundCatalog(roundHits),
    accumulatedEvidence: formatAccumulatedEvidence(accumulated),
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
  return parseJudgeRoundResult(extractJson(contentToText(assistant.content)), roundHits);
}

/** @deprecated Use judgeRound; kept for tests that mock the old two-step flow. */
export type RetrieveJudgeContext = {
  question: string;
  searchQueries: SearchQuery[];
  roundIndex: number;
  roundQuery: SearchQuery;
  contextSummary?: string;
  questionRestatement?: string;
};

export async function judgeRelevance(
  hits: SearchHit[],
  ctx: RetrieveJudgeContext,
  options: ModelGatewayOptions = {},
): Promise<SearchHit[]> {
  if (hits.length === 0) return [];

  const catalog = formatRoundCatalog(hits);
  const question = ctx.questionRestatement ?? ctx.question;

  const { system, user } = await loadPrompt("retrieve.judge_relevance", {
    question,
    searchPlan: formatSearchPlan(ctx.searchQueries),
    roundQuery: formatRoundQuery(ctx.roundQuery),
    roundIndex: String(ctx.roundIndex + 1),
    catalog,
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
  const relevantIds = new Set(parseJudgedPageIds(extractJson(contentToText(assistant.content))));
  return hits.filter((hit) => relevantIds.has(hit.pageId));
}

export async function judgeSufficiency(
  hits: SearchHit[],
  ctx: RetrieveJudgeContext,
  options: ModelGatewayOptions = {},
): Promise<{ sufficient: boolean; reason: string }> {
  if (hits.length === 0) {
    return { sufficient: false, reason: "no relevant hits accumulated" };
  }

  const question = ctx.questionRestatement ?? ctx.question;

  const { system, user } = await loadPrompt("retrieve.judge_sufficiency", {
    question,
    searchPlan: formatSearchPlan(ctx.searchQueries),
    roundIndex: String(ctx.roundIndex + 1),
    roundQuery: formatRoundQuery(ctx.roundQuery),
    evidence: formatAccumulatedEvidence(hits),
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
  return parseSufficiencyResult(extractJson(contentToText(assistant.content)));
}

/** @deprecated Prefer judgeRound. */
export async function judgeAfterRound(
  roundHits: SearchHit[],
  accumulated: SearchHit[],
  ctx: RetrieveJudgeContext,
  options: ModelGatewayOptions = {},
): Promise<JudgeRoundResult> {
  const relevantHits = await judgeRelevance(roundHits, ctx, options);
  const merged = [...accumulated];
  mergeHitsInPlace(merged, relevantHits);
  const sufficiency = await judgeSufficiency(merged, ctx, options);
  return {
    relevantHits,
    sufficient: sufficiency.sufficient,
    reason: sufficiency.reason,
  };
}

function mergeHitsInPlace(target: SearchHit[], incoming: SearchHit[]): void {
  const seen = new Set(target.map((hit) => hit.pageId));
  for (const hit of incoming) {
    if (seen.has(hit.pageId)) continue;
    seen.add(hit.pageId);
    target.push(hit);
  }
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  if (arrayStart >= 0 && (start < 0 || arrayStart < start)) {
    const end = text.lastIndexOf("]");
    if (end > arrayStart) return text.slice(arrayStart, end + 1);
  }
  if (start >= 0) {
    const end = text.lastIndexOf("}");
    if (end > start) return text.slice(start, end + 1);
  }
  return text;
}
