CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(50) UNIQUE,
    logo_url VARCHAR(500),
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ,

    CONSTRAINT fk_users_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id UUID NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMPTZ,

    CONSTRAINT fk_cameras_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY,
    vin VARCHAR(17) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_claim',
    originating_tenant_id UUID NOT NULL,
    claimed_tenant_id UUID,
    assigned_agent_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_cases_originating_tenant
        FOREIGN KEY (originating_tenant_id)
        REFERENCES tenants(id),

    CONSTRAINT fk_cases_claimed_tenant
        FOREIGN KEY (claimed_tenant_id)
        REFERENCES tenants(id),

    CONSTRAINT fk_cases_assigned_agent
        FOREIGN KEY (assigned_agent_id)
        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY,
    camera_id VARCHAR(50) NOT NULL,
    plate VARCHAR(20),
    vin VARCHAR(17) NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    scanned_at TIMESTAMPTZ NOT NULL,
    image_url TEXT,
    case_id UUID,
    created_at TIMESTAMPTZ,

    CONSTRAINT fk_scans_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras(id),
 
    CONSTRAINT fk_scans_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS ix_tenants_slug
    ON tenants(slug);

CREATE INDEX IF NOT EXISTS ix_cases_vin
    ON cases(vin);

CREATE INDEX IF NOT EXISTS ix_cases_vin_status
    ON cases(vin, status);

CREATE INDEX IF NOT EXISTS ix_scans_vin
    ON scans(vin);