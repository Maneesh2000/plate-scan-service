"""Pydantic schemas for request/response validation."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_slug: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: Optional[str] = None
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

class ScanCreate(BaseModel):
    """Payload sent by the camera webhook."""

    camera_id: str = Field(..., examples=["cam_1001"])
    plate: Optional[str] = Field(None, examples=["7XYZ123"])
    vin: str = Field(..., examples=["1FTFW1E51NFA12345"])
    latitude: Optional[float] = Field(None, examples=[33.7490])
    longitude: Optional[float] = Field(None, examples=[-84.3880])
    scanned_at: datetime = Field(..., examples=["2026-09-01T14:32:00Z"])
    image_url: Optional[str] = Field(
        None, examples=["https://example.com/scans/img_88213.jpg"]
    )


class ScanResponse(BaseModel):
    """Scan record returned to the client."""

    id: uuid.UUID
    camera_id: str
    plate: Optional[str] = None
    vin: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    scanned_at: datetime
    image_url: Optional[str] = None
    case_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanIngestResponse(BaseModel):
    """Response after ingesting a scan — includes the scan plus any case info."""

    scan: ScanResponse
    case_id: Optional[uuid.UUID] = None
    flow: str = Field(
        ...,
        description="Which flow was triggered: 'existing_case', 'new_case', or 'no_match'",
    )
    message: str


# ---------------------------------------------------------------------------
# Case
# ---------------------------------------------------------------------------

class CaseResponse(BaseModel):
    """Case record returned to the client."""

    id: uuid.UUID
    vin: str
    status: str
    originating_tenant_id: uuid.UUID
    claimed_tenant_id: Optional[uuid.UUID] = None
    assigned_agent_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CaseClaimResponse(BaseModel):
    """Response after claiming a case."""

    case: CaseResponse
    message: str


class CaseListResponse(BaseModel):
    """Paginated list of cases."""

    cases: list[CaseResponse]
    total: int
    page: int = 1
    page_size: int = 10
    total_pages: int = 1


# ---------------------------------------------------------------------------
# Mock partner / eligibility
# ---------------------------------------------------------------------------

class EligibilityRequest(BaseModel):
    vin: str


class EligibilityResponse(BaseModel):
    vin: str
    still_eligible_for_repo: bool

