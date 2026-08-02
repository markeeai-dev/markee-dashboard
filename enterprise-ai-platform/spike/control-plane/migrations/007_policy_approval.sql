-- MVP3 Đợt 4 — Policy Engine cơ bản: Data Classification (tầng Project, không phải regex
-- real-time từng prompt — quyết định đã chốt, xem MVP3-PROGRESS.md) + Approval workflow (Q13).
-- Mặc định 'unclassified' + không có policy nào -> hành vi hiện tại không đổi (opt-in, không
-- bật sẵn), an toàn cho traffic thật của Thanh/Hoàng.

ALTER TABLE projects ADD COLUMN classification TEXT NOT NULL DEFAULT 'unclassified'
  CHECK (classification IN ('unclassified', 'public', 'internal', 'customer_data'));

CREATE TABLE policies (
  id                TEXT PRIMARY KEY,
  scope             TEXT NOT NULL CHECK (scope IN ('company', 'project')),
  scope_id          TEXT,              -- NULL khi scope='company'; project_id khi scope='project'
  classification    TEXT NOT NULL CHECK (classification IN ('unclassified', 'public', 'internal', 'customer_data')),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  created_by        TEXT NOT NULL REFERENCES employees(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_requests (
  id             TEXT PRIMARY KEY,
  employee_id    TEXT NOT NULL REFERENCES employees(id),
  project_id     TEXT NOT NULL REFERENCES projects(id),
  classification TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     TEXT REFERENCES employees(id),
  decided_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ           -- chỉ set khi approved (giống full_audit_grants)
);

CREATE INDEX idx_approval_requests_lookup ON approval_requests (employee_id, project_id, classification, status);
