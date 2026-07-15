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

## Checkpoint tự động theo từng git commit (git hook)

`company-ai init` cài `.git/hooks/post-commit` (không ghi đè hook có sẵn của dev — nếu đã có
hook khác thì báo và bỏ qua). Mỗi lần `git commit` (kể cả do chính Claude Code tự chạy qua
Bash tool trong lúc `company-ai claude` đang mở) tự gọi `company-ai checkpoint --trigger
git_commit --quiet` — im lặng bỏ qua nếu không có Tool Session nào đang mở, không bao giờ
làm lỗi/chặn commit thật. **Đã test thật**: commit qua Claude Code trong 1 Tool Session đang
mở tạo đúng checkpoint `trigger=git_commit` gắn đúng commit hash, xác nhận qua API.

## Chưa làm — đúng phạm vi, không phải thiếu sót MVP1

`company-ai codex` mới có code path (dùng chung `claude.js`), **chưa test thật** — cần 1
account Codex/OpenAI kết nối qua 9Router trước (chưa có ở pilot này, chỉ có 2 seat Claude).
Lưu ý: theo `ai-operations-center-design.md` mục 15 (bảng "Vào POC ngay | Để MVP2"), hỗ trợ
nhiều connector/provider vốn dĩ **đã là phạm vi MVP2** ("Connector đa nền tảng ... POC chỉ 1
tool Claude Code"), không phải việc còn sót của MVP1 — ghi rõ ở đây để không ai đọc nhầm.

`company.md`/`team.md`/`project.md` luôn để trống ở MVP1 (chưa có nguồn dữ liệu company/team-
level thật).
