# MVP 0 — Gateway Feasibility Spike

> Tài liệu thực thi. Tham chiếu kiến trúc đầy đủ: `ai-operations-center-design.md` (Q9, Q23, Q24.9, Q24.10).
> Đây là **decision gate**, không phải sprint tính năng. Mục tiêu duy nhất: biết chắc nhánh Gateway-managed seat có đi tiếp được không, trước khi bất kỳ ai viết thêm dòng code nào cho CLI wrapper hay Control Plane đầy đủ.

## 1. Câu hỏi cần trả lời (chỉ một câu)

> **9Router có thể giữ nhiều kết nối subscription/OAuth khác nhau (1 kết nối = 1 nhân viên) và route đúng người đúng connection một cách đáng tin cậy, khi có Gateway Adapter đứng trước nó không?**

Không trả lời được câu này thì mọi thiết kế Work Session / Context / Handoff ở tài liệu chính vẫn đúng, nhưng **Claude Code CLI phải chuyển sang Lane B** (nhân viên tự login seat, không qua gateway) — khác hẳn UX/luồng đã mô tả ở Q24. Vì vậy phải biết trước khi build tiếp.

## 2. Luồng cần dựng (tối giản, không phải sản phẩm)

**Cách dựng: container-per-seat, không phải 1 9Router gom nhiều account.** Đây là chiến lược cô lập cho **POC/MVP1**, không phải kiến trúc scale vĩnh viễn (ở quy mô 500-1.000 seat sẽ cần tối ưu lại — xem Q9) — nhưng là cách nhanh và chắc nhất để loại bỏ rủi ro round-robin/fallback chéo seat ngay từ đầu, cô lập vật lý bằng container/OAuth-volume/port riêng, không phụ thuộc cấu hình bên trong 9Router:

```
Server AI Gateway
├── 9Router instance Thanh (volume OAuth riêng) → router-thanh:20128
└── 9Router instance Hoàng (volume OAuth riêng) → router-hoang:20128

Thanh (script giả lập token) → Gateway Adapter (mỏng) → router-thanh:20128 → Claude
Hoàng (script giả lập token) → Gateway Adapter (mỏng) → router-hoang:20128 → Claude
```

Không có CLI wrapper thật, không có Control Plane thật, không có database schema đầy đủ. Chỉ cần đủ để chứng minh routing đúng.

## 3. Thành phần cần chuẩn bị

- [ ] 2 container/instance 9Router riêng biệt, mỗi cái 1 volume OAuth riêng, 1 internal port riêng (`router-thanh:20128`, `router-hoang:20128`).
- [ ] 2 provider connection thật hoặc sandbox — gắn đúng vào từng instance tương ứng. Nếu 9Router hỗ trợ OAuth/subscription connection, dùng đúng loại đó (không dùng tạm API key rồi kết luận PASS — phải test đúng loại kết nối sẽ dùng thật, vì đây chính là điều cần verify).
- [ ] **Xác nhận riêng**: 9Router có chạy sạch ở chế độ nhiều instance độc lập không (không có state/singleton nào bị chia sẻ ngầm giữa các instance, ví dụ file lock hay cache toàn cục) — đọc docs/source thật, không giả định.
- [ ] Gateway Adapter cực mỏng, **mặc định Metadata enforcement — không sửa body** (Q9): nhận 1 token giả lập chứa `employee_id` + `seat_id` (JSON, không cần ký thật ở bước này) → route theo `seat_id` (không phải `employee_id` — 1 người có thể nhiều seat) sang đúng internal endpoint qua Seat Runtime Registry (`{"seat_claude_thanh": "http://router-thanh:20128", "seat_claude_hoang": "http://router-hoang:20128"}`) → forward request nguyên vẹn → trả response về, log lại instance nào đã dùng. Không cần code chế độ Prompt enforcement (parse/sửa body) trong spike này — để dành MVP sau nếu thật sự cần.
- [ ] Script tạo 2 token giả lập: `{"employee_id": "thanh", "seat_id": "seat_claude_thanh", "provider": "anthropic", "tool": "claude_code"}` và tương tự cho Hoàng.
- [ ] 2 Claude Code process (hoặc 2 script gửi request liên tục) chạy đồng thời, mỗi cái mang token của đúng người.
- [ ] Chỗ ghi log đơn giản (file/console đủ dùng) — mỗi request ghi: `employee_id`, instance/connection thực tế đã dùng, model, status, thời điểm.

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

→ **Kết luận tạm thời**: phần logic Adapter (routing theo `seat_id`, cô lập seat, xác thực token, revoke tức thời, streaming proxy) đã xác nhận đúng bằng mock. Phần quyết định PASS/FAIL thật của toàn bộ spike (câu hỏi ở mục 1) **vẫn phải chờ 9Router thật + 2 Claude Team/Max account thật** để test Nhóm B đầy đủ — đây là việc tiếp theo, không phải đã xong.

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
