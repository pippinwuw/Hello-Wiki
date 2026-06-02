import {
  parseSearchResponse,
  type SearchQuery,
  type SearchHit,
  type SearchResponse,
} from "./schemas.js";

export type SearchClientOptions = {
  pythonApiBaseUrl?: string;
  workspaceId?: string;
  fetchFn?: typeof fetch;
};

const DEFAULT_PYTHON_API_BASE_URL = "http://127.0.0.1:8000";

export type SearchClient = {
  search: (
    query: SearchQuery,
    topK: number,
    excludePageIds?: string[],
  ) => Promise<SearchResponse>;
};

/** Slow path: four-way RRF search via Python backend (embeds query text per statement). */
export function createSearchClient(options: SearchClientOptions = {}): SearchClient {
  const pythonApiBaseUrl =
    options.pythonApiBaseUrl ??
    process.env.AGENT_AI_PYTHON_API_BASE_URL ??
    process.env.RETRIEVE_AI_PYTHON_API_BASE_URL ??
    DEFAULT_PYTHON_API_BASE_URL;
  const workspaceId = options.workspaceId ?? "default";
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async search(
      searchQuery: SearchQuery,
      topK: number,
      excludePageIds: string[] = [],
    ): Promise<SearchResponse> {
      const response = await fetchFn(`${pythonApiBaseUrl}/api/v1/retrieve/search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          query: {
            sanitize_query_for_prompt: searchQuery.query,
            target_tags: searchQuery.targetTags,
            time_range: searchQuery.timeRange
              ? {
                  start: searchQuery.timeRange.start ?? null,
                  end: searchQuery.timeRange.end ?? null,
                }
              : null,
          },
          top_k: topK,
          exclude_page_ids: excludePageIds,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`retrieve search failed: ${response.status} ${body}`);
      }

      return parseSearchResponse(await response.json());
    },
  };
}

export type { SearchHit };
