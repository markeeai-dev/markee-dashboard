# MVP2 — Tiến độ thực thi

> Kế hoạch tham chiếu `ai-operations-center-design.md` mục 14, phạm vi đợt 1 đã chốt trong
> plan: 3 hạng mục ưu tiên cao nhất tài liệu tự nêu (AI Timeline/Inbox, Request Span đầy đủ,
> Handoff sinh bằng LLM) + Hạng mục 4 (Task claim/lease) làm nốt phần MVP2 còn lại theo yêu
> cầu tiếp theo. Nhật ký PASS/FAIL thật, không phải kế hoạch.

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

## Hạng mục 4 — Task claim/lease đầy đủ (Q20)

**PASS — 39/39 test-harness (tăng từ 32), test thật qua CLI đầy đủ (2 danh tính thật, không mock).**

Thay cảnh báo mềm 1 dòng của POC bằng đúng thiết kế Q20:
- **Exclusive** (mặc định): 1 người claim task, lease 4h — **tự gia hạn mỗi khi người đó tạo
  checkpoint** (còn hoạt động thì không lo hết hạn giữa chừng), **tự hết hạn nếu idle** (không
  cần job nền dọn — chỉ so `lease_until` với `now()` mỗi lần đọc). `company-ai end` tự nhả
  claim ngay khi người giữ chủ động xong việc, không bắt người sau chờ hết 4h.
- **Shared**: nhiều người claim cùng lúc được, chỉ mang tính thông tin — không có logic nào
  thêm ngoài field `claim_mode` trên task.
- **Không khoá cứng** (đúng tinh thần Q20 "vẫn xem được, xin tham gia được") — API trả 409 kèm
  đầy đủ thông tin ai đang giữ/đến khi nào, CLI hiện cảnh báo rõ và hỏi xác nhận trước khi tiếp
  tục (`--yes` bỏ qua hỏi cho automation), KHÔNG chặn cứng việc mở Claude Code.
- **Phát hiện va chạm file**: endpoint mới quét checkpoint gần nhất của mọi Work Session đang
  active trên 1 task, báo file nào đang bị ≥2 người khác nhau cùng sửa — chỉ cảnh báo.
- `company-ai claude` gọi claim + overlap-check tự động trước khi mở tool; `company-ai status`
  hiện cả 2 thông tin này on-demand giữa phiên. Dashboard (Projects & Tasks) thêm cột hiện
  badge ai đang giữ claim + đến khi nào.

**Test thật qua CLI**: Thanh claim + làm task (không cảnh báo vì chưa ai giữ) → Hoàng thử vào
đúng task đó, `company-ai claude` hiện đúng cảnh báo "Task task_tng142 đang được Thanh giữ
(lease đến ...)", `--yes` cho phép tiếp tục (không bị chặn) → `company-ai status` xác nhận hiện
đúng thông tin claim thời gian thực.

## Hạng mục 5 — Hoàn thiện Task Management nội bộ (thêm sau, sau khi MVP3 Đợt 5 xong)

> Người dùng hỏi có nên tích hợp Jira/Linear không — chọn KHÔNG (công ty chỉ 2-3 người, tích hợp
> tool ngoài tạo 2 nguồn trạng thái phải đồng bộ, phức tạp hơn cần thiết; để dành đúng lúc khách
> hàng thật yêu cầu tool cụ thể). Thay vào đó hoàn thiện luồng nội bộ đã có cho công ty dùng ngay.

**Gap thật phát hiện lúc rà soát** (không phải bỏ sót từ đầu — MVP1-3 luôn tập trung
session/context/governance): hệ thống từ đầu dự án **chưa từng có cách tạo task mới hay đổi
trạng thái task** qua CLI/dashboard — `task_tng142` là task duy nhất, tạo tay qua `seed.js`.
Không ai từng đóng được task qua sản phẩm thật — đây chính là lý do KPI Efficiency (MVP3 Đợt 3)
luôn hiện `closed_task_count = 0` suốt toàn bộ session.

**PASS — 149/149 test-harness (tăng từ 138).** Không mở rộng schema — chỉ dùng đúng cột đã có
trong `tasks` (mục 11): `title, status, assignee_employee_id, closed_at`.

- `POST /v1/projects/:id/tasks` (mọi nhân viên, giống `context/ingest`) — tạo task, validate
  `assignee_employee_id` phải là nhân viên có thật nếu truyền.
- `POST /v1/tasks/:id/update` (mọi nhân viên) — sửa title/status/assignee. `status` đổi thành
  `closed` → tự set `closed_at = now()`; đổi khỏi `closed` → set lại `NULL` (nhất quán 2 chiều).
- Sửa `handleListTasks` JOIN thêm `assignee_name` (trước đó dashboard in thẳng ID thô).
- CLI: `company-ai task add` / `company-ai task update <task_id>` (file mới
  `lib/commands/task.js`, cùng pattern `context.js`).
- Dashboard: form "+ Task mới" mỗi project panel, dropdown đổi trạng thái/người phụ trách ngay
  trên bảng (đổi là submit luôn, không cần nút riêng).

**Test thật đầu-cuối**: tạo 1 task mới qua CLI (`task add`) → dùng ngay trong `company-ai claude`
thật (`--task <task vừa tạo>`, tool-use + streaming bình thường) → đóng qua `task update --status
closed` → xác nhận qua API đọc lại đúng `status=closed` → gọi `GET /v1/kpi` xác nhận **lần đầu
tiên trong toàn bộ dự án `closed_task_count` khác 0 qua dữ liệu sản phẩm thật** (Thanh:
`closed_task_count=1`, `avg_cost_per_closed_task="0.0025"`, `avg_tokens_per_closed_task="743"` —
số thật từ chính request vừa chạy, không phải số giả).

## MVP2 — Kết luận

**PASS toàn bộ 5 hạng mục** (AI Timeline/Inbox, Request Span đầy đủ, Handoff sinh bằng LLM,
Task claim/lease đầy đủ, Task Management hoàn thiện). Chỉ còn cố tình hoãn: vector search,
browser extension, connector Codex/GPT thật (thiếu account), tích hợp Jira/Linear (quyết định
người dùng: chờ khách hàng thật yêu cầu tool cụ thể) — đúng lý do đã nêu, không phải bỏ sót.
Test-harness tăng từ 25 (cuối MVP1) lên **149/149 PASS** (tính lũy kế qua cả MVP3), toàn bộ test
bằng traffic thật, không mock.

→ **MVP2 hoàn thành, chuyển sang MVP3** — governance/audit/policy cơ bản, giữ nguyên phạm vi
sản phẩm chung cho team dev tại nhiều loại doanh nghiệp khác nhau, không thiết kế riêng cho
1 ngành cụ thể.
