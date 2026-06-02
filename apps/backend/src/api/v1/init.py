from fastapi import APIRouter, Depends

from src.api.deps import get_init_tags_handler
from src.api.schemas.ingest import InitTagsRequest, InitTagsResponse
from src.application.init.commands import InitTagsCommand
from src.application.init.handlers import InitTagsHandler

router = APIRouter(prefix="/init", tags=["init"])


@router.post("/tags", response_model=InitTagsResponse)
async def init_tags(
    request: InitTagsRequest,
    handler: InitTagsHandler = Depends(get_init_tags_handler),
) -> InitTagsResponse:
    result = await handler.handle(
        InitTagsCommand(
            domain=request.domain,
            description=request.description,
            language=request.language,
        )
    )
    total_leaves = sum(len(category.leaves) for category in result.categories)
    return InitTagsResponse(
        domain=result.domain,
        categories=len(result.categories),
        leaves=total_leaves,
    )
