-- 1) Chế độ ghi nội dung ở cấp công ty (audit_mode) — quyết định của chủ hệ thống: đây là hệ
--    thống công ty, dự án công ty, tiền token công ty, nên sếp phải xem được dev nhắn gì.
--
--    Làm thành CẤU HÌNH chứ không hard-code "luôn ghi": khách hàng khác (vd EVN) có thể yêu cầu
--    metadata-only vì lý do nội bộ của họ — hard-code là tự đóng cửa khả năng bán.
--    Mặc định của BẢNG là 'metadata' (an toàn cho deployment mới), nhưng công ty NÀY seed 'full'.
CREATE TABLE company_settings (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  audit_mode  TEXT NOT NULL DEFAULT 'metadata' CHECK (audit_mode IN ('metadata', 'full')),
  updated_by  TEXT REFERENCES employees(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO company_settings (id, audit_mode) VALUES ('default', 'full');

-- 2) audit_mode='full' thì KHÔNG có grant nào cả — nhưng full_audit_grant_id đang NOT NULL nên
--    không ghi được dòng nào. Bỏ NOT NULL, thay bằng capture_reason để vẫn truy vết được VÌ SAO
--    dòng này được lưu ('company_policy' = chính sách công ty, 'grant' = grant điều tra riêng).
ALTER TABLE prompts ALTER COLUMN full_audit_grant_id DROP NOT NULL;
ALTER TABLE prompts ADD COLUMN capture_reason TEXT;

-- 3) Definition of Done: trước đây task chỉ có `title`, không có tiêu chí nào để đối chiếu
--    "thế nào là xong" -> ai cũng bấm dropdown thành closed là xong. Field này còn đi thẳng vào
--    task.md nên chính AI cũng biết tiêu chí hoàn thành, không chỉ biết tên task.
--    KHÔNG thêm cột trạng thái mới: 4 status sẵn có đã đủ diễn tả 2 bước
--    (done = dev tự báo xong, closed = leader duyệt chốt — gate ở tầng ứng dụng).
ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT;
