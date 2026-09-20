"""Seed data script.

Creates two tenants with cameras, users, and seed cases/scans per the
case study specification. Idempotent — skips seeding if tenants already exist.

Run directly:  python -m app.seed
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Camera, Case, Scan, Tenant, User


# Fixed UUIDs for reproducible seed data
TENANT_A_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")
TENANT_B_ID = uuid.UUID("b0000000-0000-0000-0000-000000000002")
USER_ALICE_ID = uuid.UUID("aa000000-0000-0000-0000-000000000001")
USER_BOB_ID = uuid.UUID("aa000000-0000-0000-0000-000000000002")
USER_ADMIN_A_ID = uuid.UUID("aa000000-0000-0000-0000-000000000003")
CASE_A_ID = uuid.UUID("cc000000-0000-0000-0000-000000000001")

VIN_A = "1FTFW1E51NFA12345"
VIN_B = "5NPE34AF9KH123456"

DEFAULT_PASSWORD = "password123"


def seed(db: Session) -> None:
    """Insert seed data. Skips if Tenant A already exists."""
    existing = db.query(Tenant).filter(Tenant.id == TENANT_A_ID).first()
    if existing:
        print("Seed data already exists — skipping.")
        return

    print("Seeding database...")

    # ── Tenants ──────────────────────────────────────────────────────────
    tenant_a = Tenant(
        id=TENANT_A_ID,
        name="Alpha Recovery",
        slug="alpha",
        logo_url="/logos/alpha.svg",
    )
    tenant_b = Tenant(
        id=TENANT_B_ID,
        name="Beta Recovery",
        slug="beta",
        logo_url="/logos/beta.svg",
    )
    db.add_all([tenant_a, tenant_b])

    # ── Users ────────────────────────────────────────────────────────────
    hashed_pw = hash_password(DEFAULT_PASSWORD)
    alice = User(
        id=USER_ALICE_ID,
        tenant_id=TENANT_A_ID,
        username="alice",
        password_hash=hashed_pw,
        role="staff",
    )
    bob = User(
        id=USER_BOB_ID,
        tenant_id=TENANT_B_ID,
        username="bob",
        password_hash=hashed_pw,
        role="staff",
    )
    admin_a = User(
        id=USER_ADMIN_A_ID,
        tenant_id=TENANT_A_ID,
        username="admin_a",
        password_hash=hashed_pw,
        role="admin",
    )
    db.add_all([alice, bob, admin_a])

    # ── Cameras ──────────────────────────────────────────────────────────
    cam_1001 = Camera(
        id="cam_1001", tenant_id=TENANT_A_ID, label="Truck A-1"
    )
    cam_2050 = Camera(
        id="cam_2050", tenant_id=TENANT_B_ID, label="Truck B-1"
    )
    db.add_all([cam_1001, cam_2050])

    # ── Case for Tenant A (active, for VIN_A) ───────────────────────────
    case_a = Case(
        id=CASE_A_ID,
        vin=VIN_A,
        status="active",
        originating_tenant_id=TENANT_A_ID,
        claimed_tenant_id=TENANT_A_ID,
        assigned_agent_id=USER_ALICE_ID,
    )
    db.add(case_a)

    # ── Historical scans for VIN_A (existing-case flow demo) ─────────────
    scan_locations = [
        {
            "lat": 33.7490,
            "lng": -84.3880,
            "ts": "2026-08-25T09:15:00Z",
            "plate": "7XYZ123",
        },
        {
            "lat": 33.7550,
            "lng": -84.3900,
            "ts": "2026-08-28T14:22:00Z",
            "plate": "7XYZ123",
        },
        {
            "lat": 33.7610,
            "lng": -84.3850,
            "ts": "2026-08-31T11:05:00Z",
            "plate": "7XYZ123",
        },
    ]

    for i, loc in enumerate(scan_locations):
        scan = Scan(
            camera_id="cam_1001",
            plate=loc["plate"],
            vin=VIN_A,
            latitude=loc["lat"],
            longitude=loc["lng"],
            scanned_at=datetime.fromisoformat(loc["ts"]),
            image_url=f"https://example.com/scans/img_seed_{i + 1}.jpg",
            case_id=CASE_A_ID,
        )
        db.add(scan)

    db.commit()
    print("Seed data inserted successfully.")
    print()
    print("  Tenants:")
    print(f"    Alpha Recovery  (id={TENANT_A_ID})")
    print(f"    Beta Recovery   (id={TENANT_B_ID})")
    print()
    print("  Users (password: password123):")
    print(f"    alice   (Tenant A, staff)   id={USER_ALICE_ID}")
    print(f"    bob     (Tenant B, staff)   id={USER_BOB_ID}")
    print(f"    admin_a (Tenant A, admin)   id={USER_ADMIN_A_ID}")
    print()
    print("  Cameras:")
    print(f"    cam_1001 → Tenant A")
    print(f"    cam_2050 → Tenant B")
    print()
    print(f"  Active case for VIN {VIN_A} (Tenant A) with 3 historical scans.")
    print(f"  No case for VIN {VIN_B} — use cam_2050 to trigger new-case flow.")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()

