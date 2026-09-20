"""FastAPI application entry point.

Registers all routers, sets up CORS, and creates database tables on startup.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.database import Base, engine
from app.routers import auth, cases, mock_partner, scans


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all database tables on startup and ensure schema migrations."""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            conn.execute(
                text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(50);")
            )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_slug ON tenants(slug);")
            )
            conn.execute(
                text("UPDATE tenants SET slug = 'alpha' WHERE name ILIKE '%alpha%' AND (slug IS NULL OR slug = '');")
            )
            conn.execute(
                text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);")
            )
            conn.execute(
                text("UPDATE tenants SET logo_url = '/logos/alpha.svg' WHERE slug = 'alpha';")
            )
            conn.execute(
                text("UPDATE tenants SET logo_url = '/logos/beta.svg' WHERE slug = 'beta';")
            )
            conn.commit()
    except Exception:
        pass
    yield


app = FastAPI(
    title="Plate Scan & Case Matching Service",
    description=(
        "A vehicle recovery platform API that ingests license plate/VIN scans "
        "from cameras, matches them to recovery cases, and exposes tenant-scoped "
        "REST endpoints."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4200", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(cases.router)
app.include_router(mock_partner.router)


@app.get("/", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "Plate Scan & Case Matching Service"}

