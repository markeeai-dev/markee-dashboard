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

## Tác dụng phụ tốt của việc vá gap này

Giới hạn đã ghi ở Đợt 2 ("không test được đường 'không có grant active → không lưu gì' bằng
traffic thật vì Thanh/Hoàng đều có grant tồn đọng, chưa có endpoint revoke") nay đã có thể vá —
endpoint revoke vừa xây cho phép dọn sạch grant tồn đọng rồi test lại đường đó bằng traffic
thật. Chưa thực hiện lại test đó trong đợt này (ngoài phạm vi "vá gap A" đã chốt), để dành cho
lần sau nếu cần xác nhận thêm.
