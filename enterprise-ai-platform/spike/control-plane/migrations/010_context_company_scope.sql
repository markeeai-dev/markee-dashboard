-- Bộ tri thức chung — cho phép tri thức tầng company/department tồn tại.
--
-- Tri thức "quy tắc công ty"/"chuẩn kỹ thuật team" KHÔNG thuộc dự án nào — nhưng project_id
-- đang NOT NULL nên loại tri thức này trước giờ không thể tồn tại, khiến company.md/team.md
-- luôn rỗng ruột (chỉ có comment placeholder). Bỏ ràng buộc NOT NULL để chúng có chỗ ở.
--
-- Các dòng cũ KHÔNG đổi (vẫn có project_id đầy đủ). Chỉ mở khả năng để project_id = NULL khi
-- scope_level là 'company'/'department' — ràng buộc đó thực thi ở tầng ứng dụng
-- (handleIngestContext), không đặt CHECK constraint chéo cột ở đây vì scope_level còn dùng cho
-- cả những trường hợp có project_id (session/personal/project).

ALTER TABLE project_context ALTER COLUMN project_id DROP NOT NULL;

-- Tri thức company/team được đọc ở MỌI phiên của MỌI dự án (khác hẳn note theo project/task
-- chỉ đọc trong đúng dự án đó) — index riêng cho đường đọc nóng này.
CREATE INDEX idx_project_context_scope ON project_context (scope_level)
  WHERE scope_level IN ('company', 'department');
