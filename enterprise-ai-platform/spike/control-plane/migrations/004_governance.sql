-- MVP3 khởi động — Governance (Q13: Secret Scan + PII Detection) + 2-mode Audit (Q22).
-- Đúng schema mục 11 tài liệu chính (flags: thêm severity/score theo đúng Q13; audit_logs:
-- append-only, không có UPDATE/DELETE nào trong code). full_audit_grants là bảng mới, thiết
-- kế theo đúng kiểu lease đã dùng ở Task claim (Q20) — hết hạn tự nhiên, không cần job dọn.

ALTER TABLE employees
  ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin'));

CREATE TABLE flags (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT REFERENCES employees(id),
  work_session_id TEXT REFERENCES work_sessions(id),
  type            TEXT NOT NULL CHECK (type IN ('secret_detected', 'pii_detected')),
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'med', 'high')),
  score           INT NOT NULL DEFAULT 1,
  detail          JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by     TEXT REFERENCES employees(id)
);

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES employees(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE full_audit_grants (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL CHECK (scope IN ('employee', 'project')),
  scope_id    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  granted_by  TEXT NOT NULL REFERENCES employees(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flags_employee ON flags (employee_id, detected_at DESC);
CREATE INDEX idx_audit_logs_time ON audit_logs (created_at DESC);
CREATE INDEX idx_full_audit_grants_scope ON full_audit_grants (scope, scope_id, expires_at);

-- Cần 1 admin thật để test được toàn bộ luồng phân quyền (risk-score/audit-logs/full-audit-mode).
UPDATE employees SET role = 'admin' WHERE id = 'emp_thanh';
