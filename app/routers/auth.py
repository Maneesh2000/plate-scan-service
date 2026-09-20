"""Authentication and Tenant Resolution router."""

from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import verify_password, create_access_token
from app.database import get_db
from app.models import Tenant, User
from app.schemas import LoginRequest, TenantResponse, TokenResponse

router = APIRouter(prefix="/api/v1", tags=["Auth & Tenants"])


@router.get("/tenants/resolve/{slug}", response_model=TenantResponse)
def resolve_tenant(slug: str, db: Session = Depends(get_db)):
    """Resolve an agency's public metadata by subdomain slug."""
    clean_slug = slug.strip().lower()
    tenant = db.query(Tenant).filter(Tenant.slug == clean_slug).first()
    if not tenant:
        # Fallback: check if name starts with slug
        tenant = db.query(Tenant).filter(Tenant.name.ilike(f"{clean_slug}%")).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agency portal '{clean_slug}' not found",
        )
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug or clean_slug,
        logo_url=tenant.logo_url or f"/logos/{clean_slug}.svg",
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    x_tenant_slug: Optional[str] = Header(None, alias="X-Tenant-Slug"),
    db: Session = Depends(get_db),
):
    """Authenticate with username/password and receive a JWT.

    If X-Tenant-Slug header or payload.tenant_slug is present, enforce that
    the user belongs specifically to that agency's tenant.
    """
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Subdomain tenant validation
    required_slug = (x_tenant_slug or payload.tenant_slug or "").strip().lower()
    if required_slug:
        tenant = db.query(Tenant).filter(Tenant.slug == required_slug).first()
        if not tenant:
            tenant = db.query(Tenant).filter(Tenant.name.ilike(f"{required_slug}%")).first()

        if tenant and user.tenant_id != tenant.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: User '{user.username}' is not a registered agent of {tenant.name}.",
            )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "role": user.role,
        }
    )
    return TokenResponse(access_token=access_token)
