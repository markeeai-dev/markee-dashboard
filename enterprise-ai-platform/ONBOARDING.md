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

## Điều cần biết trước khi dùng (nói thẳng, không giấu)

> Đọc kỹ mục này. Công ty chọn cấu hình này một cách có chủ đích và thông báo trước — không phải
> bật âm thầm rồi giải thích sau.

- **Công ty đang bật ghi nội dung toàn thời gian (`audit_mode = full`).** Nghĩa là: **mọi nội
  dung bạn nhắn với AI và AI trả lời qua `company-ai` đều được lưu lại**, và admin xem được.
- **Vì sao**: đây là seat AI của công ty, dùng cho dự án công ty, chi phí công ty trả. Quản lý
  cần kiểm được chi phí thực sự đi vào việc gì. Bạn có thể tự kiểm tra chế độ hiện tại bất cứ
  lúc nào: dashboard → Governance, hoặc gọi `GET /v1/settings` (mọi nhân viên đều đọc được — bạn
  có quyền biết mình có đang bị ghi hay không).
- **Secret/CCCD/số thẻ luôn được che trước khi lưu.** Cái này bảo vệ cả bạn lẫn công ty: nếu cơ
  sở dữ liệu rò rỉ thì không có key/CCCD thật nằm trong đó.
- **Mỗi lần admin xem nội dung đều bị ghi vào Audit Logs** — minh bạch 2 chiều: sếp xem được bạn,
  nhưng việc sếp xem cũng để lại dấu vết vĩnh viễn, không ai xem lén được.
- Nội dung có secret thật (AWS key, private key...) sẽ **bị chặn thẳng, không gửi lên AI**.
- **Việc riêng tư cá nhân thì đừng dùng `company-ai`** — dùng `claude` bản cá nhân của bạn (chạy
  song song, hoàn toàn tách biệt, công ty không thấy gì). `company-ai` là công cụ cho việc công
  ty; hệ thống không đụng tới phiên cá nhân của bạn.

*(Ghi chú kỹ thuật: hệ thống hỗ trợ 2 chế độ — `metadata` chỉ ghi model/token/chi phí, `full` ghi
cả nội dung. Công ty này chọn `full`. Mỗi lần đổi chế độ đều ghi Audit Logs vĩnh viễn.)*

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
