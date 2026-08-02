-- MVP3 Đợt 5 — Company Brain scope_level (Q16, thu hẹp — chỉ session/personal/project có nghĩa
-- dùng thật ở đợt này, pilot chỉ có 1 project nên department/company không test được thật) +
-- Pattern Library (Q16 — chỉ phần "generalize có gate", KHÔNG bật reuse tự động giữa project,
-- phần đó cố tình khoá tới MVP4 theo đúng tài liệu).

ALTER TABLE project_context ADD COLUMN scope_level TEXT NOT NULL DEFAULT 'project'
  CHECK (scope_level IN ('session', 'personal', 'project', 'department', 'company'));

CREATE TABLE pattern_library (
  id                  TEXT PRIMARY KEY,
  source_context_id   TEXT REFERENCES project_context(id),
  title               TEXT NOT NULL,
  content_anonymized  TEXT NOT NULL,
  category            TEXT NOT NULL,
  generalized_by      TEXT NOT NULL REFERENCES employees(id),
  approved_by         TEXT REFERENCES employees(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pattern_library_category ON pattern_library (category);
