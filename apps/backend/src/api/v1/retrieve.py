from fastapi import APIRouter, Depends

from src.api.assemblers.retrieve import to_search_knowledge_command, to_search_knowledge_response
from src.api.deps import get_required_workspace_id, get_search_knowledge_handler
from src.api.schemas.retrieve import SearchKnowledgeRequest, SearchKnowledgeResponse
from src.application.retrieve.handlers import SearchKnowledgeHandler

router = APIRouter(prefix="/retrieve", tags=["retrieve"])


@router.post("/search", response_model=SearchKnowledgeResponse)
async def search_knowledge(
    request: SearchKnowledgeRequest,
    workspace_id=Depends(get_required_workspace_id),
    handler: SearchKnowledgeHandler = Depends(get_search_knowledge_handler),
) -> SearchKnowledgeResponse:
    hits, degraded = await handler.handle(
        to_search_knowledge_command(request, workspace_id)
    )
    return to_search_knowledge_response(hits, degraded)
