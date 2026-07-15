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

**PASS — 30/30 test-harness (tăng từ 27), test cả trên đường mock lẫn traffic thật.**

- Bảng mới `request_spans` (`spike/control-plane/migrations/002_request_spans.sql`) —
  latency_ms, input/output/cached_tokens, estimated_cost_usd (bảng giá tĩnh
  `spike/control-plane/pricing.js`, ghi rõ là ước lượng không phải billing chuẩn).
- Endpoint nội bộ `POST /internal/v1/gateway/request-spans` — xác thực bằng
  `CENTERAI_INTERNAL_SERVICE_SECRET` riêng (không phải employee_token, Adapter không phải
  nhân viên), và `GET /v1/cost-summary?project_id=` cho dashboard/quản lý xem sau này.
- **Gateway Adapter sửa thành phần nhạy cảm nhất đang chạy thật** — thêm đo `latency_ms`,
  tap song song luồng response (đồng thời với `pipe()` đang stream về client, không chặn/đổi
  gì luồng chính) để trích `usage` bằng regex best-effort (lấy occurrence CUỐI CÙNG của mỗi
  field — đúng cho cả non-streaming lẫn streaming SSE tăng dần), gửi span lên Control Plane
  async fire-and-forget SAU khi đã trả lời client xong.

**Quy trình test kỹ trước khi coi là xong** (đúng yêu cầu không được phá Adapter đang chạy
thật):
1. Chạy lại bộ test mock gốc (`spike/test-harness/run-test.js`) — 7/7 PASS, xác nhận cô lập
   seat + streaming vẫn đúng sau khi sửa.
2. Deploy, gọi thật 1 request non-streaming qua Adapter công khai — xác nhận span lưu đúng
   100% (`input_tokens=29, output_tokens=19`, cost tính đúng khớp công thức tay).
3. Chạy lại Claude Code CLI thật qua `company-ai claude` (tool-use + streaming thật, giống
   hệt kịch bản Bước 0/3 MVP1) — xác nhận **vẫn hoạt động đúng, không vỡ gì** — đồng thời xác
   nhận span của request streaming cũng trích đúng usage (kể cả `cached_tokens` — thấy đúng
   ~55.000 token cache hit thật trong dữ liệu lưu).
4. Kiểm tra `systemctl status center-ai-adapter` sau toàn bộ test — service vẫn `active`, không
   crash-loop.

## Hạng mục 3 — Handoff tự động sinh bằng LLM

**PASS — 32/32 test-harness (tăng từ 30), test thật qua CLI đầy đủ (không mock).**

- Control Plane thêm `POST /v1/work-sessions/:id/draft-handoff` — đọc checkpoints thật +
  git log/diff CLI gửi kèm, tự mint 1 token gateway ngắn hạn (5 phút, chỉ đủ 1 lần gọi, khác
  hẳn token Tool Session thật) cho đúng seat của nhân viên, gọi thật qua Gateway Adapter công
  khai (model `cc/claude-sonnet-5`) với prompt yêu cầu **bám sát đúng dữ liệu đưa vào, không
  bịa thêm việc không có** — trả về text draft tiếng Việt, 2 phần "Đã làm"/"Còn lại".
- CLI (`company-ai end`) gọi endpoint này trước, dùng draft AI làm gợi ý nếu thành công (người
  dùng vẫn xem lại/publish như cũ, KHÔNG tự động publish) — lỗi/timeout thì fallback êm về
  draft git-diff thuần của MVP1, không chặn lệnh. Thêm cờ `--no-ai` để chủ động bỏ qua AI.

**Test thật qua CLI đầy đủ**: Claude Code tạo commit thật ("Add time filter stub per BA
feedback") → `company-ai end` gọi AI thật → draft sinh ra **bám sát chính xác** commit hash
và nội dung thật, đồng thời trung thực báo "chưa rõ đã implement đầy đủ logic hay chưa — cần
kiểm tra lại" thay vì bịa thêm chi tiết không có — đúng yêu cầu "không bịa" trong prompt. Test
riêng đường `--no-ai` (fallback hoạt động đúng, không gọi AI). Hoàng đọc lại đúng handoff mới
nhất qua `company-ai claude` như bình thường — downstream không phân biệt handoff AI-soạn hay
git-diff thuần, dùng chung 1 luồng.

## MVP2 (đợt 1) — Kết luận

**PASS toàn bộ 3 hạng mục**, đúng đúng phạm vi đã chốt trong plan, không lấn sang việc cố tình
hoãn (vector search, browser extension, connector Codex, task claim/lease đầy đủ). Test-harness
tăng từ 25 (cuối MVP1) lên **32/32 PASS**, toàn bộ đều test bằng traffic thật, không mock,
2 hạng mục sau cùng còn xác nhận qua CLI thật với Claude Code CLI thật.
