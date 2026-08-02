-- MVP3 tiếp theo, hạng mục 1 — Full Audit Mode: lưu nội dung thô có redact (Q22, nối tiếp
-- cơ chế cấp quyền full_audit_grants đã có ở đợt trước, lúc đó cố tình chưa lưu nội dung vì
-- chưa có redaction chuẩn — nay có shared/governance-scan.js, làm tiếp đúng như đã hứa).
--
-- BẢO MẬT: mọi dòng trong prompts/responses BẮT BUỘC gắn với 1 full_audit_grants còn hiệu
-- lực tại thời điểm ghi (full_audit_grant_id NOT NULL, có FK) — không có đường nào chèn được
-- dòng "mồ côi" không gắn grant nào. content_hash lưu hash của bản GỐC (trước redact) để đối
-- chiếu khi điều tra mà không cần giữ bản gốc.

CREATE TABLE prompts (
  id                   TEXT PRIMARY KEY,
  gateway_request_id   TEXT NOT NULL,
  employee_id          TEXT REFERENCES employees(id),
  work_session_id      TEXT REFERENCES work_sessions(id),
  content_redacted     TEXT NOT NULL,
  content_hash         TEXT NOT NULL,
  full_audit_grant_id  TEXT NOT NULL REFERENCES full_audit_grants(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE responses (
  id            TEXT PRIMARY KEY,
  prompt_id     TEXT NOT NULL REFERENCES prompts(id),
  content_redacted TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompts_work_session ON prompts (work_session_id);
CREATE INDEX idx_prompts_employee ON prompts (employee_id, created_at DESC);
CREATE INDEX idx_responses_prompt ON responses (prompt_id);
