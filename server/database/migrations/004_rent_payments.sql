-- Freeze a month's terms when its first payment is recorded. Later lease edits cannot rewrite receipts.
CREATE TABLE rent_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL,
  period date NOT NULL CHECK (EXTRACT(day FROM period)=1),
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount >= 0),
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id),
  UNIQUE(company_id,lease_id,period),
  FOREIGN KEY(company_id,lease_id) REFERENCES leases(company_id,id) ON DELETE CASCADE
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  charge_id uuid NOT NULL,
  request_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK(amount > 0),
  payment_date date NOT NULL,
  method varchar(20) NOT NULL CHECK(method IN ('CASH','BANK_TRANSFER','MOBILE_MONEY','CHECK','OTHER')),
  reference varchar(150) NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason varchar(1000) NOT NULL DEFAULT '',
  UNIQUE(company_id,id),
  UNIQUE(company_id,request_id),
  FOREIGN KEY(company_id,charge_id) REFERENCES rent_charges(company_id,id) ON DELETE CASCADE,
  FOREIGN KEY(company_id,recorded_by) REFERENCES users(company_id,id),
  FOREIGN KEY(company_id,voided_by) REFERENCES users(company_id,id),
  CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason='') OR
    (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(trim(void_reason))>0))
);
CREATE INDEX payments_company_date_idx ON payments(company_id,payment_date DESC,id);
CREATE INDEX payments_company_charge_idx ON payments(company_id,charge_id);
CREATE INDEX rent_charges_company_period_idx ON rent_charges(company_id,period);
