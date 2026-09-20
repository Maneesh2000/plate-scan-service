# Plate Scan & Case Matching Service

A vehicle recovery platform API that ingests license plate/VIN scans from truck-mounted cameras, matches them to recovery cases, and exposes tenant-scoped REST endpoints.

> 📖 **Demo & Testing Guide**: Check out [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md) for step-by-step test accounts, UI workflows, and `curl` API scenarios.

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Frontend**: React 18, Vite, Leaflet (interactive maps)
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

#### 1. Backend (FastAPI)

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

#### 2. Frontend (React + Vite)

```bash
# Prerequisites: Node.js 18+

cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend dashboard will be available at:
- **Central Directory**: `http://localhost:3000`
- **Alpha Recovery Portal**: `http://alpha.localhost:3000` (`alice` or `admin_a` / `password123`)
- **Beta Recovery Portal**: `http://beta.localhost:3000` (`bob` / `password123`)

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

## Database Schema

![Database Schema](docs/images/database-schema.png)

## Assumptions

1. **Auth is simplified** — simple username/password login with JWT. No refresh tokens, password reset, or OAuth. A real system would use an identity provider (Auth0, Cognito, etc.).
2. **Image storage** — `image_url` is a plain string field. No actual file upload or S3 integration.
3. **Notifications** — not implemented. In production, I'd use a message queue (SQS/SNS) to notify agents when a new case is created or a sighting is recorded. A WebSocket layer could push real-time updates to the dashboard.
4. **Eligibility check** — uses a mock endpoint that alternates based on VIN last digit. The real integration would call an external partner API.
5. **Case lifecycle** — there's no endpoint to close a case. That would be a natural next step.
6. **Pagination** — the list endpoint returns all matching cases. Production would need cursor-based pagination.
7. **Rate limiting** — not implemented. The scan ingestion endpoint would need rate limiting in production.

## AWS Architecture & Stack

![AWS Architecture](docs/images/aws-architecture.png)

- **ALB (Application Load Balancer)**: Distributes incoming traffic across API service nodes.
- **ECS Cluster**:
  - **Python API Service**: Auto-scaled FastAPI containers (N1–N3) with **Redis** cache.
  - **Consumer Service**: Dedicated background workers (N1–N3) consuming events.
- **SQS / Kafka**: Event streaming / message queue decoupling ingestion and background jobs.
- **AWS RDS / Aurora**: High-availability PostgreSQL database for cases, scans, cameras, and tenants.
- **AWS AppSync (WebSockets)**: Real-time event streaming and dashboard live updates.
- **SNS / SQS**: Push notifications to field recovery agents and partner systems.
- **AWS S3**: Scalable object storage for raw camera scan images.

## CI/CD Pipeline

![CI/CD Pipeline](docs/images/cicd-pipeline.png)

- **GitHub Repository Branches**: `main`, `develop`, `frontend`, `backend`
- **Backend CI/CD (Python API Service)**:
  1. **Trigger GitHub Actions**: On push / PR targeting backend paths
  2. **Run Tests**: Code linting & unit tests (Python / pytest)
  3. **Build Python Image**: Build Docker container, tag, and push to **Amazon ECR**
  4. **Deploy the Stack**: Deploy/update ECS service via Terraform / CloudFormation or AWS CLI
- **Frontend CI/CD (React UI)**:
  1. **Trigger GitHub Actions**: On push / PR targeting frontend paths
  2. **Run Tests**: Code linting & unit tests (Node / React)
  3. **Build Frontend**: Install dependencies and build production bundle
  4. **Deploy to S3**: Upload production build to **AWS S3** and invalidate **CloudFront** cache


