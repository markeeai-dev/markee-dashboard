# Center AI — Enterprise AI Platform

Nền tảng quản trị seat AI hợp lệ, project continuity và company memory cho doanh nghiệp. 3 người: đọc file này trước, theo đúng thứ tự bên dưới.

## Trạng thái hiện tại

**Kiến trúc đã khoá (v17).** `9router` đã xác nhận là package thật (npm/Docker `decolua/9router`) — đã cài, chạy, gọi API thật để lấy thông tin chính xác thay vì suy đoán (chi tiết Q9). Phát hiện quan trọng: round-robin/fallback-free là tính năng quảng cáo thật của 9Router — container-per-seat + đúng 1 connection/instance là bắt buộc, không phải tuỳ chọn an toàn.

**MVP0 decision gate: PASS.** Hạ tầng thật trên droplet riêng (2 container `decolua/9router` cô lập, Gateway Adapter dưới systemd, nginx+HTTPS, domain `valeron.tech`), 2 tài khoản Claude thật đã kết nối. Đã test bằng cả curl thuần lẫn **Claude Code CLI thật** qua đúng đường công khai: routing đúng seat, cô lập seat, chặn seat lệch (403)/thiếu token (401), streaming, tool-use thật (agent loop nhiều lượt), usage + prompt caching, `stop_reason`/error format giữ nguyên — tất cả PASS (chi tiết `MVP0-SPIKE.md` mục 6). Phát hiện quan trọng cho MVP1: Claude Code CLI gửi tên model rút gọn mà 9Router không hiểu — CLI wrapper `company-ai` bắt buộc phải tự truyền đúng model ID `cc/<model>`. Còn 2 mục nhỏ chưa kết luận (OAuth refresh dài hạn, SIGINT client trong sandbox hiện tại) — không chặn đường, theo dõi tiếp khi pilot chạy thật.

**MVP1 (Bước 0-5): PASS toàn bộ — kịch bản chứng minh giá trị cốt lõi (mục 15) đã chạy thật, không mock.** Control Plane (Postgres + API, `cp.valeron.tech`), CLI wrapper `company-ai` (`login/init/claude/codex/status/checkpoint/end`, có git-hook checkpoint tự động), và dashboard tối giản (`ops.valeron.tech`) đã dựng xong và test bằng traffic thật: Thanh sửa code + commit thật qua Claude Code (seat riêng), publish handoff thật; Hoàng đăng nhập seat khác, mở lại đúng task, Claude Code tự đọc đúng 100% những gì Thanh đã làm — không có bước chuyển giao thủ công nào. Chi tiết đầy đủ ở `MVP1-PROGRESS.md`.

**MVP2 (4 hạng mục theo chính tài liệu): PASS toàn bộ, test bằng traffic thật.** AI Timeline + AI Inbox (Q14, dashboard thêm 2 tab); Request Span đầy đủ (bảng `request_spans`, latency/usage/cost thật, sửa cả Gateway Adapter đang chạy thật — đã test kỹ không phá streaming/tool-use trước khi coi là xong); Handoff tự động sinh bằng LLM (`company-ai end` gọi AI thật viết draft bám sát dữ liệu, không bịa, fallback êm về git-diff thuần nếu lỗi); Task claim/lease đầy đủ (Q20 — exclusive/shared, lease tự gia hạn khi hoạt động/tự hết hạn nếu idle, phát hiện va chạm file, không khoá cứng — CLI cảnh báo rõ và hỏi xác nhận). Test-harness Control Plane: 25 → 39/39 PASS. Chi tiết đầy đủ ở `MVP2-PROGRESS.md`. Cố tình chưa làm (đúng lý do tài liệu tự nêu): vector search, browser extension, connector Codex/GPT thật (thiếu account).

**Fork 9Router → "Center AI Router": PASS, đã thay thế bản gốc trên cả 2 seat đang chạy thật.** Fork thật tại `github.com/markeeai-dev/9router` (giữ remote `upstream` trỏ `decolua/9router` để cập nhật sau này, nhánh `master` sạch = upstream, chỉnh sửa nằm trên `company-brand`). Đợt này **chỉ đổi giao diện/thương hiệu** (đúng yêu cầu, không bỏ tính năng) — đồng thời xoá 1 lỗ hổng privacy thật (Google Analytics ID hardcode của tác giả gốc, âm thầm gửi telemetry sử dụng ra ngoài). Đã build + test cẩn thận (container tạm trước, rồi mới thay từng container thật, giữ bản cũ để rollback) — cả 2 tài khoản Claude thật vẫn kết nối, không cần đăng nhập lại, toàn bộ pipeline CLI/Adapter/streaming/tool-use xác nhận không đổi hành vi. Chi tiết ở `NINEROUTER-FORK-PROGRESS.md`. Hạ tầng vẫn tạm trên droplet cá nhân — chuyển sang host công ty để sau, theo đúng quyết định đã chốt.

**MVP3 khởi động (Governance Q13 + 2-mode Audit Q22): PASS, test theo đúng 8 bước đã lên plan trước, không lệch/bỏ bước.** Secret Scan tại Gateway Adapter — chặn cứng thật (AWS key/GitHub token/private key/JWT...), test bằng cả AWS key giả lập thật (403, không forward lên 9Router) lẫn Claude Code CLI thật (không chặn nhầm). PII Detection (CCCD/hộ chiếu/thẻ) — chỉ cảnh báo, không chặn. Risk Score + Full Audit Mode (lý do + hạn bắt buộc) + Audit Logs — chỉ admin. Dashboard thêm tab Governance (ẩn với người dùng thường). **Phát hiện + sửa 1 lỗi thật giữa chừng**: pattern số thẻ ban đầu báo nhầm timestamp/ID thật trong traffic CLI thật — kế hoạch đã ghi cần Luhn check nhưng code lúc đó chưa làm; thêm Luhn checksum, xác nhận lại bằng đúng traffic đã gây lỗi trước đó (từ 5 flag báo nhầm/lần chạy xuống 0). Test-harness: 39 → 52/52 PASS.

**MVP3 tiếp theo (Full Audit Mode lưu nội dung thô có redact + Context Confidence/ADR Q15): PASS.** Đúng phần đã tự hứa hoãn ở đợt trước ("để khi có redaction rõ ràng") — nay làm tiếp. `prompts`/`responses` chỉ ghi được khi có `full_audit_grants` còn hiệu lực (kiểm tra lại ngay lúc ghi, không chỉ tin Adapter), nội dung luôn redact trước khi lưu (test thật: CCCD giả lập trong request thật → lưu đúng bản `[REDACTED:vn_national_id]`, trong khi request gửi lên Claude vẫn giữ nguyên gốc — đúng Metadata enforcement). Xem nội dung đã lưu chỉ admin, mỗi lần xem tự ghi audit_logs. Context Confidence tính lúc đọc (decision đã duyệt = 100% không decay, còn lại decay tuyến tính) + Reasoning Log/ADR — test thật qua CLI, `checkpoint.md` hiện đúng nhãn confidence. Test-harness: 52 → 68/68 PASS.

**KPI 4 lớp (Q22, chỉ 3/4 lớp có dữ liệu thật): PASS.** Theo đúng yêu cầu — chỉ làm Adoption/Efficiency/Collaboration, **không bịa số cho Outcome** (trả `null` kèm lý do rõ ràng ngay trong response: cần tích hợp CI/PR/QA thật, chưa có). Đọc-only trên dữ liệu đã có, không migration mới, không đụng Gateway Adapter. Test bằng dữ liệu thật đã tích luỹ suốt session (không dựng kịch bản giả) — số liệu khớp đúng thực tế, kể cả chỗ đúng ra phải là 0 (task demo chưa từng đóng status='closed', hệ thống báo đúng 0 thay vì bịa). Dashboard thêm tab KPI, ghi chú rõ giới hạn của từng metric ngay dưới bảng. Test-harness: 68 → 74/74 PASS. Chi tiết đầy đủ ở `MVP3-PROGRESS.md`.

**Vá gap A (context/ingest + revoke Full Audit Mode sớm): PASS, kèm đóng luôn 1 gap test tồn đọng.** 2 gap tự phát hiện ở đợt trước, vá trước khi làm tính năng mới theo đúng lựa chọn của người dùng. `POST /v1/context/ingest` (mọi nhân viên, không riêng admin) — nay `company-ai context add` (CLI mới) và form trên dashboard đều tạo được `project_context` thật, không chỉ chạy trên dữ liệu seed như trước. `POST /v1/governance/full-audit-mode/:id/revoke` (chỉ admin, idempotent) + `GET /v1/governance/full-audit-grants` (list, cần để revoke có ý nghĩa qua dashboard) — dashboard Governance tab thêm bảng grant kèm nút Revoke. Không đụng Gateway Adapter, không migration mới. Test-harness: 74 → 87/87 PASS. Sau khi có revoke, dọn sạch 20 grant tồn đọng của Thanh/Hoàng rồi test lại bằng traffic thật đường "không có grant active → không lưu prompt/response" (giới hạn đã ghi rõ ở Đợt 2) — xác nhận đúng: request vẫn 200 bình thường + `request_spans` vẫn ghi usage đúng, nhưng `prompts` 0 dòng mới. Chi tiết đầy đủ ở `MVP3-PROGRESS.md`.

**Đợt 4 — Policy Engine cơ bản: Data Classification (tầng Project) + Approval workflow (Q13): PASS.** Mở khoá nền tảng chung cho phần lớn mục còn lại của MVP3. Data Classification gắn nhãn ở **tầng Project** (quyết định chốt qua hỏi người dùng trước khi lên plan — không làm regex real-time từng prompt như Secret/PII vì "dữ liệu khách hàng"/"mã nguồn nội bộ" không có pattern cấu trúc rõ, làm real-time sẽ báo sai/sót). `policies` (company-wide hoặc ghi đè theo project) + `approval_requests` (Adapter tự tạo khi chặn, admin duyệt/từ chối qua dashboard, giống hệt pattern Full Audit Mode). Mặc định `unclassified` + không policy nào = hành vi không đổi cho tới khi admin chủ động cấu hình — test thật xác nhận: request thật của Hoàng bị chặn đúng 403 khi có policy, tự tạo yêu cầu duyệt, Thanh duyệt xong gửi lại request đó qua **200 bình thường**, sau đó revert project về `unclassified` và chạy lại `company-ai claude` thật xác nhận không ảnh hưởng gì. Test-harness: 87 → 115/115 PASS. Chi tiết đầy đủ ở `MVP3-PROGRESS.md`.

**Đợt 5 — Company Brain `scope_level` (thu hẹp) + Pattern Library (Q16) + Seat Offboarding thật: PASS.** Người dùng yêu cầu "làm hết luôn" phần còn lại của MVP3 — rà lại, 3 mục này làm thật được ngay, phần còn lại (policy theo department, webhook Jira/Linear, Intent-centric, Knowledge Graph mở rộng, MVP4) bị chặn bởi thiếu dữ liệu thật/tích hợp bên thứ ba/chính tài liệu khoá, đã giải thích rõ trước khi lên plan. 2 phát hiện thật lúc rà soát: Company Brain 5 tầng không test được thật với `department`/`company` (pilot chỉ có 1 project) — thu hẹp chỉ làm `session|personal|project`; và `seats.status` ở Control Plane **không phải nơi enforce thật** (Adapter đọc `registry.json` trên đĩa) — nếu offboarding chỉ đổi cột DB thì không cắt được quyền truy cập thật, nên thêm hẳn 1 endpoint nội bộ trên Adapter để Control Plane gọi thật. Pattern Library: generalize thủ công (không anonymize tự động) + gate "người duyệt phải khác người tạo", chưa bật tính năng reuse tự động giữa project (khoá tới MVP4 theo đúng tài liệu). Test thật: tạo 1 seat giả lập, offboard qua Control Plane, xác nhận cả 3 tầng đổi đúng (registry.json/DB/audit_logs) mà không đụng seat thật của Thanh/Hoàng. Giữa chừng phát hiện thêm 1 gap cùng lớp Gap A (`approval_requests` cũng chưa revoke sớm được) — vá bằng đúng kỹ thuật cũ. Test-harness: 115 → 138/138 PASS. Chi tiết đầy đủ ở `MVP3-PROGRESS.md`.

**Hoàn thiện Task Management nội bộ (MVP2 hạng mục 5): PASS.** Người dùng hỏi có nên tích hợp Jira/Linear — chọn KHÔNG (công ty chỉ 2-3 người, tích hợp tool ngoài tạo 2 nguồn trạng thái phải đồng bộ; để dành đúng lúc khách hàng thật yêu cầu tool cụ thể). Rà soát phát hiện gap thật: từ đầu dự án chưa từng có cách **tạo task mới hay đổi trạng thái task** qua sản phẩm — `task_tng142` là task seed duy nhất, chưa ai đóng được task qua CLI/dashboard, đây chính là lý do KPI Efficiency luôn hiện `closed_task_count = 0` suốt dự án. Thêm `POST /v1/projects/:id/tasks` + `POST /v1/tasks/:id/update` (không mở rộng schema, chỉ dùng cột đã có), CLI `company-ai task add`/`task update`, dashboard form tạo task + dropdown đổi trạng thái/người phụ trách inline. Test thật đầu-cuối: tạo task qua CLI → dùng ngay trong `company-ai claude` thật → đóng qua `task update` → **lần đầu tiên trong dự án `closed_task_count` khác 0 qua dữ liệu sản phẩm thật** (không phải số giả). Test-harness: 138 → 149/149 PASS. Chi tiết đầy đủ ở `MVP2-PROGRESS.md`.

**Seat gán qua duyệt — khép MVP3: PASS.** Nửa cuối của "Workflow duyệt gán/thu hồi seat" (Đợt 5 đã làm xong nửa thu hồi). `POST /v1/seats/:id/assign` (chỉ admin, đối xứng offboard, enforcement thật qua Adapter — chặn nếu seat đang `revoked` vì cần provision lại thật trong 9Router trước). Test thật: tạo seat giả lập, reassign giữa 2 employee thật, xác nhận cả 3 tầng đổi đúng (registry.json/DB/audit_logs), dọn sạch, không đụng seat thật của Thanh/Hoàng. Test-harness: 149 → 154/154 PASS. **Với đợt này, MVP3 khép lại đúng phạm vi khả thi hiện tại** — phần còn lại (policy/Company Brain theo department, Pattern Library reuse, Knowledge Graph mở rộng, Intent-centric, webhook Jira/Linear) đều có lý do hoãn cụ thể, không phải bỏ sót. Chi tiết đầy đủ ở `MVP3-PROGRESS.md`.

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
