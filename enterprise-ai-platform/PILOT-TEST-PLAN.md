# Internal Pilot — Test Plan

> Mục tiêu: chạy 1 câu chuyện thật xuyên suốt bằng công việc thật của công ty, không phải demo
> dàn dựng. Tài liệu này đối chiếu giữa "đã test rời rạc suốt quá trình build" (bằng chứng có
> thật, có ngày/log cụ thể) và "cần thời gian thật trôi qua" (không thể rút ngắn bằng code).

## Câu chuyện phải chạy được trọn vẹn

> Sếp tạo nhân viên, thêm seat Claude, gán seat cho Thanh. Thanh mở dự án, chọn task, Claude Code
> tự nhận context công ty và làm việc bằng đúng seat được cấp. Hệ thống ghi usage, model, session
> và Git. Thanh kết thúc thì sinh handoff. Hoàng mở cùng task bằng seat riêng và tiếp tục mà
> không cần hỏi lại Thanh. Sếp xem được toàn bộ tiến độ, chi phí và tài nguyên trên dashboard.

**Đã chạy được trọn câu chuyện này bằng traffic thật, nhiều lần, trong suốt quá trình build** —
không phải suy đoán. Bằng chứng cụ thể nằm trong `MVP1-PROGRESS.md` (kịch bản Thanh→Hoàng đầu
tiên), `MVP2-PROGRESS.md` (handoff LLM, task claim), và các lần test end-to-end lặp lại ở
`MVP3-PROGRESS.md` mỗi khi thêm governance mới (luôn chạy lại đúng câu chuyện này để xác nhận
không phá luồng chính).

## Đối chiếu 8 kịch bản bắt buộc

| Kịch bản | Trạng thái | Bằng chứng |
|---|---|---|
| A — Làm việc bình thường (chọn task, code, commit, end) | ✅ Đã test nhiều lần | Mọi *-PROGRESS.md, lần gần nhất: task management round |
| B — Nghỉ rồi mở lại, phải resume đúng Work Session | ✅ Đã test | `"resumed": true` xác nhận qua log thật (`chưa quá 6h không hoạt động`) |
| C — Bàn giao, người sau tiếp quản dưới 10 phút | ✅ Đã test | `MVP1-PROGRESS.md` — Hoàng tiếp quản đúng việc Thanh làm không cần hỏi lại |
| D — Làm song song 2 task/subtask khác nhau | ✅ Đã test | `MVP2-PROGRESS.md` — task claim/lease, cảnh báo trùng file |
| E — Gateway/runtime lỗi, không nhảy seat | ✅ Đã test | Suspend seat Thanh → 403, Hoàng không ảnh hưởng (MVP0 + lặp lại ở Đợt 5 offboard) |
| F — Account hết quota, fail closed | ⬜ **Chưa test được** | Cần đốt hết quota thật của 1 account — không nên làm chỉ để test, để tự nhiên xảy ra trong pilot thật rồi ghi nhận |
| G — BA sửa acceptance criteria, phiên mới nhận bản mới | 🟡 Test được bản nội bộ, chưa test qua Linear thật | `context/ingest` mới → phiên sau đọc đúng context mới (đã test), nhưng chưa qua Linear vì chưa tích hợp |
| H — Thu hồi nhân viên, token cũ vô hiệu | ✅ Đã test kỹ | `MVP3-PROGRESS.md` Đợt 5 — seat offboard enforcement thật qua `registry.json`/DB/audit_logs |

## Phát hiện mới nhất (test thật, không phải suy đoán)

**Cancellation (SIGINT giữa stream)**: test thật phát hiện `kill -INT` gửi từ 1 tiến trình khác
không tới được `company-ai claude` một cách tin cậy trên Windows/Git Bash — hệ quả: nếu bị ngắt
đột ngột, Tool Session bị bỏ lại `ended_at` NULL, không có checkpoint (không phải lỗ hổng bảo
mật — token vẫn tự hết hạn đúng TTL, seat vẫn cô lập đúng — chỉ mất thông tin cho handoff). Đã
sửa: `spike/cli/lib/commands/claude.js` bắt `SIGINT`/`SIGTERM` ngay trên tiến trình wrapper, luôn
chạy đúng bước dọn (checkpoint + đóng Tool Session) trước khi thoát. **Giới hạn xác nhận**: môi
trường test không có TTY thật nên không mô phỏng được đúng phím Ctrl+C thật của người dùng —
`kill -INT` từ tiến trình nền không phản ánh đúng cách Windows console gửi tín hiệu cho Node
(khác cơ chế). Code đã deploy, đúng hướng kỹ thuật, nhưng **cần 1 người thật bấm Ctrl+C thật
trong terminal thật để xác nhận cuối cùng** — đây là việc pilot thật sẽ tự nhiên xác nhận được.

## Tiêu chí đủ để demo cho khách hàng lớn

| Tiêu chí | Trạng thái |
|---|---|
| 100% request test đi đúng seat, không route chéo | ✅ Test tự động (mock suite), lặp lại mọi đợt |
| Không có provider ngoài whitelist | ✅ Vừa xác nhận qua SQL thật: mỗi container đúng 1 connection, không có pool/combo nào có thể fallback |
| Hai nhân viên dùng thật ổn định | ✅ Thanh/Hoàng dùng thật xuyên suốt session build |
| Handoff giúp người sau hiểu task dưới 10 phút | ✅ Đã test thật (kịch bản C) |
| Context lấy đúng từ task/decision chính thức | 🟡 Đúng cho context nội bộ (Confidence/ADR), chưa qua Linear thật |
| Dashboard giải thích được chi phí theo nhân viên/project/task/model | ✅ KPI Efficiency + cost-summary, số liệu thật không giả |
| Revoke seat có hiệu lực | ✅ Test thật đầu-cuối (registry.json/DB/audit_logs) |
| Gateway lỗi không lộ credential | ✅ Adapter chỉ forward, không log giá trị secret/token thật |
| Audit log cho thao tác admin quan trọng | ✅ `audit_logs` append-only, mọi grant/revoke/offboard/assign đều ghi |
| Có log của toàn bộ luồng | ✅ `request_spans` + `audit_logs`, không có video (chưa quay) |
| Có số liệu pilot thật (task, session, takeover time, lỗi gặp) | ⬜ Cần chạy pilot thật 1-2 tuần mới có số liệu tích luỹ đủ dài |

## Việc cần thời gian thật, không thể rút ngắn bằng code

- Chạy pilot thật 1-2 tuần với ≥1 project thật, 3-5 task thật, 2 nhân viên, 2 seat, 2 máy.
- OAuth refresh dài hạn (cần chờ token hết hạn tự nhiên).
- Quota exhaustion thật (không nên chủ động đốt quota chỉ để test).
- Xác nhận Ctrl+C thật từ 1 người dùng thật trong terminal thật.

## Chưa làm, có lý do cụ thể (không phải bỏ sót)

Linear connector thật (cần account thật — xem đề xuất trong `OPERATIONS-RUNBOOK.md`), `/compact`
test thật (cần TTY tương tác), video luồng đầy đủ (chưa quay, làm khi chuẩn bị demo thật).
