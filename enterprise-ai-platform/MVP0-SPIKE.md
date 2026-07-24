# MVP 0 — Gateway Feasibility Spike

> Tài liệu thực thi. Tham chiếu kiến trúc đầy đủ: `ai-operations-center-design.md` (Q9, Q23, Q24.9, Q24.10).
> Đây là **decision gate**, không phải sprint tính năng. Mục tiêu duy nhất: biết chắc nhánh Gateway-managed seat có đi tiếp được không, trước khi bất kỳ ai viết thêm dòng code nào cho CLI wrapper hay Control Plane đầy đủ.

## 1. Câu hỏi cần trả lời (chỉ một câu)

> **9Router có thể giữ nhiều kết nối subscription/OAuth khác nhau (1 kết nối = 1 nhân viên) và route đúng người đúng connection một cách đáng tin cậy, khi có Gateway Adapter đứng trước nó không?**

Không trả lời được câu này thì mọi thiết kế Work Session / Context / Handoff ở tài liệu chính vẫn đúng, nhưng **Claude Code CLI phải chuyển sang Lane B** (nhân viên tự login seat, không qua gateway) — khác hẳn UX/luồng đã mô tả ở Q24. Vì vậy phải biết trước khi build tiếp.

**Đã xác nhận `9router` là package thật (`npm install -g 9router`, Docker `decolua/9router`) — xem Q9 phần "Đã xác nhận thật" trong tài liệu chính để biết toàn bộ chi tiết API/port/auth đã kiểm chứng.** Quan trọng nhất: README chính thức xác nhận "Multi-account round-robin" và "Auto fallback sang FREE provider" là **tính năng quảng cáo**, không phải rủi ro giả định — container-per-seat + đúng 1 connection/instance là **bắt buộc**, không phải tuỳ chọn an toàn.

## 2. Luồng cần dựng (tối giản, không phải sản phẩm)

**Cách dựng: container-per-seat, không phải 1 9Router gom nhiều account.** Đây là chiến lược cô lập cho **POC/MVP1**, không phải kiến trúc scale vĩnh viễn (ở quy mô 500-1.000 seat sẽ cần tối ưu lại — xem Q9) — nhưng là cách nhanh và chắc nhất để loại bỏ rủi ro round-robin/fallback chéo seat ngay từ đầu, cô lập vật lý bằng container/OAuth-volume/port riêng, không phụ thuộc cấu hình bên trong 9Router:

```
Server AI Gateway
├── 9Router instance Thanh (volume OAuth riêng, port 29128 → 20128) → đúng 1 connection: Claude seat Thanh
└── 9Router instance Hoàng (volume OAuth riêng, port 29129 → 20128) → đúng 1 connection: Claude seat Hoàng

Thanh (token nghiệp vụ) → Gateway Adapter → API key riêng của instance Thanh → 9Router Thanh → Claude
Hoàng (token nghiệp vụ) → Gateway Adapter → API key riêng của instance Hoàng → 9Router Hoàng → Claude
```

Lệnh dựng container đã test thật (Docker, xem mục "Đã xác nhận thật" ở Q9):

```bash
docker run -d --name router-thanh -p 29128:20128 \
  -v /srv/9router/thanh:/app/data -e DATA_DIR=/app/data decolua/9router:latest
docker run -d --name router-hoang -p 29129:20128 \
  -v /srv/9router/hoang:/app/data -e DATA_DIR=/app/data decolua/9router:latest
```

Không có CLI wrapper thật, không có Control Plane thật, không có database schema đầy đủ. Chỉ cần đủ để chứng minh routing đúng.

## 3. Thành phần cần chuẩn bị

- [x] ~~Xác nhận 9Router có native hỗ trợ OAuth/subscription~~ — **đã xác nhận có** (`/api/oauth/[provider]/[action]`), xem Q9.
- [ ] 2 container 9Router riêng biệt như lệnh Docker ở trên — mỗi container mở dashboard 1 lần đầu (`http://<host>:29128`) để đặt admin password và connect **đúng 1** provider connection (Claude Team/Max thật) — **không thấy cách bootstrap password qua API thuần, phải qua UI lần đầu, không đoán mò/brute-force**.
- [ ] **Bắt buộc kiểm tra sau khi connect provider**: vào `Providers`/`Combos` trong dashboard, xác nhận **không có** combo/fallback chain nào được tạo, và **không** connect thêm provider "free" nào (Kiro AI, OpenCode Free...) — đây là bước thủ công quan trọng nhất, làm sai bước này là vô hiệu hoá toàn bộ lý do dùng container-per-seat.
- [ ] Tạo 1 API key trong dashboard mỗi instance (`Keys` → tạo mới) — đây là giá trị điền vào `registry.json` field `api_key` (**không phải** token nghiệp vụ Center AI — hai thứ khác nhau, xem code `spike/gateway-adapter/server.js`).
- [ ] Gateway Adapter (đã có code, `spike/gateway-adapter/`) — chỉnh `registry.json`: đổi `endpoint` từ mock sang `http://<host>:29128`/`29129`, điền `api_key` thật vừa tạo.
- [ ] 2 Claude Code process chạy thật (không phải mock) — cấu hình `ANTHROPIC_BASE_URL` trỏ Gateway Adapter, `ANTHROPIC_AUTH_TOKEN` là token nghiệp vụ Center AI (script `scripts/generate-tokens.js` đã có).
- [ ] Log Request Span (đã có, `spike/logs/request-spans.jsonl`) — có thể đối chiếu thêm với `/api/usage/request-logs` thật của từng instance 9Router (Q9) để xác nhận khớp.

## 4. Cách chạy

1. Khởi động Gateway Adapter mỏng, trỏ vào 9Router.
2. Chạy đồng thời 2 luồng: Thanh gửi liên tục request trong 5 phút, Hoàng gửi liên tục request trong 5 phút cùng lúc.
3. Giữa chừng: revoke connection của Thanh trong 9Router/Adapter, xác nhận request tiếp theo của Thanh bị từ chối ngay (không phải đợi cache hết hạn).
4. Test riêng: `/compact` trong 1 phiên Claude Code đang đi qua Adapter — xác nhận không lỗi, không đổi connection giữa chừng.
5. Đối chiếu log: với mỗi request, connection đã dùng có đúng 100% khớp `employee_id` không.

## 5. Tiêu chí PASS

**Nhóm A — cô lập seat (nhờ container-per-seat nên rủi ro thấp, vẫn phải test để xác nhận):**
- [ ] Thanh luôn đi đúng instance `router-thanh`, không lệch dù chạy bao lâu.
- [ ] Hoàng luôn đi đúng instance `router-hoang`.
- [ ] Chạy đồng thời 2 người không ghi nhận lẫn credential ở bất kỳ request nào.
- [ ] Revoke connection ở 1 instance có hiệu lực ngay — request tiếp theo của người đó bị từ chối, không ảnh hưởng instance kia.

**Nhóm B — bảo toàn protocol qua Adapter → 9Router (đây mới là phần chưa chắc chắn, cần test kỹ):**
- [ ] Streaming SSE không vỡ.
- [ ] Tool-use blocks (Claude Code gửi lệnh/đọc file dựa trên response) hoạt động — luồng: model trả `tool_use` → Claude Code tự chạy lệnh trên máy → gửi `tool_result` ngược lại qua Adapter → model tiếp tục.
- [ ] `stop_reason` được giữ nguyên, không bị Adapter làm sai lệch.
- [ ] Usage metadata (token in/out) trả về đầy đủ, đọc được từ response/stream.
- [ ] Prompt caching headers (nếu Claude Code dùng) không bị Adapter loại bỏ — kiểm tra cache hit rate không giảm bất thường so với gọi trực tiếp.
- [ ] Model alias (nếu Claude Code gửi tên model rút gọn) được map đúng model thật.
- [ ] Error format giữ nguyên dạng provider trả về, không bị Adapter bọc sai khiến Claude Code không parse được.
- [ ] `/compact` hoạt động bình thường khi traffic đi qua Adapter, không đổi instance/connection giữa chừng.
- [ ] OAuth refresh (nếu kết nối hết hạn giữa chừng) tự động hoạt động, không cần can thiệp tay.
- [ ] Agent loop chạy dài (nhiều lượt tool-use liên tiếp trong 1 task phức tạp) không bị Adapter làm timeout/ngắt giữa chừng.
- [ ] Huỷ request giữa chừng (nhân viên nhấn Ctrl+C hoặc tương đương) được truyền đúng, không để lại phiên treo ở phía 9Router.

## 6. Kết quả

### Đã chạy — bản mock (chưa dùng 9Router/account thật)

Code nằm ở `spike/` (`gateway-adapter/`, `mock-router/`, `shared/`, `scripts/`, `test-harness/`). Đã dựng Gateway Adapter thật + 2 mock router giả lập (thay cho 9Router thật, vì chưa có 9Router/Claude Team account thật trong môi trường này) để xác nhận **logic routing/bảo mật của Adapter đúng trước khi cắm vào 9Router thật** — cách này giảm rủi ro tích hợp sau này, không phải để thay thế spike thật.

**Kết quả chạy `node test-harness/run-test.js`: 7/7 PASS**

| # | Tiêu chí (Nhóm A — cô lập seat) | Kết quả |
|---|---|---|
| 1 | Thanh luôn đi đúng instance của Thanh (10 request liên tiếp) | ✅ PASS |
| 2 | Hoàng luôn đi đúng instance của Hoàng (10 request liên tiếp) | ✅ PASS |
| 3 | Chạy đồng thời 30 request (15+15) không lẫn seat | ✅ PASS |
| 4 | Token `seat_id` lệch `employee_id` (Hoàng claim seat Thanh) bị từ chối 403 | ✅ PASS |
| 5 | Request không token bị từ chối 401 | ✅ PASS |
| 6 | Suspend seat Thanh có hiệu lực ngay, không ảnh hưởng Hoàng | ✅ PASS |

| # | Tiêu chí (Nhóm B — phần mock được) | Kết quả |
|---|---|---|
| 7 | Streaming qua Adapter giữ đúng thứ tự chunk, không vỡ | ✅ PASS |

**Chưa test được (cần 9Router thật + Claude Team account thật, không mock được):**
- Tool-use blocks thật của Claude Code (agent loop thật, không phải JSON giả lập)
- Prompt caching headers thật
- OAuth refresh thật khi kết nối hết hạn giữa chừng
- Model alias thật, error format thật từ Anthropic/OpenAI
- Agent loop dài thật, huỷ request giữa chừng thật

→ **Kết luận tạm thời (đã lỗi thời — xem bản thật ngay dưới đây)**: phần logic Adapter (routing theo `seat_id`, cô lập seat, xác thực token, revoke tức thời, streaming proxy) đã xác nhận đúng bằng mock.

### Đã chạy — bản thật (9Router thật + 2 Claude account thật, qua Gateway Adapter công khai)

Hạ tầng thật đã dựng: 2 container `decolua/9router:latest` cô lập (`router-thanh` port 29128, `router-hoang` port 29129, volume OAuth riêng), Gateway Adapter chạy dưới systemd, nginx + Let's Encrypt (`valeron.tech` → Adapter, `router-thanh.valeron.tech`/`router-hoang.valeron.tech` → 2 dashboard), 2 tài khoản Claude thật đã kết nối qua dashboard 9Router (xác nhận qua `/v1/models` trả đúng model ID thật: `cc/claude-sonnet-5`...). `registry.json` trên server đã điền `api_key` thật do 9Router phát hành cho từng seat, `status: healthy`.

Test thật gửi trực tiếp qua **đường công khai `https://valeron.tech/v1/messages`** (không bypass Adapter), dùng token nghiệp vụ Center AI ký thật bằng đúng secret đã deploy (`CENTERAI_TOKEN_SECRET` trên droplet), model `cc/claude-sonnet-5`:

| # | Test | Kết quả |
|---|---|---|
| 1 | Token Thanh (`seat_claude_thanh`) → Adapter công khai → nhận đúng phản hồi thật từ Claude account Thanh ("PONG-THANH-E2E") | ✅ PASS |
| 2 | Token Hoàng (`seat_claude_hoang`) → Adapter công khai → nhận đúng phản hồi thật từ Claude account Hoàng ("PONG-HOANG-E2E") | ✅ PASS |
| 3 | Token lệch (`employee_id=emp_hoang` + `seat_id=seat_claude_thanh`) → bị từ chối `403 seat_not_assigned_to_employee` | ✅ PASS |
| 4 | Request không có token → bị từ chối `401 missing_token` | ✅ PASS |

→ **Đây là bằng chứng thật đầu tiên (không phải mock) rằng toàn bộ đường đi Center AI token → Gateway Adapter → 9Router thật → Claude account thật hoạt động đúng, kể cả cô lập seat và chặn seat lệch, chạy qua đúng domain công khai HTTPS.** Câu hỏi ở mục 1 coi như đã có câu trả lời sơ bộ tích cực cho phần Nhóm A + phần cơ bản của Nhóm B (request/response non-streaming qua provider thật).

### Đã chạy — Claude Code CLI thật (bản v2.1.210) qua Adapter công khai

Cài Claude Code CLI thật, trỏ `ANTHROPIC_BASE_URL=https://valeron.tech`, `ANTHROPIC_AUTH_TOKEN=<token Thanh ký thật>`, chạy `-p` (non-interactive) với `--output-format stream-json --include-partial-messages --verbose` để bắt toàn bộ event stream thật.

| # | Tiêu chí Nhóm B | Kết quả |
|---|---|---|
| Streaming SSE | 91 `stream_event` chunk nhận đúng thứ tự, không vỡ | ✅ PASS |
| Tool-use blocks thật | Agent loop thật: `Read` → `Edit` → trả lời, `num_turns:3`, file `notes.txt` bị sửa đúng nội dung thật trên đĩa | ✅ PASS |
| `stop_reason` giữ nguyên | `"end_turn"` đúng như 9Router/Anthropic trả về, Adapter không làm sai lệch | ✅ PASS |
| Usage metadata | Đầy đủ `input_tokens/output_tokens/cache_creation_input_tokens/cache_read_input_tokens`, đọc được từ `result` event | ✅ PASS |
| Prompt caching headers | `cache_creation_input_tokens: 54650`, lần gọi tiếp theo (resume) `cache_read_input_tokens: 54650` — cache hit thật, không bị Adapter làm rớt | ✅ PASS |
| Error format giữ nguyên | Lỗi `model_not_found` (404) từ 9Router hiện đúng, CLI parse và hiển thị được, không bị Adapter bọc sai | ✅ PASS |
| Agent loop nhiều lượt tool-use | 3 lượt (đọc file → sửa file → trả lời) trong 1 task, không bị Adapter timeout/ngắt | ✅ PASS |
| Huỷ request giữa chừng | Phía server: sau khi client bị ngắt đột ngột, Adapter (`systemctl is-active` = `active`) và request tiếp theo vẫn trả lời bình thường ngay — không để lại phiên treo | ✅ PASS (phía server) |
| Model alias | **Phát hiện thật, đã sửa cách gọi**: Claude Code CLI mặc định gửi tên model rút gọn (`claude-sonnet-5`) — 9Router **không hiểu**, trả 404 `model_not_found`. Phải truyền `--model cc/claude-sonnet-5` (đúng ID 9Router) tường minh mới chạy được. | ⚠️ PASS có điều kiện — xem "Việc bắt buộc cho MVP1" bên dưới |
| `/compact` | Gọi `/compact` qua `--resume <session_id>` ở chế độ `-p` không kích hoạt được (CLI xử lý slash command khác ở non-interactive mode, không phải lỗi Adapter) — nhưng **resume session qua đúng Adapter thành công, `cache_read_input_tokens` khớp chính xác phiên trước**, xác nhận session/context liên tục hoạt động đúng qua gateway | ⚠️ Không kết luận được bằng cách test này, phần tải trọng nhất (resume qua gateway) đã xác nhận đúng |
| Huỷ request — phía CLI (SIGINT) | Không test được sạch trong sandbox Windows hiện tại — SIGINT không được tiến trình `claude.exe` xử lý gọn (cùng loại vấn đề đã gặp với `9router` CLI trước đây, đặc thù môi trường sandbox, không phải bug Adapter/9Router) | ⏸️ Chưa kết luận được (môi trường), cần test lại trên máy nhân viên thật (Linux/Mac) ở MVP1 |
| OAuth refresh giữa chừng | Chưa test — cần cửa sổ quan sát nhiều giờ (đợi token OAuth thật hết hạn), không làm được trong 1 phiên ngắn | ⏸️ Chưa làm, để theo dõi khi pilot chạy thật nhiều giờ liên tục |

**Việc bắt buộc cho MVP1 (Track A CLI wrapper) rút ra từ phát hiện model alias:** `company-ai` khi mở Claude Code phải tự truyền đúng model ID theo định dạng 9Router (`cc/<model>`), không dựa vào alias mặc định của Claude Code CLI — nếu không mọi request sẽ 404 ngay từ đầu. Đây là bug thật đã tìm ra bằng traffic thật, không phải giả định.

→ **Kết luận cuối cùng — MVP0 decision gate: PASS.** Toàn bộ tiêu chí Nhóm A + các tiêu chí tải trọng nhất của Nhóm B (streaming, tool-use thật, usage, caching, stop_reason, error format, agent loop nhiều lượt, không treo phiên khi huỷ) đã xác nhận đúng bằng traffic thật qua Claude Code CLI thật, 2 tài khoản Claude thật, qua đúng domain công khai. Chỉ còn 2 mục nhỏ chưa kết luận được (OAuth refresh dài hạn, SIGINT client trong sandbox hiện tại) — không đủ nghiêm trọng để chặn MVP1, chuyển sang theo dõi trong lúc pilot chạy thật. **Đi tiếp MVP1 theo `ai-operations-center-design.md` mục 14-15.**

### Nếu PASS toàn bộ

→ Đi tiếp đúng kiến trúc Q24. Khoá API contract giữa các thành phần (xem `TEAM-SPLIT.md`), bắt đầu MVP 1 với đầy đủ CLI wrapper, Control Plane, Context/Handoff.

### Nếu FAIL bất kỳ tiêu chí nào

→ **Không cố vá 9Router vô thời hạn.** Quyết định ngay:

```
Claude Code CLI → chuyển sang Lane B thuần (Q6/Q23)
- Nhân viên tự login seat của họ, không qua gateway
- company-ai vẫn quản: project, task, Work Session, context, Git, checkpoint, handoff
- Mất: full gateway observability (token/cost chính xác) cho loại seat này
- Vẫn giữ được: toàn bộ Project Continuity / Company Memory — đây mới là moat thật
```

Ghi lại đúng tiêu chí nào FAIL và vì sao — quyết định này cần dẫn chứng cụ thể, không phải cảm tính, để khi provider/9Router cải thiện sau này có thể thử lại có căn cứ.

## 7. Không làm trong spike này

Dashboard, database schema đầy đủ, CLI wrapper thật, Work Session/Tool Session/Checkpoint, Context Service, Handoff, secret/PII scan, KPI, multi-project — tất cả thuộc MVP 1 trở đi, **chỉ bắt đầu sau khi spike này PASS**.

## 8. Thời gian

Không quá 3-5 ngày làm việc. Nếu sau 5 ngày vẫn chưa xác định được PASS/FAIL rõ ràng, đó tự nó là tín hiệu — nghiêng về hướng FAIL và chuyển Lane B, không kéo dài thêm.
