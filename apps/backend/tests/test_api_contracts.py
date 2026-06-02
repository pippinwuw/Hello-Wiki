from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api import deps
from src.api.v1.chat import router as chat_router
from src.api.v1.ingest import router as ingest_router
from src.api.v1.init import router as init_router
from src.api.v1.retrieve import router as retrieve_router
from src.application.ingest.commands import IngestDocumentCommand
from src.application.init.init_tags import Category, LeafTag, TagTreeSchema
from src.domain.knowledge.retrieve_vo import SearchHit


def _build_test_client() -> TestClient:
    app = FastAPI()
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(ingest_router, prefix="/api/v1")
    app.include_router(init_router, prefix="/api/v1")
    app.include_router(retrieve_router, prefix="/api/v1")
    return TestClient(app)


def test_chat_ask_requires_workspace_id() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/chat/ask",
        json={"question": "hello", "top_k": 3},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "workspace_id is required"


def test_chat_ask_returns_not_implemented() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/chat/ask",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000101"},
        json={"question": "hello", "top_k": 3},
    )

    assert response.status_code == 501
    assert response.json()["detail"] == "chat ask endpoint is not implemented yet"


def test_chat_stream_returns_event_stream() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/chat/stream",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000102"},
        json={"question": "hello", "top_k": 3},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: start" in response.text
    assert "event: end" in response.text


def test_ingest_compile_requires_workspace_id() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/ingest/compile",
        json={
            "source_document_id": "doc-1",
            "title": "Doc",
            "markdown_content": "content",
            "category": "general",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "workspace_id is required"


def test_ingest_compile_returns_not_implemented() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/ingest/compile",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000103"},
        json={
            "source_document_id": "doc-1",
            "title": "Doc",
            "markdown_content": "content",
            "category": "general",
        },
    )

    assert response.status_code == 501
    assert response.json()["detail"] == "ingest compile endpoint is not implemented yet"


def test_ingest_upload_rejects_unsupported_extension() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/ingest/upload",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
        files={
            "file": (
                "legacy.doc",
                b"fake",
                "application/msword",
            )
        },
        data={"domain": "general"},
    )

    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]
    assert ".docx" in response.json()["detail"]


def test_ingest_upload_queues_document_without_running_pipeline() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/ingest/upload",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
        files={"file": ("policy.txt", b"hello", "text/plain")},
        data={"domain": "general"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending"
    assert payload["filename"] == "policy.txt"
    assert payload["document_id"]

    listed = client.get(
        "/api/v1/ingest/documents",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert any(item["document_id"] == payload["document_id"] for item in items)


def test_ingest_compile_starts_pipeline_for_queued_document(monkeypatch) -> None:
    app = FastAPI()
    captured: dict[str, IngestDocumentCommand] = {}
    scheduled: list[Coroutine[Any, Any, None]] = []

    class FakeIngestHandler:
        async def handle(self, command: IngestDocumentCommand) -> dict[str, object]:
            captured["command"] = command
            return {"total_chunks": 1, "successful": 1, "failed": 0, "results": [], "errors": []}

    def fake_create_task(coro: Coroutine[Any, Any, None]) -> object:
        scheduled.append(coro)
        return object()

    monkeypatch.setattr(asyncio, "create_task", fake_create_task)
    app.dependency_overrides[deps.get_ingest_pipeline_handler] = FakeIngestHandler
    app.include_router(ingest_router, prefix="/api/v1")
    client = TestClient(app)

    upload = client.post(
        "/api/v1/ingest/upload",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
        files={"file": ("policy.txt", b"hello", "text/plain")},
        data={"domain": "general"},
    )
    document_id = upload.json()["document_id"]

    compile_response = client.post(
        f"/api/v1/ingest/documents/{document_id}/compile",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
    )

    assert compile_response.status_code == 200
    assert compile_response.json()["status"] == "compiling"
    assert len(scheduled) == 1
    asyncio.run(scheduled[0])
    assert captured["command"].workspace_id == "00000000-0000-0000-0000-000000000104"


def test_init_tags_returns_counts() -> None:
    app = FastAPI()

    class FakeInitTagsHandler:
        async def handle(self, command: object) -> TagTreeSchema:
            return TagTreeSchema(
                domain="general",
                categories=[
                    Category(
                        name="functional_area",
                        label="功能领域",
                        leaves=[
                            LeafTag(name="registration", label="注册"),
                            LeafTag(name="exam", label="考试"),
                        ],
                    )
                ],
            )

    app.dependency_overrides[deps.get_init_tags_handler] = FakeInitTagsHandler
    app.include_router(init_router, prefix="/api/v1")
    client = TestClient(app)

    response = client.post(
        "/api/v1/init/tags",
        json={"domain": "general", "description": "university policies", "language": "zh"},
    )

    assert response.status_code == 200
    assert response.json() == {"domain": "general", "categories": 1, "leaves": 2}


def test_retrieve_search_requires_workspace_id() -> None:
    client = _build_test_client()

    response = client.post(
        "/api/v1/retrieve/search",
        json={
            "query": {
                "sanitize_query_for_prompt": "辅修选课",
                "target_tags": [],
            },
            "top_k": 5,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "workspace_id is required"


def test_retrieve_search_returns_hits() -> None:
    class FakeSearchHandler:
        async def handle(self, command):  # noqa: ANN001
            assert command.exclude_page_ids == frozenset(
                {UUID("00000000-0000-0000-0000-000000000099")}
            )
            return (
                [
                    SearchHit(
                        page_id=command.workspace_id,
                        score=0.42,
                        title="Test Page",
                        compiled_truth="truth",
                        summary="summary",
                        original_text="original",
                        tag_paths=["functional_area.registration"],
                        score_breakdown={"tag_rank": 1},
                    )
                ],
                ["semantic_disabled_no_embeddings"],
            )

    app = FastAPI()
    app.dependency_overrides[deps.get_search_knowledge_handler] = lambda: FakeSearchHandler()
    app.include_router(retrieve_router, prefix="/api/v1")
    client = TestClient(app)

    response = client.post(
        "/api/v1/retrieve/search",
        headers={"X-Workspace-ID": "00000000-0000-0000-0000-000000000104"},
        json={
            "query": {
                "sanitize_query_for_prompt": "辅修选课",
                "target_tags": ["functional_area.registration"],
            },
            "top_k": 5,
            "exclude_page_ids": ["00000000-0000-0000-0000-000000000099"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["degraded"] == ["semantic_disabled_no_embeddings"]
    assert len(payload["hits"]) == 1
    assert payload["hits"][0]["title"] == "Test Page"
    assert payload["hits"][0]["score_breakdown"]["tag_rank"] == 1
