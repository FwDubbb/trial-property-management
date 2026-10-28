-- A request's unit must belong to its property, including when records are written outside the API.
ALTER TABLE units ADD CONSTRAINT units_company_property_id_key UNIQUE(company_id,property_id,id);
CREATE TABLE maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  property_id uuid NOT NULL,
  unit_id uuid,
  tenant_id uuid,
  title varchar(150) NOT NULL CHECK(length(trim(title))>0),
  description text NOT NULL CHECK(length(trim(description))>0),
  priority varchar(20) NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  status varchar(20) NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  submitted_date date NOT NULL,
  assigned_to varchar(150) NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  UNIQUE(company_id,id),
  FOREIGN KEY(company_id,property_id) REFERENCES properties(company_id,id) ON DELETE CASCADE,
  FOREIGN KEY(company_id,property_id,unit_id) REFERENCES units(company_id,property_id,id) ON DELETE CASCADE,
  FOREIGN KEY(company_id,tenant_id) REFERENCES tenants(company_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES users(company_id,id),
  CHECK(tenant_id IS NULL OR unit_id IS NOT NULL),
  CHECK((status='COMPLETED')=(completed_at IS NOT NULL)),
  CHECK(status NOT IN ('ASSIGNED','IN_PROGRESS') OR length(trim(assigned_to))>0)
);
CREATE INDEX maintenance_company_filter_idx ON maintenance_requests(company_id,status,priority,property_id);
CREATE INDEX maintenance_company_tenant_idx ON maintenance_requests(company_id,tenant_id,submitted_date DESC);
CREATE INDEX maintenance_company_unit_idx ON maintenance_requests(company_id,unit_id,submitted_date DESC);
CREATE TABLE maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action varchar(20) NOT NULL CHECK(action IN ('CREATED','UPDATED','STATUS_CHANGED')),
  from_status varchar(20),
  to_status varchar(20) NOT NULL,
  assigned_to varchar(150) NOT NULL DEFAULT '',
  priority varchar(20) NOT NULL,
  reason varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id,request_id) REFERENCES maintenance_requests(company_id,id) ON DELETE CASCADE,
  FOREIGN KEY(company_id,actor_id) REFERENCES users(company_id,id)
);
CREATE INDEX maintenance_events_request_idx ON maintenance_events(company_id,request_id,created_at);
