# Operations Runbook — Internal Pilot

> Hướng dẫn vận hành thực tế cho pilot — không phải tài liệu kiến trúc (đó là
> `ai-operations-center-design.md`), đây là "làm sao để giữ hệ thống chạy/sửa khi có sự cố".

## Hạ tầng hiện tại

- Droplet: `103.253.146.113` (SSH root, mật khẩu quản lý riêng — không lưu trong repo).
- Control Plane: `systemctl {status|restart} center-ai-control-plane`, code tại
  `/opt/center-ai-control-plane/control-plane/`, log qua `journalctl -u center-ai-control-plane`.
- Gateway Adapter: `systemctl {status|restart} center-ai-adapter`, code tại
  `/opt/center-ai-adapter/gateway-adapter/`, sở hữu duy nhất file
  `/opt/center-ai-adapter/gateway-adapter/registry.json` (seat runtime thật — không sửa tay trừ
  khi khẩn cấp, có backup tự động trước khi Adapter ghi).
- 9Router: 2 container `router-thanh`/`router-hoang` (`docker ps` để xem), mỗi container 1
  OAuth connection thật, dữ liệu ở `/app/data/db/data.sqlite` (đọc bằng `better-sqlite3` có sẵn
  trong image, không cần cài thêm).
- Postgres: container `center-ai-pg`, truy vấn qua
  `docker exec center-ai-pg psql -U center_ai -d center_ai`.
- Dashboard: `https://ops.valeron.tech` (tĩnh, deploy bằng cách ghi đè
  `/srv/center-ai-dashboard/index.html`, luôn backup bản cũ trước khi ghi đè).

## Deploy 1 thay đổi (quy trình đã dùng suốt dự án)

1. Sửa file cục bộ trong `spike/`.
2. `node -c <file>` (hoặc kiểm cú pháp JS trong `<script>` của dashboard) trước khi deploy.
3. `pscp` file lên đúng đường dẫn trên droplet.
4. Nếu là Control Plane/Adapter: `systemctl restart <service>`, rồi chạy lại
   `test-harness/run-test.js` (nguồn secret: `source /etc/center-ai/control-plane.env`).
5. Nếu là dashboard: `curl` lại trang, `diff` với bản local để chắc chắn khớp byte-for-byte.
6. Copy file đã sửa vào checkout `gh` riêng (không phải thư mục làm việc chính), grep secret
   trước khi `git add`, commit, push lên `feature/enterprise-ai-platform-mvp0-spike`.
7. Xác nhận `main` không bị đụng: `git diff $(git merge-base origin/main <branch>) <branch>
   --stat -- . ':!enterprise-ai-platform'` phải rỗng.

## Vận hành seat

- Xem seat: `GET /v1/seats` (admin) hoặc tab "Seats & Employees" trên dashboard.
- Gán/đổi người giữ seat: nút "Gán/Đổi người" (dashboard) hoặc
  `POST /v1/seats/:id/assign` (`{employee_id, reason}`).
- Thu hồi seat (cắt quyền truy cập AI thật ngay lập tức): nút "Offboard" hoặc
  `POST /v1/seats/:id/offboard` (`{reason}`). **Không thể hoàn tác qua dashboard** — seat đã
  `revoked` cần cấp lại OAuth thật trong 9Router trước khi gán lại được.
- Nếu Adapter không phản hồi khi assign/offboard → Control Plane trả 502, KHÔNG cập nhật DB
  (đảm bảo DB không nói "đã xong" trong khi seat vẫn còn quyền truy cập thật).

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Test-harness FAIL bất ngờ | Token test hết hạn (TTL 6h) | Chạy lại `generate-tokens.js` (mock) hoặc login lại lấy token mới (thật) |
| `access-check`/`approval` trả sai kết quả khi test lại | Approval/grant từ lần chạy trước vẫn còn hiệu lực | Dùng endpoint `revoke` tương ứng trước khi test lại, đừng giả định trạng thái sạch |
| Dashboard trắng/lỗi JS | Cú pháp sai chưa bắt được trước deploy | Luôn chạy `node -e "new Function(...)"` trên nội dung `<script>` trước khi `pscp` |
| Seat báo `seat_status_unhealthy`/`403` bất ngờ | `registry.json` bị đổi (offboard nhầm, hoặc file bị sửa tay) | Kiểm tra `registry.json` trực tiếp, dùng `assign` để gán lại đúng người nếu cần |
| Company-ai claude không thấy task mới | `task_id` không đúng project hiện tại | Kiểm tra `.center-ai/project.yaml` khớp `project_id` của task |

## Giới hạn môi trường đã biết (không phải bug, là giới hạn công cụ)

- Không có trình duyệt thật để xem dashboard — mọi xác nhận UI làm ở tầng HTTP/API + đọc mã
  nguồn HTML, không phải xem trực tiếp giao diện render.
- Không mô phỏng được Ctrl+C thật từ người dùng thật (không có TTY tương tác) — code xử lý
  SIGINT/SIGTERM đã viết đúng hướng nhưng cần 1 người thật xác nhận lần cuối.
- Không test được `/compact` thật (cần phiên Claude Code tương tác nhiều lượt qua TTY thật).
- Không test được OAuth refresh dài hạn hay quota exhaustion thật (cần thời gian/quota thật).

## Hướng đi cho tích hợp Linear (khi cần)

Chưa viết connector vì không có account Linear thật để test — nhưng đây là rào cản **dễ gỡ**:
Linear có gói miễn phí, đăng ký chỉ cần email, lấy Personal API Key ngay trong phần cài đặt tài
khoản (Settings → API → Personal API keys), không cần duyệt tổ chức. Nếu muốn làm connector thật
(4 chức năng: `listProjects`, `listAssignedTasks`, `getTask`, `addComment`):
1. Tạo 1 workspace Linear miễn phí (2 phút), tạo vài issue test giống thật.
2. Lấy Personal API Key, đưa cho phiên làm việc kế tiếp (không commit vào repo).
3. Control Plane thêm 1 bảng nhỏ map `tasks.external_issue_id` ↔ Linear issue (cột đã có sẵn từ
   trước — `external_source`/`external_issue_id`/`last_synced_at`), viết đúng 4 hàm trên, test
   thật với workspace vừa tạo trước khi coi là xong — đúng kỷ luật đã giữ suốt dự án.

Không nên viết connector trước khi có account thật để test — sẽ là code không kiểm chứng được.
