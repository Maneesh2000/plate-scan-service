"""Scan ingestion router.

POST /api/v1/scans — unauthenticated endpoint simulating a camera webhook.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Camera, Case, Scan
from app.schemas import ScanCreate, ScanIngestResponse, ScanResponse

router = APIRouter(prefix="/api/v1/scans", tags=["Scans"])


def _check_eligibility(vin: str) -> bool:
    """Call eligibility logic directly (same logic as the mock endpoint).

    Rule: VIN ending in odd digit → eligible; even → not eligible;
    non-digit → eligible (default).
    """
    last_char = vin[-1] if vin else "1"
    if last_char.isdigit():
        return int(last_char) % 2 != 0
    return True


@router.post(
    "",
    response_model=ScanIngestResponse,
    status_code=status.HTTP_201_CREATED,
)
def ingest_scan(
    payload: ScanCreate,
    db: Session = Depends(get_db),
):
    """Ingest a scan from a camera webhook.

    Flow:
    1. Resolve the tenant from camera_id.
    2. Store the scan (always, regardless of case match).
    3. Check if the tenant already has an active case for that VIN:
       - Yes → existing-case flow: link scan to the case.
       - No  → new-case flow: call mock eligibility; if eligible, create
         a pending_claim case.
    """
    # 1. Resolve camera → tenant
    camera = db.query(Camera).filter(Camera.id == payload.camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{payload.camera_id}' not found",
        )

    tenant_id = camera.tenant_id

    # 2. Create the scan record (persisted regardless of match)
    scan = Scan(
        camera_id=payload.camera_id,
        plate=payload.plate,
        vin=payload.vin,
        latitude=payload.latitude,
        longitude=payload.longitude,
        scanned_at=payload.scanned_at,
        image_url=payload.image_url,
    )

    # 3. Branch: existing case or new case?
    active_case = (
        db.query(Case)
        .filter(
            Case.vin == payload.vin,
            Case.status == "active",
            Case.claimed_tenant_id == tenant_id,
        )
        .first()
    )

    if active_case:
        # Existing-case flow — link this scan to the case
        scan.case_id = active_case.id
        db.add(scan)
        db.commit()
        db.refresh(scan)

        return ScanIngestResponse(
            scan=ScanResponse.model_validate(scan),
            case_id=active_case.id,
            flow="existing_case",
            message=f"Scan linked to existing active case {active_case.id}",
        )

    # New-case flow — check eligibility
    eligible = _check_eligibility(payload.vin)

    if eligible:
        # Check if there's already a pending_claim case for this VIN
        # from this tenant to avoid duplicates
        existing_pending = (
            db.query(Case)
            .filter(
                Case.vin == payload.vin,
                Case.status == "pending_claim",
                Case.originating_tenant_id == tenant_id,
            )
            .first()
        )

        if existing_pending:
            scan.case_id = existing_pending.id
            db.add(scan)
            db.commit()
            db.refresh(scan)
            return ScanIngestResponse(
                scan=ScanResponse.model_validate(scan),
                case_id=existing_pending.id,
                flow="existing_case",
                message=f"Scan linked to existing pending_claim case {existing_pending.id}",
            )

        # Create a new pending_claim case
        new_case = Case(
            vin=payload.vin,
            status="pending_claim",
            originating_tenant_id=tenant_id,
        )
        db.add(new_case)
        db.flush()  # Get the new case ID

        scan.case_id = new_case.id
        db.add(scan)
        db.commit()
        db.refresh(scan)
        db.refresh(new_case)

        return ScanIngestResponse(
            scan=ScanResponse.model_validate(scan),
            case_id=new_case.id,
            flow="new_case",
            message=f"Vehicle eligible for repo. Created new pending_claim case {new_case.id}",
        )

    # Not eligible — just store the scan
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ScanIngestResponse(
        scan=ScanResponse.model_validate(scan),
        case_id=None,
        flow="no_match",
        message="Vehicle not eligible for repossession. Scan stored.",
    )
