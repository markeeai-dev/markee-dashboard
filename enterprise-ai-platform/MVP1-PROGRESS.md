# MVP1 — Tiến độ thực thi

> Kế hoạch đầy đủ tham chiếu `ai-operations-center-design.md` mục 14-15, `TEAM-SPLIT.md`.
> File này ghi kết quả thật theo từng bước, cập nhật liên tục — không phải kế hoạch, là nhật ký PASS/FAIL.

## Bước 0 — Đóng decision gate MVP0 (Nhóm B còn lại)

**PASS.** Chi tiết đầy đủ ở `MVP0-SPIKE.md` mục 6. Tóm tắt: Claude Code CLI thật (v2.1.210)
qua đúng domain công khai `valeron.tech` — streaming, tool-use agent loop thật, usage/caching/
stop_reason/error format đều đúng. Phát hiện + đã ghi nhận: CLI phải tự truyền đúng
`--model cc/<model>`, không dựa alias mặc định.

## Bước 1 — Control Plane: schema + API tối giản

**PASS — 18/18 tiêu chí test-harness, bao gồm 1 test tích hợp thật với Gateway Adapter.**

Đã dựng:
- Postgres 16 (Docker, `center-ai-pg`, chỉ `127.0.0.1:5432`, volume `/srv/center-ai-pg`) trên droplet `103.253.146.113`.
- Schema 10 bảng (`spike/control-plane/schema.sql`) — đúng 9 bảng đã chốt ở `TEAM-SPLIT.md` (seat_runtime_registry tách khỏi seats).
- Control Plane service (`spike/control-plane/server.js`, Node thuần, không framework) — chạy qua systemd `center-ai-control-plane`, bind `127.0.0.1:8090`.
- Seed dữ liệu pilot (`seed.js`): `emp_thanh`, `emp_hoang`, 2 seat khớp đúng `registry.json` thật đang dùng ở Gateway Adapter, 1 project + 1 task demo.
- Employee login tối giản (email -> token ký HMAC riêng, secret khác với secret gateway).
- Mint `gateway_token` khi mở Tool Session — **đã xác nhận token này dùng được thật với Gateway Adapter công khai** (gọi `https://valeron.tech/v1/messages`, Claude thật trả lời đúng).

**Test-harness** (`spike/control-plane/test-harness/run-test.js`) chạy trên droplet, 18/18 PASS:
login (3), list project/task (3), Work Session tạo/resume đúng seat cho cả 2 người (3), Tool Session + mint token + **gọi thật qua Gateway Adapter** (2), checkpoint + đóng Tool Session (2), publish handoff + đóng Work Session (2), Hoàng đọc đúng handoff của Thanh qua `context/render` (2), chặn Hoàng thao tác Work Session của Thanh — 403 (1).

**Phát hiện thật đáng chú ý**: 9Router nối thêm `data: [DONE]` ngay sau JSON ở response
non-streaming, không có dấu phân cách — xác nhận bằng `xxd` trực tiếp trên 9Router (bypass
Adapter), nên là hành vi gốc 9Router. Bất kỳ client dùng `JSON.parse` nghiêm ngặt phải tự cắt
trailer này trước khi parse (đã xử lý trong test-harness, ghi chi tiết ở `control-plane/README.md`).

**Chưa làm trong Bước 1 (đúng phạm vi đã khoá, không tự mở rộng)**: vòng đời container 9Router
tự động theo seat state machine, workflow duyệt gán/thu hồi seat, `/v1/seats` API đầy đủ —
để MVP2 theo đúng roadmap.

## Bước 2 — CLI wrapper `company-ai`

**PASS.** `spike/cli/` — `login/init/claude/codex/status/checkpoint/end` đúng theo Q24.2.
Gọi Control Plane thật qua `cp.valeron.tech`, mở Claude Code thật qua `spawn` (không mock).

3 bug thật tìm thấy và sửa khi test bằng traffic thật (chi tiết `spike/cli/README.md`):
Windows npm shim `.cmd` gây `ENOENT`; `shell:true` + args mảng vỡ quoting (`git commit -A`
bị hiểu sai) — sửa bằng `cross-spawn`; nhiều `readline.Interface` liên tiếp trên stdin đã
pipe làm treo câu hỏi thứ 2 trở đi (chỉ ảnh hưởng automation/pipe, không ảnh hưởng TTY thật)
— sửa bằng dùng chung 1 interface suốt vòng đời lệnh, thêm cờ `--yes`/`--open-issues` cho
automation.

Cũng vá 1 lỗ hổng thật trước khi public hoá Control Plane: `/v1/auth/login` ban đầu chỉ cần
email, không xác thực gì — bất kỳ ai biết email công ty đều mint được token thật (kể cả
gateway_token cấp quyền AI thật) của người khác. Đã thêm `access_code` bắt buộc (chia sẻ
ngoài băng thông, không phải SSO thật — đủ cho pilot vài người, phải nâng cấp thật trước khi
scale). Control Plane cũng đã public hoá qua `https://cp.valeron.tech` (nginx + Let's Encrypt,
cùng pattern với Adapter/dashboard) để CLI gọi được từ máy nhân viên thật.

## Bước 3 — Test kịch bản POC đầy đủ (mục 15) — bằng chứng giá trị thật

**PASS — chạy bằng hạ tầng thật, 2 seat Claude thật, không có bước nào giả lập.**

1. `company-ai login` (Thanh) → `init` → `claude` — Claude Code thật đọc `facebook.service.ts`,
   thêm hàm `pagination()`, tự chạy `git commit` thật (qua Bash tool của chính Claude Code) —
   xác nhận bằng `git log` thật: commit `1b0d346 Add pagination stub`.
2. `company-ai end --open-issues "BA yeu cau filter theo thoi gian"` → publish handoff thật,
   đóng Work Session.
3. `company-ai login` (Hoàng, seat khác hẳn — `seat_claude_hoang`) → `claude` cùng task → yêu
   cầu Claude Code (dưới quyền Hoàng) tóm tắt lại context — **Claude trả lời đúng 100%**: nhắc
   đúng commit `1b0d346 Add pagination stub` của Thanh và đúng open issue "filter theo thời
   gian" — dữ liệu này đến hoàn toàn qua Control Plane -> `.center-ai/generated/checkpoint.md`
   -> marker `CLAUDE.md` -> Claude Code tự đọc, không có bước chuyển giao thủ công nào giữa
   Thanh và Hoàng.

→ **Đây là bằng chứng trực tiếp cho luận điểm sản phẩm cốt lõi** (mục 15: "người tiếp quản
task hiểu toàn bộ tiến độ trong vài phút thay vì phải hỏi lại đồng nghiệp") — chạy thật, không
phải mô tả lý thuyết.

## Bước 4 — Dashboard tối giản

Chưa làm — không chặn đường (kịch bản POC ở Bước 3 không cần dashboard, đúng như mục 15 đã
ghi). Cân nhắc làm tiếp nếu còn thời gian, ưu tiên thấp hơn việc hoàn thiện phần còn thiếu ở
Bước 2 (test `codex`, checkpoint theo git hook).
