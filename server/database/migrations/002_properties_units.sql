CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL CHECK (length(trim(name)) > 0),
  address varchar(250) NOT NULL,
  city varchar(100) NOT NULL,
  region varchar(100) NOT NULL DEFAULT '',
  country varchar(100) NOT NULL,
  property_type varchar(30) NOT NULL CHECK (property_type IN ('APARTMENT', 'HOUSE', 'TOWNHOUSE', 'COMMERCIAL', 'MIXED_USE', 'OTHER')),
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);
CREATE INDEX properties_company_active_idx ON properties(company_id, active, created_at DESC);

CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  name varchar(50) NOT NULL CHECK (length(trim(name)) > 0),
  bedrooms integer NOT NULL CHECK (bedrooms BETWEEN 0 AND 100),
  bathrooms numeric(4,1) NOT NULL CHECK (bathrooms BETWEEN 0 AND 100 AND mod(bathrooms, 0.5) = 0),
  monthly_rent numeric(12,2) NOT NULL CHECK (monthly_rent >= 0),
  status varchar(20) NOT NULL DEFAULT 'VACANT' CHECK (status IN ('VACANT', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, property_id) REFERENCES properties(company_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX units_property_name_idx ON units(company_id, property_id, lower(name));
CREATE INDEX units_company_status_idx ON units(company_id, status);
