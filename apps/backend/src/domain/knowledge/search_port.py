from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.domain.knowledge.retrieve_vo import ScoredRow, SearchHit


class KnowledgeSearchPort(ABC):
    @abstractmethod
    async def search_by_tags(self, target_tags: list[str], limit: int) -> list[ScoredRow]: ...

    @abstractmethod
    async def search_by_vector_pages(
        self, embedding: list[float], limit: int
    ) -> list[ScoredRow]: ...

    @abstractmethod
    async def search_by_vector_chunks(
        self, embedding: list[float], limit: int
    ) -> list[ScoredRow]: ...

    @abstractmethod
    async def search_by_fulltext(self, query: str, limit: int) -> list[ScoredRow]: ...

    @abstractmethod
    async def search_by_time_range(
        self,
        start: datetime | None,
        end: datetime | None,
        limit: int,
    ) -> list[ScoredRow]: ...

    @abstractmethod
    async def fetch_hits_by_page_ids(self, page_ids: list[UUID]) -> list[SearchHit]: ...

    @abstractmethod
    async def has_any_embeddings(self) -> bool: ...

    @abstractmethod
    async def update_page_embedding(self, page_id: UUID, embedding: list[float]) -> None: ...

    @abstractmethod
    async def update_chunk_embedding(self, chunk_id: UUID, embedding: list[float]) -> None: ...
