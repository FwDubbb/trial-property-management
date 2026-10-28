CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  category varchar(30) NOT NULL CHECK(category IN ('REPAIRS','UTILITIES','PROPERTY_TAXES','INSURANCE','CLEANING','LANDSCAPING','SUPPLIES','OTHER')),
  description varchar(500) NOT NULL CHECK(length(trim(description))>0),
  amount numeric(12,2) NOT NULL CHECK(amount>0),
  expense_date date NOT NULL,
  notes text NOT NULL DEFAULT '',
  request_id uuid NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason varchar(1000) NOT NULL DEFAULT '',
  UNIQUE(company_id,id),
  UNIQUE(company_id,request_id),
  FOREIGN KEY(company_id,property_id) REFERENCES properties(company_id,id),
  FOREIGN KEY(company_id,recorded_by) REFERENCES users(company_id,id),
  FOREIGN KEY(company_id,voided_by) REFERENCES users(company_id,id),
  CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason='') OR
    (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(trim(void_reason))>0))
);
CREATE INDEX expenses_company_date_idx ON expenses(company_id,expense_date DESC,id);
CREATE INDEX expenses_company_property_idx ON expenses(company_id,property_id,expense_date);
