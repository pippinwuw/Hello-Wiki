import { test } from "node:test";
import assert from "node:assert/strict";

import { runRetrieveSubAgent } from "../src/retrieve/sub-agent-loop.js";
import type { SearchHit, SearchQuery } from "../src/retrieve/schemas.js";
import type { SearchClient } from "../src/retrieve/search-client.js";

const baseRequest = {
  question: "辅修选课流程是什么？",
  contextSummary: "用户在咨询教务处学籍与选课政策。",
  questionRestatement: "用户想了解辅修专业的选课流程与申请条件。",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  topK: 5,
};

const sampleQueries: SearchQuery[] = [
  {
    query: "2025年线上商城用户投诉的主要问题类型有哪些？",
    targetTags: [],
    purpose: "检索投诉分类统计",
  },
  {
    query: "客服团队针对用户投诉制定或执行了哪些改进措施？",
    targetTags: [],
  },
];

test("retrieve sub-agent stops early when sufficiency is reached", async () => {
  let searchCalls = 0;
  const searchClient: SearchClient = {
    async search() {
      searchCalls += 1;
      return {
        hits: [
          {
            pageId: "page-1",
            score: 0.9,
            title: "辅修说明",
            compiledTruth: "truth",
            summary: "summary",
            originalText: "original text about minor selection",
            tagPaths: [],
          },
        ],
        degraded: [],
      };
    },
  };

  const result = await runRetrieveSubAgent(
    {
      ...baseRequest,
      searchQueries: [sampleQueries[0]!],
      maxIterations: 4,
    },
    {
      judgeRoundFn: async (_roundHits, _accumulated) => ({
        relevantHits: [
          {
            pageId: "page-1",
            score: 0.9,
            title: "辅修说明",
            compiledTruth: "truth",
            summary: "summary",
            originalText: "original",
            tagPaths: [],
          },
        ] as SearchHit[],
        sufficient: true,
        reason: "enough",
      }),
      searchClient,
      completeFn: async () => ({
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              answerGuidance: "可以直接回答",
              excerpts: [
                {
                  pageId: "page-1",
                  title: "辅修说明",
                  compiledTruth: "truth",
                  originalText: "original",
                  summary: "summary",
                  relevance: "直接相关",
                },
              ],
            }),
          },
        ],
        api: "openai-responses",
        provider: "openai",
        model: "mock",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      }),
    },
  );

  assert.equal(result.sufficient, true);
  assert.equal(result.iterations, 1);
  assert.equal(searchCalls, 1);
  assert.equal(result.excerpts.length, 1);
  assert.equal(result.sessionRounds.length, 1);
});

test("retrieve sub-agent runs one search per plan item when not sufficient", async () => {
  let searchCalls = 0;
  const searchClient: SearchClient = {
    async search() {
      searchCalls += 1;
      return {
        hits: [
          {
            pageId: "page-1",
            score: 0.1,
            title: "无关",
            compiledTruth: "truth",
            summary: "summary",
            originalText: "other",
            tagPaths: [],
          },
        ],
        degraded: [],
      };
    },
  };

  const result = await runRetrieveSubAgent(
    {
      ...baseRequest,
      question: "数学建模课程通知",
      questionRestatement: "用户想了解数学建模课程的开课与选课安排。",
      searchQueries: [
        { query: "数学建模课程开课通知", targetTags: [] },
        { query: "数学建模课程选课要求", targetTags: [] },
      ],
      maxIterations: 4,
      topK: 3,
    },
    {
      judgeRoundFn: async () => ({
        relevantHits: [] as SearchHit[],
        sufficient: false,
        reason: "no hits",
      }),
      searchClient,
      completeFn: async () => ({
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify({ answerGuidance: "未找到", excerpts: [] }) }],
        api: "openai-responses",
        provider: "openai",
        model: "mock",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      }),
    },
  );

  assert.equal(result.sufficient, false);
  assert.equal(result.iterations, 2);
  assert.equal(searchCalls, 2);
});

test("retrieve sub-agent applies judge-revised search plan", async () => {
  const queries: string[] = [];
  const searchClient: SearchClient = {
    async search(searchQuery) {
      queries.push(searchQuery.query);
      return {
        hits: [
          {
            pageId: `page-${queries.length}`,
            score: 0.5,
            title: "doc",
            compiledTruth: "truth",
            summary: "s",
            originalText: "text",
            tagPaths: [],
          },
        ],
        degraded: [],
      };
    },
  };

  let judgeCalls = 0;
  const result = await runRetrieveSubAgent(
    {
      ...baseRequest,
      searchQueries: [{ query: "模糊措辞的检索", targetTags: [] }],
      maxIterations: 6,
    },
    {
      judgeRoundFn: async () => {
        judgeCalls += 1;
        if (judgeCalls === 1) {
          return {
            relevantHits: [] as SearchHit[],
            sufficient: false,
            reason: "wording mismatch",
            analysis: "应使用教务系统常用表述",
            revisedSearchQueries: [
              { query: "辅修专业选课申请流程与条件", targetTags: [] },
              { query: "辅修学籍注册办理步骤", targetTags: [] },
            ],
          };
        }
        return {
          relevantHits: [
            {
              pageId: "page-2",
              score: 0.9,
              title: "辅修",
              compiledTruth: "truth",
              summary: "s",
              originalText: "o",
              tagPaths: [],
            },
          ] as SearchHit[],
          sufficient: true,
          reason: "ok",
        };
      },
      searchClient,
      completeFn: async () => ({
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({ answerGuidance: "完成", excerpts: [] }),
          },
        ],
        api: "openai-responses",
        provider: "openai",
        model: "mock",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      }),
    },
  );

  assert.equal(result.sufficient, true);
  assert.equal(queries[0], "模糊措辞的检索");
  assert.equal(queries[1], "辅修专业选课申请流程与条件");
  assert.equal(result.searchQueries.length, 2);
  assert.equal(result.sessionRounds[0]?.planRevised, true);
});
