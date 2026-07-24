-- MVP3 tiếp theo, hạng mục 2 — Context Confidence + Reasoning Log/ADR (Q15).
-- project_context (MVP1) thiếu approved_by/valid_from/valid_to so với schema đầy đủ mục 11 —
-- MVP1 đã cắt gọn có chủ đích, thêm lại đúng lúc cần dùng, không phải sửa lỗi.

ALTER TABLE project_context ADD COLUMN approved_by TEXT REFERENCES employees(id);
ALTER TABLE project_context ADD COLUMN valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE project_context ADD COLUMN valid_to TIMESTAMPTZ;

CREATE TABLE decision_detail (
  id                  TEXT PRIMARY KEY,
  context_id          TEXT NOT NULL REFERENCES project_context(id),
  options_considered  JSONB NOT NULL DEFAULT '[]',
  criteria            JSONB NOT NULL DEFAULT '[]',
  chosen              TEXT NOT NULL,
  rationale           TEXT NOT NULL,
  superseded_reason   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_detail_context ON decision_detail (context_id);
