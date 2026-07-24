# MVP3 khởi động — Tiến độ thực thi

> Kế hoạch đầy đủ: xem plan đã duyệt (Governance Q13: Secret Scan + PII Detection, 2-mode
> Audit Q22). Nhật ký PASS/FAIL thật theo đúng 8 bước đã chốt, không gộp/bỏ bước.

## Bước 1 — Schema

**PASS.** Migration `004_governance.sql`: `employees.role` (member/admin), bảng `flags`,
`audit_logs` (append-only), `full_audit_grants` (cùng kiểu lease đã dùng ở Task claim — hết
hạn tự nhiên, không cần job dọn). Seed `emp_thanh.role = 'admin'`. Xác nhận bằng query trực
tiếp trên droplet trước khi code gì thêm.

## Bước 2 — `shared/governance-scan.js`

**PASS — 15/15 test cục bộ (9 true positive + 6 false-positive-check), test cả 2 chiều trước
khi đụng Adapter.** Secret Scan: AWS key, GitHub token, private key block, Slack token, JWT,
generic API key. PII: CCCD/hộ chiếu VN, số thẻ ngân hàng. Ghi rõ giới hạn: tập pattern đại
diện, không đầy đủ như gitleaks thật.

## Bước 3 — Control Plane governance endpoints

**PASS — 50/50 test-harness (tăng từ 39), deploy + test TRƯỚC khi đụng Adapter đúng theo
plan.** `POST /internal/v1/governance/flags` (auth riêng, cùng kiểu request-spans),
`GET /v1/governance/risk-score` (chỉ admin, cộng điểm theo severity — không tự động xử lý ai),
`POST /v1/governance/full-audit-mode` (chỉ admin, bắt buộc lý do + hạn), `GET /v1/audit-logs`
(chỉ admin).

## Bước 4 — Gateway Adapter: Secret Scan (chặn cứng)

**PASS, nhưng phát hiện + sửa 1 lỗi thật giữa chừng — xem mục "Lỗi tìm thấy" bên dưới.**

Test theo đúng thứ tự plan (đụng thành phần đang chạy thật, không được phá gì):
- a) Mock test gốc (`spike/test-harness/run-test.js`) — 7/7 PASS, seat isolation/streaming
  không bị ảnh hưởng.
- b) curl thật qua Adapter công khai với AWS key giả lập (`AKIAIOSFODNN7EXAMPLE`) trong nội
  dung — **chặn đúng, HTTP 403**, không forward lên 9Router.
- c) curl thật với nội dung bình thường — vẫn qua bình thường (không chặn nhầm).
- d) `company-ai claude` thật (Claude Code CLI thật, tool-use + streaming) — hoạt động đúng,
  không bị ảnh hưởng bởi bước scan mới.

## Bước 5 — Gateway Adapter: PII Detection (cảnh báo, không chặn)

**PASS.** curl thật với CCCD giả lập (`079203012345`) trong nội dung — request **vẫn trả 200**
(không bị chặn), flag `pii_detected` được ghi đúng vào Control Plane.

## Lỗi tìm thấy giữa chừng Bước 4 (không phải bỏ sót — phát hiện bằng test thật, sửa ngay)

Khi chạy lại thật Bước 4d (Claude Code CLI thật), bảng `flags` xuất hiện nhiều dòng
`pii_detected` loại `card_number` mà không phải do test cố ý — **báo nhầm thật**. Nguyên nhân:
pattern gốc `\b(?:\d[ -]?){13,19}\b` chỉ đếm số chữ số, khớp nhầm timestamp Unix 13 số và các
ID dài khác vốn rất phổ biến trong payload JSON thật của Claude Code. Đối chiếu lại: kế hoạch
đã duyệt ghi rõ "13-19 số theo nhóm/**Luhn check cơ bản**" nhưng code lúc đó CHƯA áp dụng Luhn —
đây là chỗ lệch giữa plan và code thực tế, không phải lỗi thiết kế.

**Đã sửa**: thêm `luhnValid()`, chỉ báo `card_number` khi chuỗi số vừa đúng độ dài (13-19) VÀA
qua được Luhn checksum. Xác nhận lại bằng test cục bộ (18/18 PASS, gồm đúng ca lỗi vừa gặp:
timestamp 13 số không còn báo nhầm, số thẻ Visa/Mastercard test chuẩn vẫn phát hiện đúng), rồi
deploy lại + chạy lại nguyên Bước 4d — xác nhận **0 flag mới** kể từ lúc bản sửa khởi động lại
(so với 5 flag báo nhầm ở bản trước đó).

## Bước 6 — Risk Score / Full Audit Mode / audit-logs

**PASS** — đã test cùng lúc với Bước 3 qua test-harness (admin làm được, member bị chặn 403,
dữ liệu tính đúng).

## Bước 7 — Dashboard Governance tab

**PASS.** Tab mới chỉ hiện khi `role === 'admin'` (lọc ở `renderTabs()`, dữ liệu role lấy từ
response login). Nội dung: bảng Risk Score theo nhân viên (chỉ để tham khảo, ghi rõ không tự
động xử lý ai), form bật Full Audit Mode (lý do + số giờ bắt buộc), bảng Flags gần đây, bảng
Audit Logs. Deploy thật, xác nhận `login` trả đúng `role` qua curl mô phỏng CORS.

## Verification cuối cùng (theo đúng yêu cầu plan)

- `systemctl status center-ai-adapter` và `center-ai-control-plane` — cả 2 vẫn `active`, không
  crash-loop, xuyên suốt toàn bộ quá trình sửa + test.
- Request Span (MVP2 hạng mục 2) vẫn hoạt động đúng song song với Governance — xác nhận qua
  test `cost-summary` vẫn PASS trong cùng lần chạy 52/52.
- Test-harness: 39 (cuối MVP2) → **52/52 PASS**, không có regression nào ở phần đã làm trước.

## Chưa làm (đúng phạm vi đã chốt trong plan, không phải bỏ sót)

Data Classification, Approval workflow, và việc nối Full Audit Mode vào chuyện Adapter thật sự
đổi sang lưu nội dung thô có redact — cả 3 đều ghi rõ lý do hoãn trong plan (cần Policy Engine/
cơ chế pending-state/redaction chuẩn trước, làm ẩu ở đây rủi ro hơn không làm). Không có gì
liên quan ngành điện/năng lượng trong toàn bộ đợt này, đúng chỉ đạo của người dùng.

---

# Đợt 2 — Full Audit Mode (lưu nội dung thô có redact) + Context Confidence/ADR (Q15)

> Kế hoạch: xem plan đã duyệt lần 2. Làm đúng phần đã tự hứa hoãn ở Đợt 1 ("để đợt sau khi có
> redaction rõ ràng") — nay có `governance-scan.js` thật, đủ điều kiện làm tiếp.

## Bước 1 — Schema

**PASS.** `005_full_audit_content.sql`: bảng `prompts`/`responses`, mọi dòng bắt buộc gắn
`full_audit_grant_id` (FK, NOT NULL) — không có đường nào chèn được dòng không gắn grant nào.
`006_context_confidence.sql`: thêm `approved_by`/`valid_from`/`valid_to` vào `project_context`
(đã có trong schema đầy đủ mục 11, MVP1 cắt gọn, thêm lại đúng lúc cần), bảng `decision_detail`
(ADR). Xác nhận bằng query trực tiếp trước khi code gì thêm.

## Bước 2 — `redact()` trong `governance-scan.js`

**PASS — 8/8 test cục bộ**, gồm: secret/PII được thay đúng bằng `[REDACTED:<type>]`, phần còn
lại của text giữ nguyên, redact bên trong payload JSON vẫn giữ JSON hợp lệ (quan trọng vì đây
là bản sẽ lưu), số thẻ Luhn-invalid (timestamp...) KHÔNG bị redact nhầm, và — quan trọng nhất —
**scan lại trên bản đã redact không còn phát hiện secret/PII gốc nào**. Tái dùng đúng 1 bộ
pattern với `scanForSecrets`/`scanForPii` (không viết detector thứ 2, tránh 2 bộ lệch nhau).

## Bước 3-4 — Control Plane: endpoint cho cả 2 hạng mục

**PASS — 68/68 test-harness (tăng từ 52)**, test xong TRƯỚC khi đụng Adapter đúng thứ tự plan.

- Hạng mục 1: `GET /internal/v1/governance/active-grant`, `POST /internal/v1/gateway/prompts`
  (re-check grant còn hạn ngay lúc ghi, không chỉ tin Adapter đã check trước đó — defense in
  depth), `GET /v1/work-sessions/:id/prompts` (chỉ admin, **mỗi lần xem tự ghi 1 dòng
  `audit_logs`** — xem là hành động có dấu vết, không phải xem tự do).
- Hạng mục 2: `context/render` và `context-notes` (đã có từ MVP1) nay trả kèm
  `confidence`/`confidence_label` tính lúc đọc (không lưu cứng). `POST /v1/context/:id/decision-detail`
  (ADR) — validate đúng type=decision mới tạo được.
- **Phát hiện thật giữa chừng**: `project_context` từ trước tới giờ CHƯA từng có endpoint tạo
  mới (`/v1/context/ingest` theo mục 12 tài liệu chính chưa xây ở bất kỳ MVP nào) — thêm seed
  data để test được Confidence/ADR trên dữ liệu thật, ghi rõ đây là gap có thật của sản phẩm
  (không phải lỗi đợt này), để làm khi có luồng nhập context thật.
- 1 test tự viết sai giả định (nghĩ Hoàng chưa có grant nào, nhưng grant thật từ lần test Đợt 1
  vẫn còn hiệu lực) — sửa lại test cho đúng với dữ liệu thật, không phải sửa code sản phẩm.

## Bước 5 — Gateway Adapter: nối Full Audit Mode capture thật

**PASS**, test theo đúng thứ tự đã dùng ở Đợt 1 (mock trước → traffic thật → CLI thật):
- a) Mock test gốc — 7/7 PASS, không phá gì.
- b-c) Traffic thật qua Adapter công khai trong lúc Thanh có grant active: 1 request nội dung
  bình thường → lưu đúng nguyên văn; 1 request có CCCD giả lập → **lưu đúng bản đã redact**
  (`[REDACTED:vn_national_id]`), trong khi request gửi THẬT lên Claude vẫn giữ nguyên nội dung
  gốc (đúng Metadata enforcement — chỉ khác nhau giữa bản gửi đi và bản lưu lại).
- d) `company-ai claude` thật (tool-use + streaming) — không bị ảnh hưởng.

**Giới hạn thật, ghi rõ**: không test được đường "không có grant active → không lưu gì" bằng
traffic thật ngay lúc này, vì cả Thanh lẫn Hoàng đều đang có grant active thật tồn đọng từ các
lần test trước (chưa có endpoint revoke). Đường này đã test đúng ở tầng Control Plane (query
không khớp trả về `null`) và đúng theo review code (chỉ 1 điều kiện `if (activeGrant)` duy nhất
dẫn tới việc lưu — không có đường nào khác).

## Bước 6 — CLI + Dashboard hiển thị Confidence

**PASS.** `company-ai claude` thật → `checkpoint.md` hiện đúng
`[decision] ... (Decision — approved, 100% confidence)` và
`[status] ... (Status — 47% confidence)` (khớp đúng công thức decay: 20 ngày tuổi →
100-(20/30)*80≈47%). Dashboard Project Memory thêm cột Confidence (màu theo ngưỡng).

## Verification cuối (theo đúng yêu cầu plan)

- `systemctl status` cả 2 service — active xuyên suốt, không crash-loop.
- Test-harness: 52 → **68/68 PASS**, không regression phần cũ.
- Xác nhận bằng dữ liệu thật (không chỉ tin code): query trực tiếp bảng `prompts` sau traffic
  thật, thấy đúng bản đã redact, không thấy giá trị CCCD gốc `079203012345` ở đâu cả.

## Chưa làm (đúng phạm vi plan đợt 2, không phải bỏ sót)

KPI 4 lớp (đã làm ở Đợt 3 bên dưới — 3/4 lớp), Company Brain `scope_level` (cần bảng
`departments` chưa có + Pattern Library chính tài liệu yêu cầu hoãn tới MVP4), Intent-centric
Q12 (chỉ có ý nghĩa sau khi có dữ liệu prompt/response thật để gắn vào — vừa mới bắt đầu có ở
đợt này), Policy engine, webhook Jira/Linear, workflow offboarding seat — đều cần domain/tích
hợp bên thứ 3 chưa có.

---

# Đợt 3 — KPI 4 lớp (Q22), chỉ 3/4 lớp có dữ liệu thật

> Kế hoạch: xem plan đã duyệt lần 3. Người dùng xác nhận rõ: chỉ làm phần có dữ liệu sẵn
> (Adoption/Efficiency/Collaboration), không đụng/không giả vờ có Outcome.

**PASS — 74/74 test-harness (tăng từ 68).** Đọc-only, không migration mới, không đụng Gateway
Adapter (rủi ro thấp hơn hẳn 2 đợt trước) — `GET /v1/kpi?scope=employee&layer=` (chỉ admin).

- **Adoption**: `ai_active_days` (ngày lịch riêng biệt có Work Session), `tool_adoption` (số
  Tool Session theo từng tool). Không làm "tỷ lệ session classified" — schema không có cột đó.
- **Efficiency**: cost/token trung bình trên mỗi task `status='closed'` — đặt tên rõ là proxy
  cho "accepted" (schema chưa có trạng thái accepted riêng), không overclaim khớp 100% định
  nghĩa gốc. Không làm "time to first PR" (không có khái niệm PR) và "retry/rework rate" (không
  track số lần thử lại, không có proxy đủ tin cậy — không ép số giả).
- **Collaboration**: % handoff đầy đủ (có cả summary lẫn next_steps), thời gian tiếp quản trung
  bình (tái dùng logic NOT EXISTS đã có ở Inbox — Q14), đóng góp context, số ADR đã viết.
- **Outcome**: trả `null` kèm `outcome_note` giải thích rõ lý do ngay trong response — ai gọi
  endpoint cũng thấy ngay đây là thiếu có chủ đích.

**Test bằng dữ liệu thật đã tích luỹ** (không cần dựng kịch bản mới): Thanh —
`ai_active_days >= 1`, `tool_adoption.claude_code > 0`, `handoffs_created >= 1` — đều khớp
đúng khối lượng test thật đã chạy suốt các đợt trước. `closed_task_count = 0` cho cả 2 người
(task demo `task_tng142` chưa từng được đóng status='closed' trong suốt quá trình test) — đúng
là 0, không phải lỗi, hệ thống không bịa số khi chưa có dữ liệu.

Dashboard thêm tab KPI (chỉ admin) — 4 bảng tương ứng, có ghi chú rõ giới hạn ngay dưới mỗi
bảng (không giấu người xem việc metric nào là proxy/chưa đo được).

Test-harness: 68 → **74/74 PASS**. Không đụng Gateway Adapter — không cần restart/test lại.

---

# Vá gap A — Context ingest (Q5/mục 12) + Revoke Full Audit Mode sớm

> Kế hoạch: xem plan đã duyệt "Vá gap A". 2 gap tự phát hiện ở Đợt 2 (`project_context` chưa
> từng có endpoint tạo mới; `full_audit_grants` không revoke sớm được, chỉ tự hết hạn), người
> dùng chọn vá TRƯỚC khi làm tính năng mới. Không đụng Gateway Adapter, không migration mới
> (dùng lại cột/bảng đã có từ Đợt 2) — rủi ro thấp hơn 3 đợt trước.

## Bước 1-2 — Control Plane: 3 endpoint mới

**PASS — 87/87 test-harness (tăng từ 74)**, test khép kín cả vòng (tạo → đọc lại) thay vì chỉ
test riêng lẻ, đúng yêu cầu plan.

- `POST /v1/context/ingest` — mở cho mọi nhân viên (không giới hạn admin, giống bản chất cộng
  tác của `checkpoints`/`handoffs`), validate `type` đúng 1/8 giá trị CHECK constraint, 400 nếu
  thiếu field/sai type. `approved_by` là tự khai (hệ thống chưa có Approval workflow thật —
  ghi rõ giới hạn này, không ép "người duyệt khác người tạo" vì đó là quy tắc riêng của Pattern
  Library ở Q16, không áp dụng chung).
- `POST /v1/governance/full-audit-mode/:id/revoke` (chỉ admin) — set `expires_at = now()`,
  không cần cột mới vì `findActiveFullAuditGrant` đã lọc theo `expires_at > now()`. Idempotent
  (revoke lại grant đã hết hạn/đã revoke vẫn 200), 404 nếu `grant_id` không tồn tại. Ghi
  `audit_logs` action `full_audit_mode_revoked`.
- `GET /v1/governance/full-audit-grants` (chỉ admin) — list kèm `is_active` tính từ
  `expires_at > now()`, cần để biết `grant_id` mà revoke (không có cách nào revoke nếu không
  list được).

## Bước 2 — CLI: `company-ai context add`

**PASS, test thật.** Lệnh mới hỏi project_id (mặc định lấy từ `project.yaml`)/task_id (tuỳ
chọn)/type (chọn từ danh sách)/content/có duyệt luôn không. Test thật: tạo 1 context mới qua
CLI, chạy lại `company-ai claude` — `checkpoint.md` hiện đúng ghi chú vừa tạo kèm
`(Requirement — approved, 100% confidence)`, xác nhận đường CLI → Control Plane → Context
Confidence (Q15) khép kín thật, không chỉ dừng ở API.

## Bước 3 — Dashboard

**PASS.** Project Memory tab: thêm form "+ Thêm ghi chú context" (project/task_id/type/nội
dung/checkbox đã duyệt) ngay trên bảng context-notes đã có, gọi `POST /v1/context/ingest`.
Governance tab: thêm bảng "Full Audit Grants" (scope, lý do, cấp bởi, hết hạn, trạng thái, nút
Revoke trên dòng đang active), gọi `POST /v1/governance/full-audit-mode/:id/revoke`.

Deploy `/srv/center-ai-dashboard/index.html` qua droplet, xác nhận qua curl: HTML trả về khớp
byte-for-byte với bản local (`diff` rỗng), chứa đủ `ingestContextFromForm`/`revokeGrant`/
"Full Audit Grants"/"Thêm ghi chú context". Không có công cụ browser trong môi trường này nên
không tự xem giao diện render được — xác nhận ở tầng HTTP/nội dung HTML, không phải tầng UI
hiển thị, đúng giới hạn đã ghi ở các đợt trước.

## Verification cuối

- Test-harness: 74 → **87/87 PASS** (chạy trực tiếp trên droplet, sourcing đúng
  `/etc/center-ai/control-plane.env`), không regression.
- Không đụng Gateway Adapter — không cần restart/test lại service đó, đúng theo plan.
- Backup file cũ (`index.html.bak-<timestamp>`) giữ lại trên droplet trước khi ghi đè, chưa
  cần dùng tới (rollback tức thời nếu cần).

## Tác dụng phụ tốt của việc vá gap này — đã hoàn tất luôn

Giới hạn đã ghi ở Đợt 2 ("không test được đường 'không có grant active → không lưu gì' bằng
traffic thật vì Thanh/Hoàng đều có grant tồn đọng, chưa có endpoint revoke") nay đã vá xong,
test bằng traffic thật:

1. Revoke toàn bộ 20 grant tồn đọng của emp_thanh/emp_hoang qua chính endpoint vừa xây (200 cho
   cả 20 lần gọi) — xác nhận lại `GET full-audit-grants`: 0/29 grant còn active.
2. Tạo 1 Work Session + Tool Session thật qua Control Plane (không mock), lấy `gateway_token`
   thật do Control Plane tự ký, gửi 1 request thật qua đúng đường công khai
   `https://valeron.tech/v1/messages` (không bypass Adapter) trong lúc **chắc chắn không có
   grant active nào**.
3. Kết quả: request trả về **200 bình thường** (AI vẫn hoạt động đúng, không bị ảnh hưởng bởi
   việc thiếu grant — đúng nguyên tắc Metadata enforcement mặc định), `request_spans` ghi đúng
   1 dòng mới khớp chính xác usage trả về (48 input/26 output) — chứng minh pipeline xử lý bình
   thường. Nhưng bảng `prompts` **0 dòng mới** trong cùng khoảng thời gian — xác nhận đúng: khi
   không có Full Audit Mode active, không có nội dung thô/redact nào được lưu lại, dù request
   vẫn qua Adapter và vẫn được tính phí/usage như bình thường.

Đóng luôn Work Session/Tool Session test sau khi xong (không để lại state test tồn đọng — đúng
tinh thần đã sửa ở chính đợt này). Không cần test-harness case mới cho việc này (đã có case
"active-grant khi không có grant nào khớp -> grant:null" ở tầng Control Plane từ Đợt 2); đây là
xác nhận bổ sung bằng traffic thật đầu-cuối, không phải gap còn thiếu nữa.

---

# Đợt 4 — Policy Engine cơ bản: Data Classification (tầng Project) + Approval workflow (Q13)

> Kế hoạch: xem plan đã duyệt "MVP3 Đợt 4". Mở khoá nền tảng chung cho 4/6 mục MVP3 còn lại
> (Data Classification, Approval, tiền đề cho Pattern Library + seat offboarding ở đợt sau).
> Company Brain `scope_level` và policy theo department cố ý để lại — lý do ghi trong plan.

**Quyết định thiết kế chốt qua AskUserQuestion trước khi lên plan**: Data Classification gắn
nhãn ở **tầng Project** (admin gắn 1 lần/project), KHÔNG làm regex real-time theo từng prompt
như Secret/PII Scan — "dữ liệu khách hàng" vs "mã nguồn nội bộ" vs "công khai" không có pattern
cấu trúc rõ, làm real-time sẽ báo sai/sót nhiều, đi ngược nguyên tắc "không đáng tin thì không
làm" đã giữ xuyên suốt dự án.

## Bước 1 — Schema

**PASS.** Migration `007_policy_approval.sql`: `projects.classification` (mặc định
`unclassified`, CHECK 4 giá trị), bảng `policies` (scope company/project, classification,
requires_approval), bảng `approval_requests` (pending/approved/rejected, `expires_at` chỉ set
khi approved — cùng kiểu với `full_audit_grants`). Xác nhận bằng `\d projects` trực tiếp trên
droplet: `proj_trungnguyen` mặc định đúng `unclassified` — an toàn, không đổi hành vi hiện tại.

## Bước 2 — Control Plane: 7 endpoint mới

**PASS — 115/115 test-harness (tăng từ 87, 28 case mới)**, test khép kín cả vòng (set
classification → tạo policy → access-check chặn → tạo approval request → approve/reject →
access-check lại đúng theo trạng thái mới → reset về mặc định) đúng yêu cầu plan.

- `POST /v1/projects/:id/classification` + `POST`/`GET /v1/policies` (admin) — validate scope
  company (không được có `scope_id`) vs project (bắt buộc `scope_id` là project có thật).
- `GET /internal/v1/governance/access-check` — ưu tiên policy riêng cho project trước, fallback
  company-wide; không có policy hoặc `requires_approval=false` → `allowed:true`.
- `POST /internal/v1/governance/approval-requests` (Adapter gọi khi block) — **upsert**, xác
  nhận gọi 2 lần liên tiếp không tạo trùng pending (nhân viên thử lại nhiều lần không spam).
- `POST /v1/governance/approval-requests/:id/approve|reject` (admin, cần `duration_hours` khi
  approve, giống hệt pattern Full Audit Mode) — chỉ quyết định được request đang `pending`.

**Sự cố lúc test (không phải bug, tự phát hiện + tự giải thích đúng)**: lần test real traffic
đầu tiên qua Adapter cho `emp_thanh` không bị chặn dù đã tạo policy — nghi ngờ bug, debug bằng
cách thêm log tạm thời vào handler, phát hiện: chính approval request của Thanh đã được
test-harness approve (`duration_hours: 1`) từ vài phút trước đó **vẫn còn hiệu lực thật** — hệ
thống hoạt động đúng, không phải lỗi. Xoá log debug, chuyển sang test bằng `emp_hoang` (request
của Hoàng bị test-harness reject, không có approval active) — xác nhận chặn đúng 403.

## Bước 3 — Gateway Adapter: gắn access-check gate

**PASS**, test theo đúng thứ tự đã dùng mọi đợt trước:
- a) Mock suite gốc (`spike/test-harness/run-test.js`) — 7/7 PASS (chạy với
  `CENTERAI_INTERNAL_SERVICE_SECRET` rỗng, xác nhận fail-open không ảnh hưởng gì khi Control
  Plane không cấu hình).
- b) Regression trước khi tạo policy nào: request thật qua `https://valeron.tech/v1/messages`
  với `proj_trungnguyen` còn `unclassified` → **200 bình thường**, không đổi hành vi.
- c) Tạo policy company-wide `customer_data` + classify `proj_trungnguyen` sang `customer_data`
  → request thật của Hoàng → **403 `approval_required`** + tự động tạo đúng 1 dòng
  `approval_requests` pending (xác nhận qua `GET /v1/governance/approval-requests?status=pending`).
- d) Thanh (admin) approve qua API (`duration_hours: 1`) → gửi lại ĐÚNG request đó (token khác,
  cùng employee/project) → **200 bình thường** — xác nhận full cycle chặn → tự tạo yêu cầu →
  duyệt → thông qua hoạt động đúng bằng traffic thật, không chỉ đọc code.
- e) **Revert `proj_trungnguyen` về `unclassified` ngay sau khi xác nhận** — không để lại policy
  chặn ảnh hưởng công việc hàng ngày thật của Thanh/Hoàng. Xác nhận lại qua `\d`/query trực tiếp.
- f) `company-ai claude` thật (không phải chỉ curl) — chạy non-interactive
  (`-p "..." --output-format stream-json --include-partial-messages --verbose`) sau khi đã
  revert, xác nhận toàn bộ pipeline tool-use/streaming/cost vẫn hoạt động đúng, không bị ảnh
  hưởng bởi thay đổi Adapter (`stop_reason: end_turn`, `total_cost_usd` tính đúng).

**Đánh đổi bảo mật cần ghi rõ**: `checkAccess()` fail-open khi Control Plane lỗi/timeout — giống
hệt `checkActiveGrant` (Q23: gateway không được là SPOF chặn cả việc code, uptime P0). Nghĩa là
nếu Control Plane sập, request đáng ra phải bị chặn tạm thời sẽ không bị chặn — đánh đổi nhất
quán với toàn bộ dự án, không phải lối tắt riêng cho đợt này.

## Bước 4 — Dashboard

**PASS.** Governance tab thêm 3 panel: "Phân loại dữ liệu Project" (bảng + form đặt
classification), "Policy" (bảng + form tạo policy company/project), "Yêu cầu duyệt truy cập"
(bảng + nút Duyệt/Từ chối trên dòng pending). Đây là phần UI lớn nhất từ trước tới giờ trong 1
đợt — đúng bài học từ Gap A, không cắt UI để làm nhanh hơn. Deploy, xác nhận qua curl: HTML trả
về khớp byte-for-byte với bản local (`diff` rỗng), chứa đủ `setProjectClassification`/
`createPolicy`/`decideApproval`/"Phân loại dữ liệu Project"/"Yêu cầu duyệt truy cập".

## Verification cuối

- Test-harness: 87 → **115/115 PASS**, không regression.
- Mock suite Adapter: 7/7 PASS trước và sau khi đổi.
- `proj_trungnguyen` xác nhận `unclassified`, không còn policy nào chặn traffic thật của
  Thanh/Hoàng sau khi đợt này kết thúc — kiểm tra trực tiếp DB, không chỉ tin API.
- `systemctl status` cả 2 service `active` xuyên suốt, không crash-loop.

## Chưa làm (đúng phạm vi đã chốt trong plan, không phải bỏ sót)

Policy theo department (chưa có `departments` với dữ liệu thật để scope theo — team chỉ có
Thanh/Hoàng, xây bảng lúc này là xây cho nhu cầu giả định), Pattern Library (Q16 — cần dùng lại
đúng cơ chế Approval vừa xây, để đợt sau), seat offboarding workflow (cũng cần Approval làm
nền), Company Brain `scope_level` (Q16 — độc lập, rẻ, để riêng 1 đợt nhỏ không gộp vào đây).

---

# Đợt 5 — Company Brain `scope_level` (thu hẹp) + Pattern Library (Q16) + Seat Offboarding thật

> Kế hoạch: xem plan đã duyệt "MVP3 Đợt 5". Người dùng yêu cầu "làm hết luôn" các mục còn lại
> của MVP3 — rà lại, 3 mục này làm được thật ngay, phần còn lại (policy theo department, webhook
> Jira/Linear, Intent-centric Q12, Knowledge Graph mở rộng, toàn bộ MVP4) bị chặn bởi thiếu dữ
> liệu thật/tích hợp bên thứ ba/chính tài liệu khoá ghi rõ "chỉ làm sau khi có khách hàng thật" —
> không tự ý lệch khỏi tài liệu, đã giải thích rõ với người dùng trước khi lên plan.

**2 phát hiện thật lúc rà soát trước khi lên plan (không phải bỏ sót, phát hiện mới)**:
1. Company Brain 5 tầng không test được thật với `department`/`company` — pilot chỉ có 1
   project, không có bảng `departments`. **Thu hẹp**: chỉ làm `session|personal|project` có
   nghĩa dùng thật, cột vẫn nhận đủ 5 giá trị cho tương lai.
2. `seats.status`/`seat_runtime_registry.status` ở Control Plane KHÔNG phải nơi Adapter enforce
   thật — Adapter đọc `registry.json` trên đĩa (Q9). Nếu "offboarding" chỉ đổi cột DB thì không
   cắt được quyền truy cập thật — sẽ là tính năng giấy tờ, đúng loại lỗi dự án luôn tránh (tiền
   lệ Gap A). Thiết kế lại: thêm endpoint nội bộ ngay trên Adapter để Control Plane gọi thật.

## Bước 1 — Schema

**PASS.** Migration `008_scope_level_pattern_library.sql`: `project_context.scope_level` (5 giá
trị, mặc định `project`), bảng `pattern_library` đúng theo mục 11 (`source_context_id?, title,
content_anonymized, category, generalized_by, approved_by?`). Xác nhận qua `\d` trực tiếp trên
droplet.

## Bước 2 — Control Plane

**PASS — 138/138 test-harness (tăng từ 115).** `scope_level` thêm vào `context/ingest` (validate
400 nếu sai, mặc định `project` nếu không truyền)/`context-notes`/`context/render`. Pattern
Library: `POST /v1/pattern-library/generalize` (mọi nhân viên, `content_anonymized` do người gọi
tự viết — không có anonymize tự động, cùng lý do đã từ chối regex Data Classification ở Đợt 4),
`POST /v1/pattern-library/:id/approve` (chỉ admin, **bắt buộc khác người generalize**, 400
`cannot_approve_own_pattern` nếu trùng), `GET /v1/pattern-library` (chỉ trả pattern đã duyệt cho
mọi người, `?status=pending` cho admin xem hàng chờ). Seat: `GET /v1/seats`,
`POST /v1/seats/:id/offboard` (chỉ admin, gọi thật sang Adapter, không cập nhật DB nếu Adapter
không xác nhận được).

**Lỗi tìm thấy giữa chừng (không phải bỏ sót — phát hiện bằng test thật)**: sau khi deploy,
test-harness báo FAIL 2 case access-check "chưa duyệt" — nghi bug, nhưng debug bằng log tạm thời
xác nhận: chính approval của lần chạy test-harness TRƯỚC (và của 1 lần test thật thủ công ở Đợt
4) vẫn còn hiệu lực thật trong khung giờ `duration_hours`. Đây là gap có thật giống hệt lớp lỗi
đã vá ở "Vá gap A" cho `full_audit_grants` — `approval_requests` cũng chưa revoke sớm được. Vá
bằng đúng kỹ thuật cũ: thêm `POST /v1/governance/approval-requests/:id/revoke` (admin, idempotent,
`expires_at = now()`), test-harness tự dọn approval tồn đọng trước khi assert "chưa duyệt". Chạy
lại 2 lần liên tiếp xác nhận hết flaky (119/119 rồi 138/138, cả 2 lần đều ổn định).

## Bước 3 — Gateway Adapter: seat status thật

**PASS**, test theo đúng thứ tự mọi đợt trước:
- a) Mock suite gốc 7/7 PASS.
- b) Test cục bộ với mock-router: gọi endpoint mới đổi seat Hoàng sang `unhealthy` → request AI
  thật (mock) → **403 `seat_status_unhealthy`** đúng như enforcement hiện có; đổi lại `healthy`
  → **200 bình thường**. `registry.json` xác nhận đổi đúng, không có lỗi race.
- c) Test thật trên droplet: **KHÔNG dùng seat thật của Thanh/Hoàng** — tạo 1 seat giả lập
  (`seat_test_offboard_verify`, gán tạm cho `emp_thanh` như seat thứ 2, không dùng cho traffic
  thật) qua SQL trực tiếp (không có endpoint tạo seat — cố ý ngoài phạm vi đợt này). Gọi
  `POST /v1/seats/seat_test_offboard_verify/offboard` qua Control Plane thật → xác nhận cả 3
  tầng: `registry.json` seat status = `destroyed` (enforcement thật), DB `seats.status='revoked'`,
  `seat_runtime_registry.status='destroyed'`, `audit_logs` có `seat_offboarded`. Offboard lại lần
  2 → 400 `already_revoked` (không cho offboard 2 lần). Dọn sạch seat giả sau khi xác nhận xong
  (xoá khỏi `registry.json` + DB).
- d) `company-ai claude` thật (tool-use + streaming) sau toàn bộ quá trình — xác nhận seat thật
  của Thanh không hề bị đụng tới, `stop_reason: end_turn` bình thường.

**Giới hạn thật, ghi rõ**: test-harness tự động KHÔNG cover được đường enforcement thật đầu-cuối
(cần seat thật để offboard, không có endpoint tạo seat qua API — ngoài phạm vi đợt này). Test-
harness chỉ cover được đường guard (permission/not-found) qua API. Đường enforcement thật đã xác
nhận thủ công như trên, có bằng chứng cụ thể (registry.json/DB/audit_logs), không phải chỉ đọc
code suy luận.

## Bước 4 — Dashboard

**PASS.** Tab mới "Pattern Library" (mở cho mọi người: form đề xuất generalize, bảng đã duyệt;
riêng admin thấy thêm khu chờ duyệt, nút Duyệt tự ẩn trên pattern của chính admin đó để tránh bấm
vào rồi nhận lỗi vô nghĩa — gate thật vẫn nằm ở API, đây chỉ là UX). Seats tab thêm cột/nút
"Offboard" (chỉ admin thấy, hỏi lý do + xác nhận trước khi gọi). Project Memory: thêm chọn
`scope_level` khi tạo context + cột hiển thị scope_level trên bảng, ghi rõ department/company
chưa có tác dụng thật. Deploy, xác nhận qua curl: HTML khớp byte-for-byte bản local.

## Bước 5 — CLI

**PASS, test thật.** `company-ai context add` thêm `--scope-level` (mặc định `project`, không
hỏi tương tác — chỉ đổi qua flag cho automation). Test thật: tạo context với
`--scope-level personal`, xác nhận qua API đọc lại đúng `scope_level: "personal"`.

## Verification cuối

- Test-harness: 115 → **138/138 PASS** (đã chạy lại nhiều lần xác nhận hết flaky).
- Mock Adapter suite: 7/7 PASS trước và sau khi đổi, registry.json cục bộ về trạng thái sạch sau
  test.
- Seat thật của Thanh/Hoàng không hề bị đụng trong suốt quá trình test — chỉ dùng seat giả lập
  tạo/xoá riêng cho việc test enforcement. `company-ai claude` thật xác nhận không ảnh hưởng.
- `systemctl status` cả 2 service `active` xuyên suốt, không crash-loop.

## Chưa làm (đúng phạm vi đã chốt trong plan, không phải bỏ sót)

Company Brain injection/override logic cho `department`/`company` (cần ≥2 project thật để test
có ý nghĩa), Pattern Library "reuse" tự động giữa project (tài liệu ghi rõ khoá tới MVP4), policy
theo department, webhook Jira/Linear, Intent-centric (Q12), mở rộng Knowledge Graph, toàn bộ
MVP4 — tất cả đều bị chặn bởi thiếu dữ liệu thật/tích hợp bên thứ ba, hoặc chính tài liệu khoá
ghi rõ lý do hoãn, không phải bỏ sót đợt này.

---

# Seat gán qua duyệt — khép nốt "Workflow duyệt gán/thu hồi seat" (mục 14)

> Mục cuối cùng của MVP3 còn làm được ngay không bị chặn bởi thiếu dữ liệu thật/tích hợp bên thứ
> ba. Đợt 5 đã làm xong nửa **thu hồi** (offboard, enforcement thật). Đợt này làm nốt nửa
> **gán**, đối xứng y hệt — sau đợt này MVP3 khép lại đúng phạm vi khả thi hiện tại.

**Quyết định thiết kế**: "gán" là hành động admin trực tiếp (không phải luồng nhân viên-xin/
admin-duyệt qua `approval_requests` — bảng đó có shape cho policy chặn AI theo classification,
không khớp với "admin chủ động gán seat"; team hiện chỉ 2 người đã có seat sẵn, không có kịch
bản thật "nhân viên mới xin seat" để test — giống lý do đã hoãn policy theo department).

**PASS — 154/154 test-harness (tăng từ 149).**

- Gateway Adapter: mở rộng `POST /internal/v1/seats/:id/status` (trước chỉ nhận `status`) nhận
  thêm `employee_id` optional — cần cả 2 để đổi ai sở hữu seat trong `registry.json`, không chỉ
  đổi trạng thái khoẻ/hỏng. Vẫn là đường ghi DUY NHẤT vào file này.
- Control Plane: `POST /v1/seats/:id/assign` (chỉ admin, đối xứng `handleOffboardSeat`) — gọi
  Adapter thật (await, không fire-and-forget) trước khi cập nhật DB, cùng nguyên tắc "không báo
  thành công nếu chưa xác nhận enforcement thật". **Chặn** (400
  `seat_revoked_needs_reprovisioning`) nếu seat đang `revoked` — seat đó cần provision lại thật
  trong 9Router (OAuth account mới) trước, Center AI không sở hữu vòng đời kết nối provider ở
  MVP1 (giới hạn đã ghi từ đầu, không đổi ở đợt này).
- Dashboard: nút "Gán/Đổi người" cạnh Offboard trên Seats tab (chỉ admin).

**Test thật đầu-cuối** (KHÔNG đụng seat thật của Thanh/Hoàng — dùng seat giả lập, đúng kỹ thuật
đã dùng ở Đợt 5): tạo seat test gán sẵn cho `emp_thanh` → gọi `assign` đổi sang `emp_hoang` →
xác nhận cả 3 tầng đổi đúng (`registry.json` employee_id+status, DB `seats`/
`seat_runtime_registry`, `audit_logs` có `seat_assigned`) → offboard seat test để dọn sạch →
thử assign lại seat vừa offboard → xác nhận đúng bị chặn 400
`seat_revoked_needs_reprovisioning`. `company-ai claude` thật của Thanh sau cùng xác nhận không
bị ảnh hưởng.

## Verification cuối

- Test-harness: 149 → **154/154 PASS**, không regression.
- Mock Adapter suite: 7/7 PASS (phát hiện 1 lần FAIL do token test hết hạn 6h TTL — không phải
  regression thật, xác nhận lại bằng cách sinh token mới, PASS lại ngay).
- Seat thật của Thanh/Hoàng không bị đụng trong suốt quá trình test.

## MVP3 — kết luận phạm vi khả thi hiện tại

Với đợt này, **toàn bộ mục MVP3 làm được ngay (không bị chặn bởi thiếu dữ liệu thật/tích hợp bên
thứ ba/chính tài liệu khoá hoãn tới MVP4) đã hoàn tất**: Governance, 2-mode Audit, Context
Confidence/ADR, KPI 4 lớp (3/4), Policy Engine cơ bản (Data Classification + Approval, scope
company/project), Company Brain `scope_level` (3/5 tầng), Pattern Library (gate, chưa reuse tự
động), Workflow gán/thu hồi seat (đủ cả 2 nửa). Phần còn lại của MVP3 (policy/Company Brain theo
department, Pattern Library reuse, mở rộng Knowledge Graph, Intent-centric Q12, webhook
Jira/Linear) đều có lý do hoãn cụ thể đã ghi rõ, không phải bỏ sót.

---

# Bộ tri thức chung — cho xem được, bơm được, dọn sạch được

> Người dùng chỉ đúng gap lớn nhất sau khi nhìn dashboard thật: **thứ quan trọng nhất của sản
> phẩm lại vô hình**. Cơ chế bơm tri thức chạy thật từ MVP1, nhưng không có chỗ nào xem được
> "AI đang biết gì" → khách hỏi là không show được. Đây là câu hỏi trung tâm của cả sản phẩm.

**PASS — 167/167 test-harness (tăng từ 154).**

## 3 vấn đề thật, xác minh bằng dữ liệu thật (không phải suy đoán)

1. **Không xem được từ dashboard** — gap lớn nhất.
2. **Bộ tri thức 90% là rác test**: query thật cho thấy **36/41 dòng** `project_context` là rác
   do **chính test-harness đổ vào mỗi lần chạy** (`test scope_level personal` ×9,
   `...(test vá gap A)` ×21) — tạo row mới mỗi lần và **không bao giờ dọn**. Lỗi thiết kế của
   chính bộ test, và nó bơm thẳng vào thứ AI đọc: nội dung nghiệp vụ thật của Thanh bị 20 bản
   sao rác đẩy ra khỏi giới hạn hiển thị.
3. **3/5 tầng tri thức rỗng ruột**: `company.md`/`team.md`/`project.md` chỉ có comment
   placeholder — `project_context.project_id` là `NOT NULL` nên tri thức company/team (vốn không
   thuộc dự án nào) **về mặt schema là không thể tồn tại**.

## Đã làm

- **Migration 010**: `project_id` bỏ `NOT NULL` → tri thức company/department có chỗ tồn tại.
- **`context-render.js` (Control Plane)**: chuyển toàn bộ logic render 5 file `.md` từ CLI về
  Control Plane. **Lý do bắt buộc**: dashboard cũng phải hiện đúng nội dung AI nhận — nếu mỗi
  bên tự render sẽ có 2 bộ logic lệch nhau, dashboard hiện 1 đằng AI đọc 1 nẻo, hỏng đúng thứ
  giá trị nhất của sản phẩm. Nay CLI lẫn dashboard cùng gọi `GET /v1/context/bundle`.
- **Lọc trùng + ưu tiên** (`selectNotes`): bỏ trùng theo `(type, content)` giữ bản mới nhất; ưu
  tiên `decision`/`requirement` đã duyệt → `known_issue`/`next_step` → `ba_feedback` → `status`;
  giới hạn 15/file. Kết quả thật: **44 ghi chú → 8** sau lọc, nội dung thật nổi lên đầu.
- **Tri thức company/team chỉ admin nhập** (quyết định chốt với người dùng): nội dung này vào AI
  của **mọi dự án, mọi nhân viên** — 1 người ghi sai là cả team bị AI hướng dẫn sai theo.
- **`DELETE /v1/context/:id`** (admin, ghi `audit_logs`) — để test-harness tự dọn.
- **Dashboard tab "AI đang biết gì"**: chọn project → task → hiện **đúng 5 file** AI nhận, kèm
  `stats` nói thật đã lọc bao nhiêu. Admin thấy thêm form nhập tri thức company/team.

## Dọn rác + chặn gốc

- `pg_dump` backup bảng trước khi xoá (`/root/project_context-backup-*.sql`, 46 dòng).
- Kiểm tra FK trước (`decision_detail` không tham chiếu dòng rác nào) → xoá **42 dòng rác**, giữ
  đúng **4 dòng thật**. Bộ tri thức giờ có đủ 3 tầng company/department/project nội dung nghiệp
  vụ thật.
- **Chặn gốc**: test-harness gom `context_id` nó tạo và xoá hết ở cuối mỗi lần chạy.

## Verification (bằng chứng thật, không phải tin code)

- **`diff` file trên đĩa vs endpoint trả về: 5/5 KHỚP byte-for-byte** — bằng chứng dashboard hiện
  chính xác cái AI đọc, không thể lệch. Đây là verification quan trọng nhất của đợt này.
- **Chạy test-harness 3 lần liên tiếp: `count(project_context)` đứng nguyên ở 4** (trước đây mỗi
  lần +3) — bằng chứng rác không còn tích luỹ.
- `company-ai claude` thật chạy đúng sau khi đổi CLI sang bundle; `diff` 5 file trước/sau xác
  nhận: `task.md` **không đổi** (port logic trung thực), `company.md`/`team.md` từ placeholder →
  tri thức thật, `checkpoint.md` giữ nguyên handoff thật của Thanh và sạch rác.
- Test-harness: 154 → **167/167 PASS**. Không đụng Gateway Adapter.

## Chưa làm (ngoài phạm vi, có lý do)

Để AI tự curate/đề xuất dọn bộ tri thức (người dùng có nhắc "AI quản lý AI") — endpoint
`context/bundle` đợt này chính là nền cho việc đó, nhưng chưa làm: chưa có đủ dữ liệu thật để
biết nên curate theo tiêu chí gì, làm bây giờ là đoán. Đồng bộ realtime giữa phiên đang mở và
context mới cũng chưa có (context kéo lúc mở phiên — đúng thiết kế Q18 "chứng minh đã cấp phát,
không chứng minh đã đọc", cần nói rõ với khách chứ không phải bug).

---

# Quản lý được thật: xem lịch sử chat AI + Definition of Done + vá lỗ hổng riêng tư

> Người dùng đặt 4 câu hỏi về quy trình vận hành thật và chốt 1 quyết định kinh doanh: đây là hệ
> thống công ty, dự án công ty, tiền token công ty — **sếp phải xem được dev nhắn gì** (nhìn KPI
> thấy hoạt động ít → dev có nhắn linh tinh đốt token không, ai kiểm được).

**PASS — 182/182 test-harness (tăng từ 167).**

## Lỗ hổng riêng tư nghiêm trọng do chính test-harness gây ra — đã vá

Khảo sát phát hiện: test-harness **tạo Full Audit Mode grant THẬT mỗi lần chạy và không bao giờ
revoke** — 8 grant sống cùng lúc, âm thầm ghi nội dung làm việc thật của Thanh/Hoàng 1-2 tiếng
sau mỗi lần chạy test, **95 prompt đã lưu**. Đúng thứ mà thiết kế 2-mode audit sinh ra để ngăn
(ghi nội dung phải là hành động admin có chủ đích, có lý do, có hạn) — bộ test lách qua bằng cách
tạo grant thật. Cùng lớp lỗi với rác context nhưng **nặng hơn vì đụng quyền riêng tư**.

Đã vá: test-harness gom `grant_id` nó tạo → revoke hết ở cuối lần chạy; dọn 8 grant tồn đọng;
thêm dọn cả task test (2 task/lần chạy cũng lọt vào danh sách task thật).

**Bằng chứng**: chạy 2 lần liên tiếp — grant đang sống **0 → 0 → 0**, task **14 → 14 → 14**.

## Đã làm

- **Migration 011**: `company_settings` (audit_mode: metadata|full — **cấu hình chứ không
  hard-code**, vì khách khác như EVN có thể yêu cầu metadata-only; công ty này seed `full`),
  `prompts.full_audit_grant_id` bỏ NOT NULL + thêm `capture_reason`, `tasks.acceptance_criteria`.
- **Adapter**: `checkActiveGrant` → `checkCapture` — lưu khi `audit_mode='full'` (chính sách
  công ty, không cần grant) HOẶC có grant. Giữ nguyên cache 30s + fail-open (Q23 uptime P0).
- **`GET/POST /v1/settings`**: đọc mở cho **mọi nhân viên** (có quyền biết mình có bị ghi hay
  không), ghi chỉ admin + ghi `audit_logs`.
- **`GET /v1/prompts`** (admin, tự ghi audit_logs mỗi lần xem) + **tab "Lịch sử AI"** trên
  dashboard: xem dev nhắn gì, AI trả gì, lọc theo nhân viên.
- **Definition of Done**: dùng đúng 4 status sẵn có — `done` (dev tự báo xong, mọi nhân viên) →
  `closed` (**chỉ admin/leader duyệt chốt**). Trước đây ai cũng bấm dropdown thành closed là
  xong, không ai duyệt. Thêm `acceptance_criteria` **vào thẳng task.md** → chính AI cũng biết
  "xong" nghĩa là gì, không chỉ biết tên task.

## Nguyên tắc giữ lại dù bật ghi toàn thời gian

- **Vẫn redact secret/CCCD/thẻ trước khi lưu** — bảo vệ **công ty** (DB rò rỉ thì đừng có AWS
  key thật trong đó), không cản sếp đọc nguyên văn dev nhắn gì.
- **Mỗi lần admin xem vẫn ghi `audit_logs`** — minh bạch 2 chiều.
- **`ONBOARDING.md` viết lại cho đúng sự thật**: trước đây ghi *"Mặc định hệ thống KHÔNG lưu nội
  dung bạn chat với AI"* — bật ghi mà giữ dòng đó là **sản phẩm nói dối nhân viên**. Nay nói
  thẳng: công ty bật ghi toàn thời gian, vì sao, nhân viên tự kiểm tra chế độ được, và việc riêng
  tư thì dùng `claude` cá nhân (chạy song song, tách biệt hoàn toàn). Đúng cảnh báo trong chính
  tài liệu đã khoá: *"cần công bố chính sách trước khi triển khai, không triển khai âm thầm rồi
  giải thích sau"*.

## Verification (bằng chứng thật)

- Traffic thật qua `valeron.tech`: prompt mới lưu với `capture_reason='company_policy'`,
  `full_audit_grant_id` NULL, **0 grant đang sống** → ghi theo chính sách công ty, không cần
  grant giả. Admin xem qua `GET /v1/prompts` thấy đúng nội dung + `audit_logs` có dòng mới.
- Mock Adapter suite 7/7 trước và sau khi đổi; `company-ai claude` thật chạy đúng.
- 3 test cũ FAIL sau khi đổi — **không phải bug**, là test đang mã hoá hành vi cũ. Sửa cho đúng
  và **mạnh hơn**: test bảo mật "grant hết hạn → không lưu" nay tự đặt `audit_mode=metadata` để
  kiểm đúng tính chất đó, thêm case "metadata + không grant → 403 capture_not_allowed", rồi trả
  lại chế độ thật của công ty. Không hạ chuẩn test chỉ vì mặc định đổi.
