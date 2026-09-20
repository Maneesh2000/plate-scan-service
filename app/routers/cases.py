"""Cases router — claim, list, and location trail endpoints.

All endpoints here are authenticated and tenant-scoped.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Scan, User
from app.schemas import (
    CaseClaimResponse,
    CaseListResponse,
    CaseResponse,
    ScanResponse,
)

router = APIRouter(prefix="/api/v1/cases", tags=["Cases"])


@router.get("", response_model=CaseListResponse)
def list_cases(
    status_filter: Optional[str] = Query(
        None, alias="status", description="Filter by case status"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(
        None, description="Search by VIN (case-insensitive)"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List cases visible to the caller's tenant with pagination and search.

    Returns:
    - All cases belonging to the caller's tenant (any status).
    - All pending_claim cases from any tenant (since any tenant can claim them).
    - Active/closed cases from other tenants are never returned.
    """
    tenant_id = current_user.tenant_id

    query = db.query(Case).filter(
        or_(
            Case.status == "pending_claim",
            Case.claimed_tenant_id == tenant_id,
            and_(
                Case.originating_tenant_id == tenant_id,
                Case.claimed_tenant_id.is_(None),
            ),
        )
    )

    if status_filter:
        query = query.filter(Case.status == status_filter)

    if search:
        query = query.filter(Case.vin.ilike(f"%{search.strip()}%"))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    cases = (
        query.order_by(Case.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return CaseListResponse(
        cases=[CaseResponse.model_validate(c) for c in cases],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/{case_id}/claim",
    response_model=CaseClaimResponse,
)
def claim_case(
    case_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Claim a pending_claim case.

    Any authenticated staff user, from any tenant, can claim a pending_claim
    case. This is the one deliberate exception to tenant isolation.

    Claiming:
    - Assigns the case to the claiming user's tenant.
    - Assigns the claiming user as the agent.
    - Moves the case to 'active' status.

    Fails with 409 if the case is not in pending_claim status.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    if case.status != "pending_claim":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Case cannot be claimed — current status is '{case.status}'. "
            f"Only 'pending_claim' cases can be claimed.",
        )

    case.status = "active"
    case.claimed_tenant_id = current_user.tenant_id
    case.assigned_agent_id = current_user.id

    db.commit()
    db.refresh(case)

    return CaseClaimResponse(
        case=CaseResponse.model_validate(case),
        message=f"Case {case.id} claimed successfully by user {current_user.username}",
    )


@router.get("/{case_id}/scans", response_model=list[ScanResponse])
def get_case_scans(
    case_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the location trail — every scan on record for the case's VIN.

    Scans are ordered by scanned_at (ascending) to show the chronological
    trail of sightings.

    Access: user's tenant must own the case, OR the case must be pending_claim.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Access control: tenant must own the case or case must be pending_claim
    tenant_id = current_user.tenant_id
    has_access = (
        case.status == "pending_claim"
        or case.originating_tenant_id == tenant_id
        or case.claimed_tenant_id == tenant_id
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this case",
        )

    # Return ALL scans for this VIN (not just this case), ordered by time
    scans = (
        db.query(Scan)
        .filter(Scan.vin == case.vin)
        .order_by(Scan.scanned_at.asc())
        .all()
    )

    return [ScanResponse.model_validate(s) for s in scans]

