-- MVP2 hạng mục 4 — Task claim/lease đầy đủ (Q20), thay cảnh báo mềm 1 dòng của POC.
-- Đúng thiết kế: exclusive = 1 người sở hữu có lease hạn (tự gia hạn khi còn hoạt động,
-- tự hết hạn nếu idle — KHÔNG khoá cứng người khác, chỉ cảnh báo rõ ràng). shared = nhiều
-- người cùng lúc được, chỉ mang tính thông tin.

ALTER TABLE tasks
  ADD COLUMN claim_mode TEXT NOT NULL DEFAULT 'exclusive' CHECK (claim_mode IN ('exclusive', 'shared')),
  ADD COLUMN claimed_by_employee_id TEXT REFERENCES employees(id),
  ADD COLUMN lease_until TIMESTAMPTZ;

CREATE INDEX idx_tasks_claim ON tasks (claimed_by_employee_id) WHERE claimed_by_employee_id IS NOT NULL;
