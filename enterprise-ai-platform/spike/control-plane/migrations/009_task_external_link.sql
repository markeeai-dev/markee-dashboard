-- Chuẩn bị schema cho tích hợp task tracker ngoài (Linear/Jira) sau này, đúng mục 14
-- ("webhook 2 chiều với task tracker hiện có... không tự xây engine quản lý quy trình") — KHÔNG
-- viết connector thật ở đợt này (không có account Linear/Jira thật để test, viết connector
-- không kiểm chứng được là code đoán mò). Chỉ thêm cột sẵn, không đổi hành vi hiện tại — cả 3
-- cột nullable, mọi task hiện có vẫn NULL cho tới khi có connector thật gán giá trị.

ALTER TABLE tasks ADD COLUMN external_source TEXT;
ALTER TABLE tasks ADD COLUMN external_issue_id TEXT;
ALTER TABLE tasks ADD COLUMN last_synced_at TIMESTAMPTZ;
