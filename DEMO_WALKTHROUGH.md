# Demo Walkthrough & Testing Guide

This guide provides end-to-end instructions for demonstrating and testing the **Plate Scan & Case Matching Service**, both through the interactive web dashboard and via the REST API using `curl`.

---

## Prerequisites & Service Setup

Ensure all three core services are up and running:

### 1. Database (PostgreSQL)
```bash
# Start PostgreSQL (port 5433 or default 5432)
docker start plate_scan_db
# Or via docker-compose: docker-compose up -d db
```

### 2. Backend (FastAPI)
```bash
source venv/bin/activate
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/plate_scan_db uvicorn app.main:app --reload --port 8000
```
- API root: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 3. Seed Database
Reset or populate initial test data:
```bash
source venv/bin/activate
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/plate_scan_db python -m app.seed
```

### 4. Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
- Development server: `http://localhost:3000`

---

## Seed Data & Credentials

All test accounts use the password: **`password123`**

| Portal / Tenant | Subdomain URL | Camera ID | Users | Initial State |
| :--- | :--- | :--- | :--- | :--- |
| **Alpha Recovery** | [http://alpha.localhost:3000](http://alpha.localhost:3000) | `cam_1001` | `alice` (staff)<br>`admin_a` (admin) | Active case with VIN `1FTFW1E51NFA12345` & 3 location scans |
| **Beta Recovery** | [http://beta.localhost:3000](http://beta.localhost:3000) | `cam_2050` | `bob` (staff) | Ready for new scans & cross-tenant claims |
| **Platform Directory**| [http://platform.localhost:3000](http://platform.localhost:3000) | — | — | Central portal directory (auto-redirects from `localhost:3000`) |

*(Note: Per RFC 6761, modern browsers automatically resolve `*.localhost` subdomains directly to `127.0.0.1` with no `/etc/hosts` changes required).*

---

## Part 1: Interactive Dashboard Walkthrough

### Scenario A: Login & Tenant Isolation
1. Navigate to `http://alpha.localhost:3000`.
2. Notice the tenant-specific branding: **Alpha Recovery** logo with the clean name beside it, and the minimalist monochrome dotted world-map background.
3. Attempt logging in as `bob` on Alpha's portal — notice access is rejected with tenant-isolation enforcement (`403 Forbidden`).
4. Log in as `alice` / `password123`.

### Scenario B: Dashboard, Filtering & Database Pagination
1. Alice lands on the Cases dashboard displaying recovery KPIs (Total Cases, Active, Pending Claim).
2. Use the **Search by VIN** box to filter cases.
3. Toggle status filters between **All**, **Active**, and **Pending Claim**.
4. Test the pagination controls at the bottom (`Page 1 of N`, Next, Previous).

### Scenario C: Case Detail & Location Trail Map
1. Click on case `1FTFW1E51NFA12345`.
2. Inspect the **Location Trail**:
   - Interactive Leaflet map rendered with CartoDB Positron black & white tiles.
   - Numbered route pins showing chronological sightings from oldest to newest.
   - Connected path line visualizing vehicle movement across coordinates.

---

## Part 2: REST API & Scenario Flow (`curl`)

### Step 1: Authenticate and Acquire JWT

#### Login as Alice (Tenant Alpha)
```bash
TOKEN_A=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: alpha" \
  -d '{"username": "alice", "password": "password123"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

echo "Alice Token: $TOKEN_A"
```

#### Login as Bob (Tenant Beta)
```bash
TOKEN_B=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: beta" \
  -d '{"username": "bob", "password": "password123"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

echo "Bob Token: $TOKEN_B"
```

---

### Step 2: Existing-Case Flow (Alpha Camera Sighting)

Ingest a new scan of an existing active case VIN using Alpha's camera (`cam_1001`):

```bash
curl -s -X POST http://localhost:8000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam_1001",
    "plate": "7XYZ123",
    "vin": "1FTFW1E51NFA12345",
    "latitude": 33.7749,
    "longitude": -84.3964,
    "scanned_at": "2026-09-20T10:00:00Z",
    "image_url": "https://example.com/scans/sighting-4.jpg"
  }' | jq .
```
**Expected Response**:
```json
{
  "scan_id": "...",
  "matched": true,
  "case_id": "...",
  "case_status": "active",
  "flow": "existing_case"
}
```

---

### Step 3: New-Case Flow (Beta Camera Sighting of Unregistered VIN)

Ingest a scan from Beta's camera (`cam_2050`) with an unassigned VIN that passes partner eligibility:

```bash
NEW_SCAN=$(curl -s -X POST http://localhost:8000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam_2050",
    "plate": "REC9988",
    "vin": "1HGBH41JXMN109187",
    "latitude": 34.0522,
    "longitude": -84.1023,
    "scanned_at": "2026-09-20T10:15:00Z",
    "image_url": "https://example.com/scans/new-case-1.jpg"
  }')

echo $NEW_SCAN | jq .
NEW_CASE_ID=$(echo $NEW_SCAN | jq -r .case_id)
```
**Expected Response**:
```json
{
  "scan_id": "...",
  "matched": false,
  "case_id": "...",
  "case_status": "pending_claim",
  "flow": "new_case"
}
```

---

### Step 4: Cross-Tenant Claim

Bob from Beta Recovery claims the newly created `pending_claim` case:

```bash
curl -s -X POST "http://localhost:8000/api/v1/cases/${NEW_CASE_ID}/claim" \
  -H "Authorization: Bearer $TOKEN_B" | jq .
```
**Expected Response**:
```json
{
  "id": "...",
  "vin": "1HGBH41JXMN109187",
  "status": "active",
  "claimed_tenant_id": "...",
  "assigned_agent_id": "..."
}
```

---

### Step 5: Query Location Trail for a Case

Retrieve the chronologically ordered GPS sighting trail:

```bash
curl -s "http://localhost:8000/api/v1/cases/${NEW_CASE_ID}/scans" \
  -H "Authorization: Bearer $TOKEN_B" | jq .
```

---

### Step 6: Mock Partner Network Eligibility Check

Direct test of external recovery partner eligibility verification:

```bash
# Odd last digit -> Eligible (true)
curl -s -X POST http://localhost:8000/mock/partner-network/eligibility \
  -H "Content-Type: application/json" \
  -d '{"vin": "1HGBH41JXMN109187"}' | jq .

# Even last digit -> Not eligible (false)
curl -s -X POST http://localhost:8000/mock/partner-network/eligibility \
  -H "Content-Type: application/json" \
  -d '{"vin": "1HGBH41JXMN109188"}' | jq .
```

---

## Automated Test Verification

Run all automated unit and integration tests:

```bash
source venv/bin/activate
pytest tests/ -v
```
**Result**: 21 / 21 tests passing.
