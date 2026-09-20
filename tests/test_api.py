"""Tests for the Plate Scan & Case Matching Service API.

Uses SQLite in-memory for fast, isolated tests.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password, create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import Camera, Case, Scan, Tenant, User

# ---------------------------------------------------------------------------
# Test database setup (SQLite in-memory)
# ---------------------------------------------------------------------------

SQLALCHEMY_TEST_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign key enforcement in SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixed IDs
# ---------------------------------------------------------------------------

TENANT_A_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")
TENANT_B_ID = uuid.UUID("b0000000-0000-0000-0000-000000000002")
USER_ALICE_ID = uuid.UUID("aa000000-0000-0000-0000-000000000001")
USER_BOB_ID = uuid.UUID("aa000000-0000-0000-0000-000000000002")
CASE_A_ID = uuid.UUID("cc000000-0000-0000-0000-000000000001")

VIN_A = "1FTFW1E51NFA12345"
VIN_B = "5NPE34AF9KH123456"


def _token_for(user_id: uuid.UUID, tenant_id: uuid.UUID, role: str = "staff") -> str:
    return create_access_token(
        {"sub": str(user_id), "tenant_id": str(tenant_id), "role": role}
    )


ALICE_TOKEN = None
BOB_TOKEN = None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def setup_db():
    """Create tables and seed minimal data before each test, drop after."""
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    hashed = hash_password("password123")

    # Tenants
    db.add(Tenant(id=TENANT_A_ID, name="Alpha Recovery", slug="alpha"))
    db.add(Tenant(id=TENANT_B_ID, name="Beta Recovery", slug="beta"))

    # Users
    db.add(User(id=USER_ALICE_ID, tenant_id=TENANT_A_ID, username="alice",
                password_hash=hashed, role="staff"))
    db.add(User(id=USER_BOB_ID, tenant_id=TENANT_B_ID, username="bob",
                password_hash=hashed, role="staff"))

    # Cameras
    db.add(Camera(id="cam_1001", tenant_id=TENANT_A_ID, label="Truck A-1"))
    db.add(Camera(id="cam_2050", tenant_id=TENANT_B_ID, label="Truck B-1"))

    # Active case for Tenant A
    db.add(Case(
        id=CASE_A_ID, vin=VIN_A, status="active",
        originating_tenant_id=TENANT_A_ID,
        claimed_tenant_id=TENANT_A_ID,
        assigned_agent_id=USER_ALICE_ID,
    ))

    # Historical scans for VIN_A
    for i, (lat, lng, ts) in enumerate([
        (33.749, -84.388, "2026-08-25T09:15:00Z"),
        (33.755, -84.390, "2026-08-28T14:22:00Z"),
    ]):
        db.add(Scan(
            camera_id="cam_1001", plate="7XYZ123", vin=VIN_A,
            latitude=lat, longitude=lng,
            scanned_at=datetime.fromisoformat(ts),
            image_url=f"https://example.com/img_{i}.jpg",
            case_id=CASE_A_ID,
        ))

    db.commit()
    db.close()

    global ALICE_TOKEN, BOB_TOKEN
    ALICE_TOKEN = _token_for(USER_ALICE_ID, TENANT_A_ID)
    BOB_TOKEN = _token_for(USER_BOB_ID, TENANT_B_ID)

    yield

    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_login_success():
    resp = client.post("/api/v1/auth/login", json={
        "username": "alice", "password": "password123"
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_invalid():
    resp = client.post("/api/v1/auth/login", json={
        "username": "alice", "password": "wrong"
    })
    assert resp.status_code == 401


def test_resolve_tenant():
    resp = client.get("/api/v1/tenants/resolve/alpha")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Alpha Recovery"
    assert data["slug"] == "alpha"


def test_login_with_tenant_slug_allowed():
    # Alice belongs to alpha -> allowed
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "password123"},
        headers={"X-Tenant-Slug": "alpha"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_with_tenant_slug_forbidden():
    # Bob belongs to beta, trying to login on alpha subdomain -> 403 Forbidden
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "password123"},
        headers={"X-Tenant-Slug": "alpha"},
    )
    assert resp.status_code == 403
    assert "not a registered agent" in resp.json()["detail"]



# ---------------------------------------------------------------------------
# Mock eligibility
# ---------------------------------------------------------------------------

def test_mock_eligibility_odd_vin():
    """VIN ending in 5 (odd) should be eligible."""
    resp = client.post("/mock/partner-network/eligibility",
                       json={"vin": VIN_A})
    assert resp.status_code == 200
    data = resp.json()
    assert data["still_eligible_for_repo"] is True


def test_mock_eligibility_even_vin():
    """VIN ending in 6 (even) should NOT be eligible."""
    resp = client.post("/mock/partner-network/eligibility",
                       json={"vin": VIN_B})
    assert resp.status_code == 200
    data = resp.json()
    assert data["still_eligible_for_repo"] is False


# ---------------------------------------------------------------------------
# Scan ingestion
# ---------------------------------------------------------------------------

def test_ingest_scan_existing_case():
    """Scan for VIN_A (which has an active case for Tenant A) should link to that case."""
    resp = client.post("/api/v1/scans", json={
        "camera_id": "cam_1001",
        "plate": "7XYZ123",
        "vin": VIN_A,
        "latitude": 33.770,
        "longitude": -84.385,
        "scanned_at": "2026-09-01T14:32:00Z",
        "image_url": "https://example.com/scans/new.jpg",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["flow"] == "existing_case"
    assert data["case_id"] == str(CASE_A_ID)


def test_ingest_scan_new_case_eligible():
    """Scan for VIN ending in odd digit with no existing case → new pending_claim case.

    VIN_A ends in 5 (odd) so it's eligible. We use cam_2050 (Tenant B)
    which has no case for VIN_A.
    """
    resp = client.post("/api/v1/scans", json={
        "camera_id": "cam_2050",
        "plate": "ABC1234",
        "vin": VIN_A,  # ends in 5 → eligible
        "latitude": 34.0,
        "longitude": -84.0,
        "scanned_at": "2026-09-02T10:00:00Z",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["flow"] == "new_case"
    assert data["case_id"] is not None


def test_ingest_scan_unknown_camera():
    resp = client.post("/api/v1/scans", json={
        "camera_id": "cam_unknown",
        "plate": "XYZ",
        "vin": "11111111111111111",
        "scanned_at": "2026-09-01T00:00:00Z",
    })
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cases — list
# ---------------------------------------------------------------------------

def test_list_cases_alice():
    """Alice (Tenant A) should see her own active case."""
    resp = client.get("/api/v1/cases", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    vins = [c["vin"] for c in data["cases"]]
    assert VIN_A in vins


def test_list_cases_unauthenticated():
    resp = client.get("/api/v1/cases")
    assert resp.status_code == 401


def test_list_cases_status_filter():
    resp = client.get("/api/v1/cases?status=active", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 200
    for c in resp.json()["cases"]:
        assert c["status"] == "active"


def test_list_cases_pagination():
    resp = client.get("/api/v1/cases?page=1&page_size=1", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 1
    assert len(data["cases"]) <= 1
    assert data["total_pages"] >= 1


def test_list_cases_search():
    resp = client.get(f"/api/v1/cases?search={VIN_A[:6]}", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(c["vin"] == VIN_A for c in data["cases"])


# ---------------------------------------------------------------------------
# Cases — claim
# ---------------------------------------------------------------------------

def test_claim_pending_case():
    """Create a pending_claim case then have Bob (different tenant) claim it."""
    # First, create a pending case by scanning with cam_1001 for a new VIN
    # that's eligible (odd last digit)
    new_vin = "1HGBH41JXMN109187"  # ends in 7 → eligible
    resp = client.post("/api/v1/scans", json={
        "camera_id": "cam_1001",
        "vin": new_vin,
        "plate": "TEST123",
        "scanned_at": "2026-09-03T12:00:00Z",
    })
    assert resp.status_code == 201
    case_id = resp.json()["case_id"]
    assert case_id is not None

    # Bob (Tenant B) claims it — cross-tenant claim should succeed
    resp = client.post(f"/api/v1/cases/{case_id}/claim", headers={
        "Authorization": f"Bearer {BOB_TOKEN}"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["case"]["status"] == "active"
    assert data["case"]["claimed_tenant_id"] == str(TENANT_B_ID)
    assert data["case"]["assigned_agent_id"] == str(USER_BOB_ID)


def test_claim_already_active():
    """Claiming an already-active case should return 409."""
    resp = client.post(f"/api/v1/cases/{CASE_A_ID}/claim", headers={
        "Authorization": f"Bearer {BOB_TOKEN}"
    })
    assert resp.status_code == 409


def test_claim_nonexistent():
    fake_id = uuid.uuid4()
    resp = client.post(f"/api/v1/cases/{fake_id}/claim", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cases — location trail (scans)
# ---------------------------------------------------------------------------

def test_case_scans_trail():
    """Get the location trail for the active case — should return historical scans."""
    resp = client.get(f"/api/v1/cases/{CASE_A_ID}/scans", headers={
        "Authorization": f"Bearer {ALICE_TOKEN}"
    })
    assert resp.status_code == 200
    scans = resp.json()
    assert len(scans) >= 2
    # Should be ordered by scanned_at ascending
    timestamps = [s["scanned_at"] for s in scans]
    assert timestamps == sorted(timestamps)


def test_case_scans_forbidden():
    """Bob (Tenant B) should not see Tenant A's active case scans."""
    resp = client.get(f"/api/v1/cases/{CASE_A_ID}/scans", headers={
        "Authorization": f"Bearer {BOB_TOKEN}"
    })
    assert resp.status_code == 403

