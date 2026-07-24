# Phân công 3 dev

> Tham chiếu kiến trúc đầy đủ: `ai-operations-center-design.md`. Tài liệu spike: `MVP0-SPIKE.md`.

## Thứ tự bắt buộc

```
MVP 0 — Gateway Feasibility Spike (1 người dẫn, xong mới khoá contract)
        ↓ PASS
MVP 1 — 3 track chạy song song, theo API contract đã khoá
```

Không chia 3 track làm song song với spike — spike quyết định cả nhánh Gateway Adapter có tồn tại hay không, tất cả phần khác đứng chờ kết quả trước khi khoá interface giữa các track.

## 3 track cho MVP 1 (sau khi spike PASS)

### Track A — CLI wrapper (máy nhân viên)

**Sở hữu:** `company-ai login/claude/codex/status/checkpoint/end/init`

**Việc cụ thể** (theo Q24.2-24.6, Q24.8):
- Nhận diện nhân viên (login), đọc Git root, map repo → project (`.center-ai/project.yaml`).
- Cho chọn task, resume/tạo Work Session (idle timeout 6h, không dùng "cùng ngày" — Q18/Q24.5).
- Tạo Tool Session, chụp Git snapshot (HEAD/branch — không phải trailer).
- Render context vào `.center-ai/generated/*.md`, `company-ai init` gắn marker 1 lần vào `CLAUDE.md`/`AGENTS.md`.
- Mở Claude Code/Codex như tiến trình con, set runtime env (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `CENTER_AI_*` — **chỉ để log/debug, không phải nguồn tin**, Adapter chỉ tin claims trong `ANTHROPIC_AUTH_TOKEN`, xem Q24.2).
- Tool thoát: đóng Tool Session, checkpoint, revoke token Tool Session — **không** tạo handoff.
- `company-ai end`: tổng hợp Tool Session + Git range/diff + checkpoints → handoff draft → review/publish → đóng Work Session.

**Phụ thuộc vào:** API `POST /v1/work-sessions`, `POST /v1/work-sessions/{id}/end`, `POST /v1/work-sessions/{id}/tool-sessions`, `POST /v1/tool-sessions/{id}/checkpoints`, `/v1/context/render`, `/v1/handoffs` (Track C cung cấp — đã đổi từ `/v1/agent/*` sang resource-style, xem mục 12) + token gateway do Track B cấp lúc mở Tool Session.

**Không phụ thuộc kết quả spike theo hướng chặn cứng** — có thể bắt đầu code phần đọc Git/repo/task selection song song với spike, chỉ phần "mở tool với token gateway" cần chờ contract từ Track B.

### Track B — Gateway Adapter (routing + telemetry, KHÔNG sở hữu vòng đời container)

**Sở hữu:** Center AI Gateway Adapter — routing runtime, không phải hạ tầng container (đó là Track C, xem dưới).

**Đã có code khung** (`spike/gateway-adapter/`, `spike/shared/token.js`) — đã tự test bằng mock router, 7/7 tiêu chí Nhóm A + streaming PASS (chi tiết `MVP0-SPIKE.md` mục 6, cách chạy lại ở `spike/README.md`). **Việc còn lại của Track B**: dựng 9Router thật (N container, N = số người pilot), đổi `registry.json` trỏ sang endpoint thật thay vì mock-router, chạy lại test-harness để xác nhận Nhóm A vẫn PASS với 9Router thật, rồi bổ sung test Nhóm B (tool-use/caching/OAuth refresh thật) — không cần viết lại Adapter từ đầu.

**Việc cụ thể** (theo Q9, Q24.9, Q24.10):
- Dẫn spike MVP 0 trước tiên — dựng N container 9Router (N = số người pilot) để test, mỗi cái 1 volume OAuth riêng, 1 internal port riêng.
- Sau PASS: xác thực token nghiệp vụ (chữ ký, claims, hạn dùng, `context_bundle_id`/hash — Q18).
- Resolve `employee_id/project_id/task_id/work_session_id/tool_session_id`.
- Kiểm tra `seat_id` (không chỉ `employee_id` — 1 người có thể có nhiều seat: Claude seat, Codex seat, company shared API) có đang gán cho `employee_id` này không, `tool`/`provider` có được phép theo seat đó không.
- Tra **Seat Runtime Registry** theo `seat_id` (Track C sở hữu bảng, Track B chỉ đọc) để route đúng instance — cô lập vật lý theo container, không dựa vào `pool_type` cấu hình bên trong 1 instance dùng chung.
- **Mặc định Metadata enforcement — không sửa body request** (Q9): metadata nằm trong token/header, verify server-side, request đi qua gần như nguyên vẹn. Prompt enforcement (parse/sửa body để tiêm policy bắt buộc) chỉ code khi có yêu cầu cụ thể, không phải mặc định — giảm rủi ro phá streaming/caching/tool-use ngay từ MVP0/1.
- Tạo Request Span theo đúng tầng đang làm (MVP0: tối giản; MVP1: cơ bản; MVP2: đầy đủ — xem mục 15 tài liệu chính).
- Forward sang đúng container 9Router bằng credential nội bộ, nhận routing telemetry, join qua `gateway_request_id`.

**Phụ thuộc vào:** không phụ thuộc Track A/C để bắt đầu — đây là track có thể tự chạy độc lập nhất, và là track **chặn đường** cho 2 track kia ở phần "gọi AI thật qua gateway" (nhưng không chặn phần schema/CLI logic không liên quan tới gateway).

### Track C — Control Plane: Identity, Project/Task, Context, Handoff, Analytics, vòng đời Seat Runtime

**Sở hữu:** database schema (mục 11), API endpoints còn lại (mục 12), Context Service, Handoff, seat registry, **và vòng đời container 9Router** (nối vào state machine seat đã có ở Q1: `assigned` → tạo container/attach volume; `suspended` → tạm dừng; `revoked` → destroy — xem Q9).

**Việc cụ thể** (theo Q1, Q5, Q9, Q11-Q16, Q22, mục 11-12):
- Schema tối giản cho MVP 1: `employees`, `projects`, `tasks`, `work_sessions`, `tool_sessions`, `checkpoints`, `project_context`, `handoffs`, `seats` (có `id` = `seat_id`), `seat_runtime_registry` (khoá theo `seat_id`, không phải `employee_id`).
- API: `/v1/context/retrieve`, `/v1/context/render`, `/v1/handoffs`, `POST /v1/work-sessions`, `POST /v1/work-sessions/{id}/tool-sessions`, `POST /v1/tool-sessions/{id}/checkpoints` (backend logic, đổi từ `/v1/agent/*`, Track A gọi vào).
- Trigger create/suspend/revoke/destroy container khi seat đổi trạng thái — Track B chỉ đọc registry, không tự quản lý container.
- Dashboard tối giản 5 màn (Q24.10): Projects & Tasks, Active Sessions, Handoffs, Project Memory, Seats & Employees.

**Phụ thuộc vào:** không phụ thuộc kết quả spike — toàn bộ track này giữ nguyên giá trị dù spike PASS hay FAIL (đây chính là lý do tài liệu gốc nhấn mạnh Project Continuity là moat, không phải gateway).

## Việc có thể làm ngay, song song với spike (không cần chờ)

- Track A: CLI skeleton — parse Git root, đọc `.center-ai/project.yaml`, UI chọn task (chưa cần gọi API thật, mock được).
- Track C: schema + API Context/Handoff/Work Session, không đụng gì tới Gateway Adapter.
- Track B: chạy spike.

## Việc phải chờ spike PASS mới làm

- Track A: phần mở Claude Code với token gateway thật, set `ANTHROPIC_BASE_URL` trỏ Adapter.
- Track B: mọi phần ngoài phạm vi spike (Request Span đầy đủ, pool_type enforcement production-grade).
- Cả 3 track: khoá API contract cuối cùng giữa CLI ↔ Control Plane ↔ Gateway Adapter.

## Nếu spike FAIL

Track B chuyển sang: Lane B connector (nhận usage qua hook/admin analytics của provider nếu có, không qua Adapter/9Router cho Claude Code CLI). Track A và Track C **không đổi gì** — đây chính là lý do tách track theo cách này, để 1 kết quả spike không làm hỏng công sức của cả 3 người.

## Checklist trước khi bắt đầu MVP 1 (sau spike)

- [ ] Spike PASS/FAIL đã có kết luận bằng văn bản (điền vào cuối `MVP0-SPIKE.md`).
- [ ] API contract giữa 3 track đã viết ra thành OpenAPI/markdown ngắn (dựa mục 12 tài liệu chính), cả 3 người đã đọc và đồng ý.
- [ ] Schema MVP 1 tối giản đã chốt (dựa mục 11, bỏ bớt bảng chưa cần ở MVP 1: `customers/meetings/documents/incidents/decision_detail/pattern_library` — để MVP 2/3).
- [ ] Repo code đã tạo, mỗi track 1 thư mục/service riêng, không chia sẻ database trực tiếp giữa CLI và Adapter (chỉ qua API).
