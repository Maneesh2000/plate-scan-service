# Plate Scan & Case Matching Service

A vehicle recovery platform API that ingests license plate/VIN scans from truck-mounted cameras, matches them to recovery cases, and exposes tenant-scoped REST endpoints.

## Architecture

```
┌─────────────┐     POST /api/v1/scans     ┌──────────────┐     ┌────────────┐
│   Camera     │ ──────────────────────────▶│  FastAPI App │────▶│ PostgreSQL │
│  (webhook)   │   (unauthenticated)        │              │     │            │
└─────────────┘                             │  ┌────────┐  │     └────────────┘
                                            │  │ Auth   │  │
┌─────────────┐     GET/POST (JWT auth)     │  │ (JWT)  │  │
│  Dashboard   │ ──────────────────────────▶│  └────────┘  │
│  (React/Ang) │                            │              │
└─────────────┘                             │  ┌────────┐  │
                                            │  │ Mock   │  │
                                            │  │Partner │  │
                                            │  └────────┘  │
                                            └──────────────┘
```

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL 15
- **Auth**: JWT (python-jose) + bcrypt
- **Testing**: pytest with SQLite in-memory
- **Containerization**: Docker & Docker Compose

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
# Start PostgreSQL + API server
docker-compose up --build

# Seed the database (in another terminal)
docker-compose exec app python -m app.seed
```

The API is available at **http://localhost:8000**.  
Interactive docs at **http://localhost:8000/docs**.

### Option 2: Local development

```bash
# Prerequisites: Python 3.12+, PostgreSQL running locally

# Install dependencies
pip install -r requirements.txt

# Set the database URL (or create a .env file from .env.example)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plate_scan_db

# Create the database
createdb plate_scan_db  # or via psql

# Run the server (auto-creates tables)
uvicorn app.main:app --reload

# Seed the database
python -m app.seed
```

### Running Tests

```bash
# Tests use SQLite in-memory — no database required
pip install -r requirements.txt
pytest tests/ -v
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | No | Login → JWT |
| `POST` | `/api/v1/scans` | No | Ingest a camera scan |
| `GET` | `/api/v1/cases` | Yes | List cases (tenant-scoped) |
| `POST` | `/api/v1/cases/{id}/claim` | Yes | Claim a pending case |
| `GET` | `/api/v1/cases/{id}/scans` | Yes | Location trail for a case |
| `POST` | `/mock/partner-network/eligibility` | No | Mock eligibility check |

## Seed Data

| Tenant | Camera | User | Scenario |
|--------|--------|------|----------|
| Alpha Recovery | cam_1001 | `alice` (staff), `admin_a` (admin) | Active case for VIN `1FTFW1E51NFA12345` + 3 scans |
| Beta Recovery | cam_2050 | `bob` (staff) | No case — new-case flow with VIN `5NPE34AF9KH123456` |

**All passwords**: `password123`

## Demo Walkthrough

### 1. Login as Alice (Tenant A)
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'
# Save the access_token as TOKEN_A
```

### 2. Existing-case flow — scan a known VIN with Tenant A's camera
```bash
curl -X POST http://localhost:8000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam_1001",
    "plate": "7XYZ123",
    "vin": "1FTFW1E51NFA12345",
    "latitude": 33.770,
    "longitude": -84.385,
    "scanned_at": "2026-09-01T14:32:00Z",
    "image_url": "https://example.com/scans/new.jpg"
  }'
# → flow: "existing_case", linked to the active case
```

### 3. New-case flow — scan a new VIN with Tenant B's camera
```bash
curl -X POST http://localhost:8000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam_2050",
    "plate": "ABC9999",
    "vin": "1HGBH41JXMN109187",
    "latitude": 34.05,
    "longitude": -84.10,
    "scanned_at": "2026-09-02T10:00:00Z"
  }'
# → flow: "new_case", creates a pending_claim case
```

### 4. Cross-tenant claim — Bob claims the pending case
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "bob", "password": "password123"}'
# Save the token as TOKEN_B

curl -X POST http://localhost:8000/api/v1/cases/<case_id>/claim \
  -H "Authorization: Bearer $TOKEN_B"
# → Case moves to active, assigned to Bob / Beta Recovery
```

### 5. View location trail
```bash
curl http://localhost:8000/api/v1/cases/<case_id>/scans \
  -H "Authorization: Bearer $TOKEN_A"
```

## Assumptions

1. **Auth is simplified** — simple username/password login with JWT. No refresh tokens, password reset, or OAuth. A real system would use an identity provider (Auth0, Cognito, etc.).
2. **Image storage** — `image_url` is a plain string field. No actual file upload or S3 integration.
3. **Notifications** — not implemented. In production, I'd use a message queue (SQS/SNS) to notify agents when a new case is created or a sighting is recorded. A WebSocket layer could push real-time updates to the dashboard.
4. **Eligibility check** — uses a mock endpoint that alternates based on VIN last digit. The real integration would call an external partner API.
5. **Case lifecycle** — there's no endpoint to close a case. That would be a natural next step.
6. **Pagination** — the list endpoint returns all matching cases. Production would need cursor-based pagination.
7. **Rate limiting** — not implemented. The scan ingestion endpoint would need rate limiting in production.

## What I'd Do Next

- **Close case endpoint** (`POST /api/v1/cases/{id}/close`)
- **Pagination** on list endpoints (cursor-based)
- **WebSocket** notifications for real-time case updates
- **Role-based access control** — admin vs. staff permissions
- **Alembic migrations** for schema versioning
- **CI/CD pipeline** with automated tests
- **API rate limiting** on the scan ingestion endpoint
- **Audit logging** for case claim/status changes

## AWS Deployment Sketch

- **ECS Fargate** for the FastAPI container (auto-scaling)
- **RDS PostgreSQL** (Multi-AZ for HA)
- **ALB** (Application Load Balancer) in front of ECS
- **S3** for scan image storage
- **SQS/SNS** for async notifications
- **CloudWatch** for logging and monitoring
- **Secrets Manager** for credentials
- **Route 53** for DNS

