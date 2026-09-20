"""Mock partner-network eligibility endpoint.

Simulates an external service that checks whether a VIN is still
eligible for repossession. Simple stub: VINs whose last digit is odd
return True; even returns False. This gives deterministic test coverage
of both branches.
"""

from fastapi import APIRouter

from app.schemas import EligibilityRequest, EligibilityResponse

router = APIRouter(prefix="/mock/partner-network", tags=["Mock Partner"])


@router.post("/eligibility", response_model=EligibilityResponse)
def check_eligibility(payload: EligibilityRequest):
    """Mock eligibility check.

    Rule: if the last character of the VIN is a digit and it's odd → eligible.
    Otherwise → eligible (default true to match spec "always return true" default).
    For testing the false branch, use a VIN ending in '0', '2', '4', '6', or '8'.
    """
    last_char = payload.vin[-1] if payload.vin else "1"
    if last_char.isdigit():
        eligible = int(last_char) % 2 != 0  # odd → True
    else:
        eligible = True  # non-digit last char → default eligible

    return EligibilityResponse(
        vin=payload.vin,
        still_eligible_for_repo=eligible,
    )

