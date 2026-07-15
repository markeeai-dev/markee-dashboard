# company-ai — CLI wrapper (MVP1, Track A)

CLI mỏng theo Q24.2 — KHÔNG thay thế Claude Code/Codex, chỉ quản identity, project/task,
Work/Tool Session, context, Git snapshot, handoff. Gọi Control Plane (`spike/control-plane/`)
qua HTTP, mở `claude`/`codex` thật như tiến trình con.

## Cài đặt (máy nhân viên)

```bash
cd cli
npm install
npm link   # để có lệnh `company-ai` toàn máy — bản thật sẽ publish npm registry nội bộ sau
```

## Luồng dùng thật

```bash
company-ai login                       # 1 lần, hỏi email + access code pilot
cd trung-nguyen-social-listening
company-ai init                        # 1 lần / repo — tạo .center-ai/project.yaml + marker CLAUDE.md
company-ai claude                      # mở Claude Code thật qua Gateway Adapter, seat riêng của bạn
# ... làm việc bình thường trong Claude Code, thoát khi xong buổi ...
company-ai status                      # xem Work/Tool Session hiện tại
company-ai checkpoint                  # checkpoint thủ công giữa chừng (không đóng gì)
company-ai end                         # tổng hợp Tool Session + Git diff + checkpoints -> handoff, publish
```

Cờ hữu ích cho automation/test (không thay đổi hành vi hỏi-đáp cho người dùng thật ở TTY):
`--yes` (bỏ qua xác nhận), `--open-issues "a;b"`, `--task <task_id>`, `--model <id>`.

## Đã test thật (không mock) — xem `MVP1-PROGRESS.md` Bước 2/3

Chạy toàn bộ vòng: `login` → `init` → `claude` (Claude Code thật sửa code + `git commit` thật
qua Adapter công khai) → `end` (publish handoff thật) → đổi sang seat khác → `claude` lại →
xác nhận CLI thứ 2 đọc đúng handoff thật của người đầu. Đây chính là kịch bản POC ở mục 15
tài liệu chính, chạy bằng hạ tầng thật, seat thật, không có bước nào giả lập.

## 3 bug thật tìm thấy khi build (không phải giả định — đã sửa, xem code)

1. **Windows: `child_process.spawn('claude', ...)` báo `ENOENT`** dù `claude --version` chạy
   bình thường trong shell — npm global bin trên Windows là shim `.cmd`, `spawn` không tự
   resolve nếu không có xử lý riêng.
2. **`shell: true` + args dạng mảng làm vỡ quoting** (`-A` của 1 lệnh `git commit -A` bị hiểu
   sai) — đúng như cảnh báo `DEP0190` của Node. Sửa bằng `cross-spawn` thay vì tự xử lý quoting.
3. **Nhiều `readline.Interface` tạo/đóng liên tiếp trên cùng 1 stdin đã pipe làm câu hỏi thứ 2
   trở đi bị treo âm thầm** (process thoát code 0 nhưng không chạy hết logic) — chỉ xảy ra khi
   input đến từ pipe (test/automation), không xảy ra với TTY thật, nhưng vẫn là bug thật cần
   sửa vì scripted usage là cách dùng hợp lệ. Sửa bằng cách dùng chung 1 interface suốt vòng
   đời lệnh, đóng đúng 1 lần lúc thoát.

## Chưa làm (đúng phạm vi MVP1, không tự mở rộng)

`company-ai codex` chưa test thật (chỉ chung code path với `claude`, chưa có Codex account
thật để thử). Checkpoint tự động theo TỪNG git commit (không chỉ lúc tool đóng) cần git hook —
để MVP2. `company.md`/`team.md`/`project.md` luôn để trống ở MVP1 (chưa có nguồn dữ liệu).
