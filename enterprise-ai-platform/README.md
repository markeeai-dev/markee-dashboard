# Center AI — Enterprise AI Platform

Nền tảng quản trị seat AI hợp lệ, project continuity và company memory cho doanh nghiệp. 3 người: đọc file này trước, theo đúng thứ tự bên dưới.

## Trạng thái hiện tại

**Kiến trúc đã khoá (v17).** `9router` đã xác nhận là package thật (npm/Docker `decolua/9router`) — đã cài, chạy, gọi API thật để lấy thông tin chính xác thay vì suy đoán (chi tiết Q9). Phát hiện quan trọng: round-robin/fallback-free là tính năng quảng cáo thật của 9Router — container-per-seat + đúng 1 connection/instance là bắt buộc, không phải tuỳ chọn an toàn.

**MVP0 decision gate: PASS.** Hạ tầng thật trên droplet riêng (2 container `decolua/9router` cô lập, Gateway Adapter dưới systemd, nginx+HTTPS, domain `valeron.tech`), 2 tài khoản Claude thật đã kết nối. Đã test bằng cả curl thuần lẫn **Claude Code CLI thật** qua đúng đường công khai: routing đúng seat, cô lập seat, chặn seat lệch (403)/thiếu token (401), streaming, tool-use thật (agent loop nhiều lượt), usage + prompt caching, `stop_reason`/error format giữ nguyên — tất cả PASS (chi tiết `MVP0-SPIKE.md` mục 6). Phát hiện quan trọng cho MVP1: Claude Code CLI gửi tên model rút gọn mà 9Router không hiểu — CLI wrapper `company-ai` bắt buộc phải tự truyền đúng model ID `cc/<model>`. Còn 2 mục nhỏ chưa kết luận (OAuth refresh dài hạn, SIGINT client trong sandbox hiện tại) — không chặn đường, theo dõi tiếp khi pilot chạy thật.

**MVP1 (Bước 0-5): PASS toàn bộ — kịch bản chứng minh giá trị cốt lõi (mục 15) đã chạy thật, không mock.** Control Plane (Postgres + API, `cp.valeron.tech`), CLI wrapper `company-ai` (`login/init/claude/codex/status/checkpoint/end`, có git-hook checkpoint tự động), và dashboard tối giản (`ops.valeron.tech`) đã dựng xong và test bằng traffic thật: Thanh sửa code + commit thật qua Claude Code (seat riêng), publish handoff thật; Hoàng đăng nhập seat khác, mở lại đúng task, Claude Code tự đọc đúng 100% những gì Thanh đã làm — không có bước chuyển giao thủ công nào. Chi tiết đầy đủ ở `MVP1-PROGRESS.md`.

**MVP2 (4 hạng mục theo chính tài liệu): PASS toàn bộ, test bằng traffic thật.** AI Timeline + AI Inbox (Q14, dashboard thêm 2 tab); Request Span đầy đủ (bảng `request_spans`, latency/usage/cost thật, sửa cả Gateway Adapter đang chạy thật — đã test kỹ không phá streaming/tool-use trước khi coi là xong); Handoff tự động sinh bằng LLM (`company-ai end` gọi AI thật viết draft bám sát dữ liệu, không bịa, fallback êm về git-diff thuần nếu lỗi); Task claim/lease đầy đủ (Q20 — exclusive/shared, lease tự gia hạn khi hoạt động/tự hết hạn nếu idle, phát hiện va chạm file, không khoá cứng — CLI cảnh báo rõ và hỏi xác nhận). Test-harness Control Plane: 25 → 39/39 PASS. Chi tiết đầy đủ ở `MVP2-PROGRESS.md`. Cố tình chưa làm (đúng lý do tài liệu tự nêu): vector search, browser extension, connector Codex/GPT thật (thiếu account).

**Fork 9Router → "Center AI Router": PASS, đã thay thế bản gốc trên cả 2 seat đang chạy thật.** Fork thật tại `github.com/markeeai-dev/9router` (giữ remote `upstream` trỏ `decolua/9router` để cập nhật sau này, nhánh `master` sạch = upstream, chỉnh sửa nằm trên `company-brand`). Đợt này **chỉ đổi giao diện/thương hiệu** (đúng yêu cầu, không bỏ tính năng) — đồng thời xoá 1 lỗ hổng privacy thật (Google Analytics ID hardcode của tác giả gốc, âm thầm gửi telemetry sử dụng ra ngoài). Đã build + test cẩn thận (container tạm trước, rồi mới thay từng container thật, giữ bản cũ để rollback) — cả 2 tài khoản Claude thật vẫn kết nối, không cần đăng nhập lại, toàn bộ pipeline CLI/Adapter/streaming/tool-use xác nhận không đổi hành vi. Chi tiết ở `NINEROUTER-FORK-PROGRESS.md`. Hạ tầng vẫn tạm trên droplet cá nhân — chuyển sang host công ty để sau, theo đúng quyết định đã chốt.

**MVP3 khởi động (Governance Q13 + 2-mode Audit Q22): PASS, test theo đúng 8 bước đã lên plan trước, không lệch/bỏ bước.** Secret Scan tại Gateway Adapter — chặn cứng thật (AWS key/GitHub token/private key/JWT...), test bằng cả AWS key giả lập thật (403, không forward lên 9Router) lẫn Claude Code CLI thật (không chặn nhầm). PII Detection (CCCD/hộ chiếu/thẻ) — chỉ cảnh báo, không chặn. Risk Score + Full Audit Mode (lý do + hạn bắt buộc) + Audit Logs — chỉ admin. Dashboard thêm tab Governance (ẩn với người dùng thường). **Phát hiện + sửa 1 lỗi thật giữa chừng**: pattern số thẻ ban đầu báo nhầm timestamp/ID thật trong traffic CLI thật — kế hoạch đã ghi cần Luhn check nhưng code lúc đó chưa làm; thêm Luhn checksum, xác nhận lại bằng đúng traffic đã gây lỗi trước đó (từ 5 flag báo nhầm/lần chạy xuống 0). Test-harness: 39 → 52/52 PASS.

**MVP3 tiếp theo (Full Audit Mode lưu nội dung thô có redact + Context Confidence/ADR Q15): PASS.** Đúng phần đã tự hứa hoãn ở đợt trước ("để khi có redaction rõ ràng") — nay làm tiếp. `prompts`/`responses` chỉ ghi được khi có `full_audit_grants` còn hiệu lực (kiểm tra lại ngay lúc ghi, không chỉ tin Adapter), nội dung luôn redact trước khi lưu (test thật: CCCD giả lập trong request thật → lưu đúng bản `[REDACTED:vn_national_id]`, trong khi request gửi lên Claude vẫn giữ nguyên gốc — đúng Metadata enforcement). Xem nội dung đã lưu chỉ admin, mỗi lần xem tự ghi audit_logs. Context Confidence tính lúc đọc (decision đã duyệt = 100% không decay, còn lại decay tuyến tính) + Reasoning Log/ADR — test thật qua CLI, `checkpoint.md` hiện đúng nhãn confidence. Test-harness: 52 → 68/68 PASS. Chi tiết đầy đủ (gồm 1 giới hạn thật ghi rõ: chưa test được đường "không có grant" bằng traffic thật vì cả 2 nhân viên đang có grant tồn đọng) ở `MVP3-PROGRESS.md`.

## Đọc theo thứ tự này

1. **`MVP0-SPIKE.md`** — làm cái này trước tiên, trước khi đọc hết tài liệu kiến trúc. Đây là việc cần làm ngay hôm nay. Có checklist chuẩn bị, cách chạy, và tiêu chí PASS/FAIL rõ ràng.
2. **`TEAM-SPLIT.md`** — ai làm phần gì (Track A: CLI wrapper, Track B: Gateway Adapter, Track C: Control Plane), phụ thuộc ra sao, việc gì làm song song được với spike ngay bây giờ, việc gì phải chờ.
3. **`ai-operations-center-design.md`** — tài liệu kiến trúc đầy đủ (~1300 dòng, đã qua 15 vòng chốt). Không cần đọc hết ngay — dùng làm tham chiếu khi cần chi tiết. Nếu chỉ đọc 2 mục: **Q9** (4 thành phần, cơ chế Gateway Adapter, container-per-seat) và **Q24** (toàn bộ luồng vận hành cuối cùng, 10 phần).

## Tóm tắt kiến trúc trong 1 phút

**4 lớp, không phải 3:**

```
Máy nhân viên: CLI wrapper mỏng (company-ai) + VS Code/Claude Code/Codex bản gốc
        ↓ token nghiệp vụ ngắn hạn (ký, không phải env var thô)
Center AI Gateway Adapter (server, BẮT BUỘC)
   - xác thực token (KHÔNG tin `CENTER_AI_*` env var, chỉ tin claim trong token đã ký)
   - resolve employee/project/task/session + kiểm tra seat_id (1 người có thể nhiều seat)
   - tra Seat Runtime Registry theo seat_id để route đúng instance
   - mặc định KHÔNG sửa nội dung request (Metadata enforcement) — chỉ verify qua token/header
        ↓ credential nội bộ
9Router Runtime Fleet (server, NHIỀU instance — 1 seat = 1 container riêng, cô lập vật lý)
        ↓
Claude / OpenAI / provider

                    ⬉ Center AI Control Plane quản lý song song
                      (session/context/assignment/vòng đời container, nhận telemetry)
```

Nhân viên vẫn dùng VS Code, Claude Code, Codex bản gốc — không app riêng, không fork IDE, không sửa config cá nhân vĩnh viễn (chạy process-scoped, `claude` gõ tay vẫn dùng song song bình thường). 1 seat AI = 1 nhân viên, cố định, **không rotate, không round-robin, không fallback chéo seat** — đây là nguyên tắc sản phẩm quan trọng nhất.

**Context:** nội dung lớn (kiến trúc, requirement, checkpoint) luôn ở local, CLI ghi vào `.center-ai/generated/*.md` trước khi mở tool — không phải thứ "nhét" ở tầng gateway mỗi request. Gateway Adapter chỉ verify version qua `context_bundle_id`/hash trong token, không đọc/sửa nội dung.

**Moat thật của sản phẩm không phải seat management** — là Project Continuity: người tiếp quản task hiểu toàn bộ tiến độ trong vài phút thay vì phải hỏi lại đồng nghiệp.

## Việc đầu tiên phải làm

Không mở database, không code CLI, không code dashboard trước. Làm `MVP0-SPIKE.md` trước — nó quyết định nhánh Gateway Adapter + 9Router có đi tiếp đúng thiết kế hay phải rẽ sang Lane B (nhân viên tự login seat). Sau khi có kết luận PASS/FAIL, quay lại `TEAM-SPLIT.md` để chia việc MVP 1 theo 3 track.

## 5 quy tắc không được phá khi code

1. **Không round-robin/fallback account giữa nhân viên** — 1 seat = 1 người, cô lập bằng container riêng (không tin vào cấu hình). Vi phạm nguyên tắc này là bug nghiêm trọng nhất có thể có.
2. **Gateway Adapter mặc định không sửa nội dung request** — chỉ xác thực qua token/header. Chỉ bật chế độ sửa body khi có policy bắt buộc thật sự cần model nhìn thấy, không phải mặc định.
3. **`/compact` không tạo Tool Session mới**, chỉ tạo Checkpoint. Thoát tool không đóng Work Session, không tạo handoff — chỉ `company-ai end` mới làm việc đó.
4. **Liên kết Git dùng snapshot tự động** (CLI tự chụp HEAD/branch/commit range) — không bắt dev nhớ gõ trailer.
5. **Không dùng token/prompt count làm KPI** — luôn ghép với outcome (`cost_per_accepted_outcome`, không phải token thô).
6. **API domain không có từ "agent"** — CLI wrapper không phải service riêng, chỉ là client gọi vào resource (`/v1/work-sessions`, `/v1/tool-sessions/{id}/checkpoints`...), không dùng `/v1/agent/*`.

## Quy tắc làm việc chung

- Không thêm ý tưởng/tính năng mới vào `ai-operations-center-design.md` nữa — tài liệu đã khoá sau nhiều vòng review. Nếu phát sinh vấn đề thiết kế thật sự trong lúc code, thảo luận trực tiếp giữa 3 người, ghi quyết định vào changelog ở đầu file đó, không tự ý đổi hướng.
- Ưu tiên tuyệt đối: **PASS/FAIL của spike**, sau đó mới tới tính năng.
- Cả 3 file (`README.md`, `MVP0-SPIKE.md`, `TEAM-SPLIT.md`) phải luôn khớp với `ai-operations-center-design.md` — nếu sửa kiến trúc, sửa cả 4 file cùng lúc, không để lệch.
- **Sau khi làm xong bất kỳ phần việc nào (1 file, 1 tính năng, 1 lần chạy test...), luôn báo cáo rõ 2 việc: đã làm gì xong, còn lại gì chưa làm** — dù là tự làm một mình hay báo cáo cho 2 người còn lại. Không im lặng chuyển sang việc tiếp theo mà không chốt trạng thái việc vừa xong.
- Cập nhật `PROGRESS.md` (nếu có) hoặc phần "Trạng thái hiện tại" ở đầu file liên quan mỗi khi trạng thái đổi — trạng thái ghi trong tài liệu phải luôn khớp thực tế, không để ai đọc nhầm việc đã xong thành chưa làm hoặc ngược lại.
