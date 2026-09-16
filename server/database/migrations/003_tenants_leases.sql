-- GiST equality operators let PostgreSQL reject overlapping bookings, including concurrent writes.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name varchar(100) NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name varchar(100) NOT NULL CHECK (length(trim(last_name)) > 0),
  phone varchar(40) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL DEFAULT '',
  emergency_contact_name varchar(150) NOT NULL DEFAULT '',
  emergency_contact_phone varchar(40) NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);
CREATE INDEX tenants_company_name_idx ON tenants(company_id, last_name, first_name);

CREATE TABLE leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  monthly_rent numeric(12,2) NOT NULL CHECK (monthly_rent >= 0),
  security_deposit numeric(12,2) NOT NULL CHECK (security_deposit >= 0),
  notes text NOT NULL DEFAULT '',
  terminated_at timestamptz,
  termination_reason varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, tenant_id) REFERENCES tenants(company_id, id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, unit_id) REFERENCES units(company_id, id) ON DELETE CASCADE,
  CONSTRAINT leases_unit_no_overlap EXCLUDE USING gist (
    company_id public.gist_uuid_ops WITH =,
    unit_id public.gist_uuid_ops WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (terminated_at IS NULL),
  CONSTRAINT leases_tenant_no_overlap EXCLUDE USING gist (
    company_id public.gist_uuid_ops WITH =,
    tenant_id public.gist_uuid_ops WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (terminated_at IS NULL)
);
CREATE INDEX leases_company_dates_idx ON leases(company_id, start_date, end_date);
CREATE INDEX leases_company_tenant_idx ON leases(company_id, tenant_id);
CREATE INDEX leases_company_unit_idx ON leases(company_id, unit_id);

-- Date-derived views cannot become stale after midnight or an API restart. End dates are inclusive.
CREATE VIEW lease_details AS
SELECT l.*,
  CASE WHEN terminated_at IS NOT NULL THEN 'TERMINATED'
    WHEN end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN 'EXPIRED'
    WHEN start_date > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN 'UPCOMING'
    ELSE 'ACTIVE' END AS status
FROM leases l;

CREATE VIEW unit_occupancy AS
SELECT u.*,
  CASE WHEN current_lease.id IS NOT NULL THEN 'OCCUPIED' ELSE u.status END AS occupancy_status,
  current_lease.id AS active_lease_id,
  EXISTS (SELECT 1 FROM lease_details l WHERE l.company_id=u.company_id AND l.unit_id=u.id AND l.status='UPCOMING') AS has_upcoming_lease
FROM units u
LEFT JOIN lease_details current_lease ON current_lease.company_id=u.company_id AND current_lease.unit_id=u.id AND current_lease.status='ACTIVE';
