export type TimeRange = {
  start?: string;
  end?: string;
};

/** One decomposed statement for semantic / vector search (from main Agent tool params). */
export type SearchQuery = {
  query: string;
  targetTags: string[];
  timeRange?: TimeRange;
  /** Why this statement was split out; helps the retrieve judge sub-agent. */
  purpose?: string;
};

export type RetrieveRequest = {
  /** Legacy / shorthand; prefer questionRestatement for judge and answer. */
  question: string;
  /** Brief summary of conversational context relevant to this retrieval. */
  contextSummary: string;
  /** Precise restatement of what the user wants to know (not a raw copy-paste if ambiguous). */
  questionRestatement: string;
  workspaceId: string;
  /** Decomposed retrieval statements; each is embedded and searched separately in Python. */
  searchQueries: SearchQuery[];
  /** Max search+judge steps (including plan revisions). Default 12. */
  maxIterations?: number;
  topK?: number;
};

/** One step in the retrieve judge session (for coherent multi-round context). */
export type RetrieveSessionRound = {
  step: number;
  query: string;
  purpose?: string;
  roundHitCount: number;
  relevantCount: number;
  analysis?: string;
  planRevised: boolean;
};

export type JudgeRoundResult = {
  relevantHits: SearchHit[];
  sufficient: boolean;
  reason: string;
  analysis?: string;
  /** When set, replaces the remaining search plan from the next step onward. */
  revisedSearchQueries?: SearchQuery[];
};

export type RetrieveExcerpt = {
  pageId: string;
  title: string;
  compiledTruth: string;
  originalText: string;
  summary: string;
  relevance: string;
};

export type RetrieveResponse = {
  sufficient: boolean;
  iterations: number;
  answerGuidance: string;
  excerpts: RetrieveExcerpt[];
  /** Final search plan after any judge revisions. */
  searchQueries: SearchQuery[];
  sessionRounds: RetrieveSessionRound[];
};

export type SearchHit = {
  pageId: string;
  score: number;
  title: string | null;
  compiledTruth: string;
  summary: string | null;
  originalText: string;
  tagPaths: string[];
};

export type SearchResponse = {
  hits: SearchHit[];
  degraded: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid retrieve request: ${field} must be a string`);
  }
  if (!allowEmpty && value.trim() === "") {
    throw new Error(`Invalid retrieve request: ${field} must not be empty`);
  }
  return value;
}

export function parseSearchQueries(value: unknown): SearchQuery[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Invalid retrieve request: searchQueries must be a non-empty array");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`searchQueries[${index}] must be an object`);
    }

    const legacyQuery =
      typeof item.query === "string"
        ? item.query
        : typeof item.sanitizeQueryForPrompt === "string"
          ? item.sanitizeQueryForPrompt
          : undefined;

    const timeRange = isRecord(item.timeRange)
      ? {
          start: typeof item.timeRange.start === "string" ? item.timeRange.start : undefined,
          end: typeof item.timeRange.end === "string" ? item.timeRange.end : undefined,
        }
      : undefined;

    return {
      query: requireString(legacyQuery, `searchQueries[${index}].query`, false),
      targetTags: Array.isArray(item.targetTags)
        ? item.targetTags.filter((tag): tag is string => typeof tag === "string")
        : [],
      timeRange,
      purpose:
        typeof item.purpose === "string" && item.purpose.trim()
          ? item.purpose.trim()
          : undefined,
    };
  });
}

export function parseRetrieveRequest(value: unknown): RetrieveRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid retrieve request: expected JSON object");
  }

  const rawQueries = value.searchQueries ?? value.queryTemplates;
  const searchQueries = parseSearchQueries(rawQueries);

  const questionRaw = requireString(value.question, "question", false);
  const questionRestatement =
    typeof value.questionRestatement === "string" && value.questionRestatement.trim()
      ? value.questionRestatement.trim()
      : questionRaw;
  const contextSummary =
    typeof value.contextSummary === "string" ? value.contextSummary.trim() : "";

  const maxIterations =
    typeof value.maxIterations === "number" && Number.isFinite(value.maxIterations)
      ? Math.max(1, Math.min(12, Math.trunc(value.maxIterations)))
      : 12;

  return {
    question: questionRaw,
    contextSummary,
    questionRestatement,
    workspaceId: requireString(value.workspaceId ?? "default", "workspaceId", false),
    searchQueries,
    maxIterations,
    topK:
      typeof value.topK === "number" && Number.isFinite(value.topK)
        ? Math.max(1, Math.min(50, Math.trunc(value.topK)))
        : 10,
  };
}

export function parseSearchResponse(value: unknown): SearchResponse {
  if (!isRecord(value) || !Array.isArray(value.hits)) {
    throw new Error("Invalid search response from Python API");
  }

  const hits = value.hits.map((item, index): SearchHit => {
    if (!isRecord(item)) {
      throw new Error(`search hits[${index}] must be an object`);
    }
    return {
      pageId: requireString(item.page_id ?? item.pageId, `hits[${index}].page_id`, false),
      score: typeof item.score === "number" ? item.score : 0,
      title: typeof item.title === "string" ? item.title : null,
      compiledTruth: requireString(
        item.compiled_truth ?? item.compiledTruth,
        `hits[${index}].compiled_truth`,
        true,
      ),
      summary: typeof item.summary === "string" ? item.summary : null,
      originalText: requireString(
        item.original_text ?? item.originalText,
        `hits[${index}].original_text`,
        true,
      ),
      tagPaths: (() => {
        const rawTags = item.tag_paths ?? item.tagPaths;
        return Array.isArray(rawTags)
          ? rawTags.filter((tag: unknown): tag is string => typeof tag === "string")
          : [];
      })(),
    };
  });

  const degraded = Array.isArray(value.degraded)
    ? value.degraded.filter((item): item is string => typeof item === "string")
    : [];

  return { hits, degraded };
}

export function parseJudgedPageIds(text: string): string[] {
  const payload = JSON.parse(text) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("judge output must be a JSON array of page ids");
  }
  return payload.filter((item): item is string => typeof item === "string");
}

export function parseJudgeRoundResult(
  text: string,
  roundHits: SearchHit[],
): JudgeRoundResult {
  const payload = JSON.parse(text) as unknown;
  if (!isRecord(payload)) {
    throw new Error("judge round output must be a JSON object");
  }

  const relevantIds = new Set(
    Array.isArray(payload.relevantPageIds)
      ? payload.relevantPageIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  const relevantHits = roundHits.filter((hit) => relevantIds.has(hit.pageId));

  let revisedSearchQueries: SearchQuery[] | undefined;
  if (Array.isArray(payload.revisedSearchQueries) && payload.revisedSearchQueries.length > 0) {
    revisedSearchQueries = parseSearchQueries(payload.revisedSearchQueries);
  }

  return {
    relevantHits,
    sufficient: payload.sufficient === true,
    reason: typeof payload.reason === "string" ? payload.reason : "",
    analysis: typeof payload.analysis === "string" ? payload.analysis : undefined,
    revisedSearchQueries,
  };
}

export function parseSufficiencyResult(text: string): { sufficient: boolean; reason: string } {
  const payload = JSON.parse(text) as unknown;
  if (!isRecord(payload)) {
    throw new Error("sufficiency output must be a JSON object");
  }
  return {
    sufficient: payload.sufficient === true,
    reason: typeof payload.reason === "string" ? payload.reason : "",
  };
}

export function parseAnswerGuidance(text: string): { answerGuidance: string; excerpts: RetrieveExcerpt[] } {
  const payload = JSON.parse(text) as unknown;
  if (!isRecord(payload)) {
    throw new Error("answer output must be a JSON object");
  }

  const excerpts = Array.isArray(payload.excerpts)
    ? payload.excerpts.map((item, index): RetrieveExcerpt => {
        if (!isRecord(item)) {
          throw new Error(`excerpts[${index}] must be an object`);
        }
        return {
          pageId: requireString(item.pageId ?? item.page_id, `excerpts[${index}].pageId`, false),
          title: requireString(item.title, `excerpts[${index}].title`, true),
          compiledTruth: requireString(
            item.compiledTruth ?? item.compiled_truth,
            `excerpts[${index}].compiledTruth`,
            true,
          ),
          originalText: requireString(
            item.originalText ?? item.original_text,
            `excerpts[${index}].originalText`,
            true,
          ),
          summary: requireString(item.summary, `excerpts[${index}].summary`, true),
          relevance: requireString(item.relevance, `excerpts[${index}].relevance`, true),
        };
      })
    : [];

  return {
    answerGuidance: requireString(payload.answerGuidance, "answerGuidance", true),
    excerpts,
  };
}
