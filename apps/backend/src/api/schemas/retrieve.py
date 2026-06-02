from datetime import datetime

from pydantic import BaseModel, Field


class TimeRangeRequest(BaseModel):
    start: datetime | None = None
    end: datetime | None = None


class QueryTemplateRequest(BaseModel):
    sanitize_query_for_prompt: str = Field(min_length=1)
    target_tags: list[str] = Field(default_factory=list)
    time_range: TimeRangeRequest | None = None


class SearchKnowledgeRequest(BaseModel):
    query: QueryTemplateRequest
    top_k: int = Field(default=10, ge=1, le=50)
    exclude_page_ids: list[str] = Field(default_factory=list, max_length=200)


class ScoreBreakdownResponse(BaseModel):
    tag_rank: int | None = None
    semantic_rank: int | None = None
    bm25_rank: int | None = None
    time_rank: int | None = None


class SearchHitResponse(BaseModel):
    page_id: str
    score: float
    title: str | None
    compiled_truth: str
    summary: str | None
    original_text: str
    tag_paths: list[str]
    score_breakdown: ScoreBreakdownResponse


class SearchKnowledgeResponse(BaseModel):
    hits: list[SearchHitResponse]
    degraded: list[str] = Field(default_factory=list)
