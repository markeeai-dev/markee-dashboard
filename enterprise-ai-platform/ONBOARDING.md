# Center AI — Hướng dẫn cho nhân viên mới

> Đọc trang này là đủ để bắt đầu làm việc. Không cần đọc tài liệu kiến trúc.

## Center AI là gì (1 phút)

Bạn **vẫn code như cũ** — vẫn VS Code, vẫn Claude Code bản gốc, không có app lạ nào.
Center AI chỉ làm 3 việc quanh đó:

1. **Cấp seat AI riêng cho bạn** — tài khoản Claude của bạn, không dùng chung với ai.
2. **Tự đưa ngữ cảnh dự án vào Claude Code** — task đang làm, quyết định kỹ thuật đã chốt,
   người trước bàn giao gì. Bạn không phải copy-paste hay giải thích lại từ đầu mỗi lần.
3. **Tự ghi lại tiến độ** — để người tiếp quản hiểu việc trong vài phút, không phải hỏi lại bạn.

Bạn được cấp: **email công ty** + **access code** (sếp/admin cấp riêng, không tự lấy trên trang nào).

---

## Cài đặt (1 lần, ~5 phút)

**Cần có trước**: Node.js >= 18 (tải bản LTS ở https://nodejs.org).

```bash
git clone <URL-repo-center-ai>
cd enterprise-ai-platform/spike/cli
```

**Windows** (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

**Linux / macOS / VPS / Git Bash**:
```bash
bash install.sh
```

Script tự kiểm tra Node, tự cài Claude Code CLI (nếu chưa có) và lệnh `company-ai`, rồi báo rõ
nếu thiếu gì. Không tự cài Node hộ bạn — cài Node âm thầm là việc lớn, để bạn tự quyết.

---

## Dùng hằng ngày

### Lần đầu tiên

```bash
company-ai login          # nhập email công ty + access code được cấp
cd <thư-mục-repo-dự-án>
company-ai init           # 1 lần cho mỗi repo — gắn repo với project trên Center AI
```

### Mỗi lần làm việc

```bash
company-ai claude         # chọn task → Claude Code mở ra, đã có sẵn ngữ cảnh dự án
```

Từ đây **làm việc bình thường trong Claude Code** như mọi khi. Center AI tự chạy nền: ghi
usage, chi phí, Git commit, checkpoint. Bạn không phải làm gì thêm.

Thoát Claude Code (kể cả nghỉ trưa rồi mở lại) → phiên làm việc vẫn còn, mở lại là tiếp tục
đúng chỗ cũ.

### Khi xong hẳn việc

```bash
company-ai end            # tổng hợp Git + checkpoint → bản bàn giao nháp → bạn sửa/duyệt → publish
```

Bản bàn giao này là thứ giúp người sau (hoặc chính bạn tuần sau) hiểu ngay đã làm gì, còn gì.

### Lệnh khác khi cần

| Lệnh | Dùng khi |
|---|---|
| `company-ai status` | Xem đang ở phiên nào, task nào, ai đang giữ task |
| `company-ai checkpoint` | Ghi mốc giữa chừng (không đóng phiên) |
| `company-ai task add` | Tạo task mới |
| `company-ai task update <task_id> --status closed` | Đổi trạng thái task |
| `company-ai context add` | Ghi lại 1 quyết định/ghi chú cho cả nhóm thấy |

---

## Dashboard

**https://ops.valeron.tech** — chỉ cần trình duyệt, **không cài gì**.

Đăng nhập bằng đúng email + access code như CLI. Xem được: task, ai đang làm gì, bàn giao gần
nhất, chi phí AI theo người/dự án/task.

Sếp/admin thấy thêm 2 tab: **Governance** (bảo mật, phân loại dữ liệu, duyệt truy cập) và
**KPI**.

---

## Điều cần biết về quyền riêng tư (nói thẳng, không giấu)

- **Mặc định hệ thống KHÔNG lưu nội dung bạn chat với AI.** Chỉ lưu metadata: dùng model gì,
  bao nhiêu token, thuộc task nào, hết bao nhiêu tiền.
- Chỉ khi admin **bật Full Audit Mode** (bắt buộc có lý do + thời hạn, tự hết hạn, ghi log vĩnh
  viễn) thì nội dung mới được lưu — và **luôn được che secret/CCCD/thẻ trước khi lưu**.
- **Mỗi lần admin xem nội dung đã lưu đều bị ghi log** — xem là hành động có dấu vết, không phải
  xem tự do.
- Nội dung có secret thật (AWS key, private key...) sẽ **bị chặn thẳng, không gửi lên AI** — đây
  là bảo vệ bạn lẫn công ty.

---

## Gặp lỗi?

| Triệu chứng | Xử lý |
|---|---|
| `company-ai: command not found` | Thư mục npm global chưa có trong PATH. Chạy `npm config get prefix`, thêm đường dẫn đó vào PATH, mở lại terminal |
| `Chưa đăng nhập` | Chạy `company-ai login` |
| `Chưa có .center-ai/project.yaml` | Chạy `company-ai init` trong thư mục repo |
| `secret_detected` (403) | Nội dung có secret thật — xoá secret khỏi code/prompt rồi thử lại. Đây là chặn có chủ đích |
| `approval_required` (403) | Dự án được phân loại nhạy cảm, cần admin duyệt. Yêu cầu đã tự gửi, báo admin duyệt trên dashboard |
| Task bạn cần không hiện ra | Task thuộc project khác — kiểm tra `.center-ai/project.yaml` |
| Dashboard `Failed to fetch` | Báo admin — thường do mạng/extension chặn, không phải sai mật khẩu |

Còn vướng gì báo admin (hiện tại: Thanh).
