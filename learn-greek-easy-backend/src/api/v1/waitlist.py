"""Waitlist API endpoints for landing page email signup flow.

Both endpoints are public (no authentication required).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from src.core.logging import get_logger
from src.services.waitlist_service import WaitlistAPIError, WaitlistDuplicateError, WaitlistService

logger = get_logger(__name__)

router = APIRouter()


class WaitlistSubscribeRequest(BaseModel):
    email: EmailStr


class WaitlistSubscribeResponse(BaseModel):
    message: str


class WaitlistConfirmRequest(BaseModel):
    token: str


@router.post(
    "/subscribe",
    response_model=WaitlistSubscribeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe to waitlist",
    description="Submit email to join the Greeklish waitlist. Sends a double opt-in confirmation email.",
    responses={
        201: {"description": "Confirmation email sent"},
        409: {"description": "Email already registered"},
        502: {"description": "Failed to process signup"},
    },
)
async def subscribe(body: WaitlistSubscribeRequest) -> WaitlistSubscribeResponse:
    """Create a Resend contact and send confirmation email."""
    service = WaitlistService()
    try:
        result = await service.subscribe(str(body.email))
        return WaitlistSubscribeResponse(message=result["message"])
    except WaitlistDuplicateError:
        raise HTTPException(status_code=409, detail="Email already registered")
    except WaitlistAPIError:
        raise HTTPException(status_code=502, detail="Failed to process signup")


@router.post(
    "/confirm",
    summary="Confirm waitlist signup",
    description="Verify confirmation token and mark contact as subscribed.",
    status_code=status.HTTP_200_OK,
)
async def confirm(body: WaitlistConfirmRequest) -> dict[str, str]:
    """Verify token and activate subscription."""
    service = WaitlistService()
    success = await service.confirm(body.token)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired confirmation token",
        )
    return {"message": "Email confirmed"}
