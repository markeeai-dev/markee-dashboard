# Ops Dashboard (MVP1, Bước 4 — tối giản)

1 file HTML tĩnh + JS thuần (không framework, không build step) — đúng tinh thần "tối giản"
mục 15/Q24.10: Projects & Tasks, Active Sessions, Handoffs, Project Memory, Seats & Employees
+ trang chủ (Đang làm / Cần tiếp quản / Context mới).

**Không đụng app Next.js/Supabase hiện tại (chat web)** — đây là ứng dụng hoàn toàn tách biệt,
phục vụ tĩnh qua nginx ở subdomain riêng, gọi thẳng Control Plane qua CORS (đã bật ở
`control-plane/server.js`).

## Deploy thật đang chạy

`https://ops.valeron.tech` — nginx phục vụ tĩnh từ `/srv/center-ai-dashboard/index.html` trên
droplet, HTTPS qua Certbot. Đăng nhập bằng đúng email + pilot access code như CLI (gọi cùng
`POST /v1/auth/login` ở Control Plane, token lưu `localStorage` trình duyệt).

## Đã test

- Trang tĩnh load được (200), CORS preflight + request thật từ origin `ops.valeron.tech` gọi
  `cp.valeron.tech` đều đúng (xác nhận bằng curl mô phỏng header `Origin`).
- Toàn bộ endpoint dữ liệu dashboard dùng đã có trong 25/25 test-harness của Control Plane
  (`control-plane/test-harness/run-test.js`).
- **Chưa test bằng trình duyệt thật** (môi trường build này không có công cụ browser) — logic
  JS thuần, đơn giản (fetch + render chuỗi HTML), rủi ro thấp, nhưng nên tự mở thử
  `https://ops.valeron.tech` một lần trước khi coi là xong hẳn.

## Bảo mật

Trang shell tĩnh public (không có gì bí mật trong HTML/JS chính nó), nhưng **mọi dữ liệu đều
đòi hỏi đăng nhập thật qua Control Plane** (`access_code` + email hợp lệ) — khác với 2
dashboard 9Router hiện đang "public trần" theo quyết định trước đó. Không cần thêm Cloudflare
Access riêng cho trang này trừ khi muốn chặn cả việc nhìn thấy màn hình đăng nhập.
