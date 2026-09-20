"""SQLAlchemy ORM models for the Plate Scan & Case Matching Service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Float,
    Text,
    ForeignKey,
    DateTime,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Tenant(Base):
    """A recovery agency using the platform."""

    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False)
    slug = Column(String(50), unique=True, index=True, nullable=True)
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    users = relationship("User", back_populates="tenant")
    cameras = relationship("Camera", back_populates="tenant")


class User(Base):
    """A staff member / agent belonging to exactly one tenant."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="staff")  # staff | admin
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")


class Camera(Base):
    """A truck-mounted camera belonging to exactly one tenant.

    This is how an inbound scan (which carries no login) gets attributed
    to a tenant.
    """

    __tablename__ = "cameras"

    id = Column(String(50), primary_key=True)  # e.g. "cam_1001"
    tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    label = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="cameras")


class Case(Base):
    """A VIN being tracked for recovery.

    Status lifecycle:
        pending_claim  →  active  →  closed
    """

    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vin = Column(String(17), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending_claim")
    originating_tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    claimed_tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True
    )
    assigned_agent_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Composite index for fast lookup during scan ingestion
    __table_args__ = (
        Index("ix_cases_vin_status", "vin", "status"),
    )

    # Relationships
    originating_tenant = relationship(
        "Tenant", foreign_keys=[originating_tenant_id]
    )
    claimed_tenant = relationship(
        "Tenant", foreign_keys=[claimed_tenant_id]
    )
    assigned_agent = relationship("User", foreign_keys=[assigned_agent_id])
    scans = relationship("Scan", back_populates="case")


class Scan(Base):
    """A single plate/VIN sighting from a camera.

    Stored regardless of whether it matches a case.
    """

    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id = Column(String(50), ForeignKey("cameras.id"), nullable=False)
    plate = Column(String(20), nullable=True)
    vin = Column(String(17), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    scanned_at = Column(DateTime(timezone=True), nullable=False)
    image_url = Column(Text, nullable=True)
    case_id = Column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    camera = relationship("Camera")
    case = relationship("Case", back_populates="scans")

