-- MVP2 hạng mục 2 — Request Span đầy đủ (mục 11/15 tài liệu chính).
-- Migration riêng (không sửa schema.sql gốc — đã áp dụng ở MVP1, tránh chạy lại toàn bộ).
-- Rút gọn có chủ đích: estimated_cost tính bằng bảng giá tĩnh đơn giản trong code
-- (spike/control-plane/pricing.js), KHÔNG phải billing chuẩn — đủ cho cost_per_task thô
-- (mục 15), chưa phải cost_per_accepted_outcome (Q22, MVP3).

CREATE TABLE request_spans (
  id                  TEXT PRIMARY KEY,
  gateway_request_id  TEXT NOT NULL UNIQUE,
  work_session_id     TEXT REFERENCES work_sessions(id),
  tool_session_id     TEXT REFERENCES tool_sessions(id),
  employee_id         TEXT REFERENCES employees(id),
  project_id          TEXT REFERENCES projects(id),
  task_id             TEXT REFERENCES tasks(id),
  provider            TEXT,
  model               TEXT,
  input_tokens        INT,
  output_tokens       INT,
  cached_tokens       INT,
  estimated_cost_usd  NUMERIC(10, 6),
  latency_ms          INT,
  status               TEXT,
  http_status         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_spans_work_session ON request_spans (work_session_id);
CREATE INDEX idx_request_spans_employee_time ON request_spans (employee_id, created_at DESC);
CREATE INDEX idx_request_spans_task ON request_spans (task_id);
