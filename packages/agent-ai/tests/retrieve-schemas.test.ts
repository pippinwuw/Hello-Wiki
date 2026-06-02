import { test } from "node:test";
import assert from "node:assert/strict";

import { parseRetrieveRequest, parseJudgeRoundResult } from "../src/retrieve/schemas.js";
import type { SearchHit } from "../src/retrieve/schemas.js";

test("parseRetrieveRequest requires searchQueries from main Agent", () => {
  assert.throws(
    () =>
      parseRetrieveRequest({
        question: "投诉与改进",
        workspaceId: "ws-1",
      }),
    /searchQueries must be a non-empty array/,
  );
});

test("parseRetrieveRequest accepts context and restatement", () => {
  const request = parseRetrieveRequest({
    question: "去年投诉前三与客服改进？",
    contextSummary: "讨论2025年商城客服",
    questionRestatement: "用户需要2025年投诉TOP3及客服改进措施",
    workspaceId: "ws-1",
    searchQueries: [{ query: "2025年商城投诉排名前三的问题" }],
  });

  assert.equal(request.contextSummary, "讨论2025年商城客服");
  assert.match(request.questionRestatement, /TOP3/);
  assert.equal(request.maxIterations, 12);
});

test("parseRetrieveRequest falls back questionRestatement to question", () => {
  const request = parseRetrieveRequest({
    question: "辅修选课",
    workspaceId: "ws-1",
    searchQueries: [{ query: "辅修选课流程" }],
  });

  assert.equal(request.questionRestatement, "辅修选课");
});

test("parseJudgeRoundResult extracts revision plan", () => {
  const hits: SearchHit[] = [
    {
      pageId: "page-1",
      score: 1,
      title: "t",
      compiledTruth: "c",
      summary: "s",
      originalText: "o",
      tagPaths: [],
    },
  ];

  const result = parseJudgeRoundResult(
    JSON.stringify({
      relevantPageIds: ["page-1"],
      sufficient: false,
      reason: "need better queries",
      revisedSearchQueries: [{ query: "优化后的陈述句", purpose: "更贴近文档" }],
    }),
    hits,
  );

  assert.equal(result.relevantHits.length, 1);
  assert.equal(result.revisedSearchQueries?.length, 1);
  assert.match(result.revisedSearchQueries![0]!.query, /优化后/);
});
