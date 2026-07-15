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
