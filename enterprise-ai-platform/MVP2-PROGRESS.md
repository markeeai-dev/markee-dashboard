# MVP2 — Tiến độ thực thi

> Kế hoạch tham chiếu `ai-operations-center-design.md` mục 14, phạm vi đợt này đã chốt trong
> plan: 3 hạng mục ưu tiên cao nhất tài liệu tự nêu (AI Timeline/Inbox, Request Span đầy đủ,
> Handoff sinh bằng LLM). Nhật ký PASS/FAIL thật, không phải kế hoạch.

## Hạng mục 1 — AI Timeline + AI Inbox (Q14)

**PASS — 27/27 test-harness (tăng từ 25), thêm 2 endpoint đọc, không bảng mới.**

- `GET /v1/timeline?project_id=` — union theo thời gian trên `work_sessions/checkpoints/handoffs`
  đã có, không tạo bảng mới (đúng tinh thần Q14 "view, không phải bảng mới").
- `GET /v1/inbox?employee_id=` — 2 phần: task đang giao trực tiếp (`assignee_employee_id`),
  và task có handoff mới mà CHƯA có Work Session nào (của ai) mở sau thời điểm handoff đó
  (tính bằng `NOT EXISTS`, không cần cột "đã đọc" mới).
- Dashboard (`spike/dashboard/index.html`) thêm 2 tab **Inbox**, **Timeline** (Timeline có
  dropdown chọn project — sửa 1 bug thật lúc build: đọc giá trị dropdown SAU khi
  `switchTab()` đã xoá DOM để "Đang tải…" sẽ luôn ra giá trị rỗng, phải lưu lựa chọn vào
  `state` ngay trong `onchange` trước khi tab bị xoá). Trang chủ đổi ô "Cần tiếp quản" dùng
  đúng Inbox thay vì liệt kê handoff gần nhất thô như MVP1.
- Test thật: Thanh publish handoff cho `task_tng142` → xác nhận Inbox của Hoàng thấy ngay
  (trước khi ai mở Work Session mới) → xác nhận Timeline project có đủ sự kiện handoff +
  checkpoint vừa tạo.

## Hạng mục 2 — Request Span đầy đủ

Đang làm.

## Hạng mục 3 — Handoff tự động sinh bằng LLM

Chưa bắt đầu — phụ thuộc Hạng mục 2 xong.
