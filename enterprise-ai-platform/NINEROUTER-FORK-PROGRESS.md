# Fork 9Router → Center AI Router — Tiến độ thực thi

> Kế hoạch tham chiếu plan đã duyệt (rebrand-only, giữ khả năng cập nhật theo upstream). Nhật
> ký PASS/FAIL thật, không phải kế hoạch.

## Đã xác nhận trước khi làm (không phải giả định)

- License MIT (`npm view 9router license` + GitHub API) — fork/rebrand hợp pháp.
- Source đầy đủ, không phải bản compiled — `github.com/decolua/9router`, 22.2k sao, đang
  maintain tích cực.
- **Phát hiện thật**: `src/app/layout.js` hardcode Google Analytics ID của tác giả gốc
  (`G-LC959F603F`) — nếu deploy nguyên bản sẽ âm thầm gửi telemetry sử dụng của Thanh/Hoàng/
  khách hàng sau này về GA của người lạ. Đã xoá.

## Kết quả — PASS toàn bộ

**Fork thật**: `github.com/markeeai-dev/9router` (fork từ `decolua/9router`, giữ remote
`upstream` trỏ đúng bản gốc). Nhánh `master` giữ sạch = upstream, mọi chỉnh sửa nằm trên
nhánh `company-brand` — khi upstream ra bản mới chỉ cần fast-forward `master` rồi rebase
`company-brand`, không phải viết lại.

**Phạm vi đã đổi (6 file, 11 dòng thêm / 10 dòng bớt — cố tình tối giản)**:
- `src/shared/constants/config.js`: `APP_CONFIG.name` — phát hiện đây là nguồn cấu hình trung
  tâm, đổi 1 chỗ propagate ra Sidebar/Footer/trang profile, không cần sửa rải rác.
- `src/app/layout.js`: title/description + **xoá Google Analytics ID gốc**.
- `src/app/manifest.js`: tên hiển thị PWA.
- `src/app/login/page.js`: logo text trang đăng nhập.
- `src/shared/components/Header.js`: 2 dòng mô tả phụ.
- `Dockerfile`: `LABEL org.opencontainers.image.title`.

**Cố tình KHÔNG đổi** (đúng phạm vi "chỉ giao diện", giảm rủi ro merge conflict + không phá
tính năng):
- `src/mitm/` (core proxy/routing) — không đụng.
- `GITHUB_CONFIG`/`UPDATER_CONFIG` trong `config.js` — vẫn trỏ đúng `decolua/9router` thật, vì
  đó là cơ chế tự check bản cập nhật — đúng yêu cầu giữ khả năng update theo upstream.
- Các identifier chức năng: `sk_9router` (default key), symlink `/root/.9router` (data dir),
  hướng dẫn CLI `9router` trong trang login/Update modal (đúng vì chưa đổi tên npm package).
- Trang `landing/` (marketing copy quảng cáo project gốc) — không bị người dùng thật của mình
  chạm tới trong deploy hiện tại (vào thẳng `/login`), để lại nếu sau này cần công khai cho
  mkt/sale thật thì viết lại nội dung marketing đúng cho sản phẩm mình lúc đó.

## Build + deploy thật — theo đúng quy trình thận trọng đã lên kế hoạch

1. Build Docker image trên droplet từ nhánh `company-brand` (`center-ai/router:branded`) —
   build thành công, tái dùng nguyên `Dockerfile` gốc.
2. **Test trên container tạm, volume rỗng riêng trước** — dashboard load đúng branding mới,
   API `/v1/models` trả lời đúng y hệt bản gốc (401 hợp lệ do chưa có provider), không còn GA
   ID gốc trong HTML.
3. Chuyển `router-thanh` (giữ container cũ `router-thanh-old-rollback`, dừng nhưng không xoá,
   để rollback tức thời nếu cần) — xác nhận: branding đúng, **tài khoản Claude thật vẫn kết
   nối, không cần đăng nhập lại** (test bằng API key thật bypass Adapter + test lại đúng đường
   qua Gateway Adapter công khai — cả 2 đều PASS).
4. Chuyển `router-hoang` tương tự — PASS.
5. **Test cuối cùng, quan trọng nhất**: chạy `company-ai claude` thật (Claude Code CLI thật,
   qua toàn bộ pipeline CLI → Control Plane → Gateway Adapter → router đã đổi thương hiệu) —
   hoạt động y hệt bản gốc, không có gì vỡ.

→ **Kết luận: rebrand hoàn tất, 0 downtime cho 2 seat đang dùng thật, không mất kết nối tài
khoản, toàn bộ chuỗi routing/streaming/tool-use xác nhận không đổi hành vi.**

## Việc tiếp theo (không làm trong đợt này, đúng phạm vi đã chốt)

- Thêm connector GPT/OpenAI thật — không cần code gì thêm khi có (9Router đã hỗ trợ sẵn
  `/v1/chat/completions` OpenAI-compatible + `/api/oauth/[provider]/[action]`), chỉ cần kết
  nối account thật qua dashboard khi có.
- Logo/favicon riêng — cần asset thiết kế thật từ người dùng, chưa tự vẽ.
- Viết lại nội dung trang `landing/` — chỉ cần nếu sau này công khai cho mục đích mkt/sale.
- Khi upstream ra bản mới: `git fetch upstream && git merge upstream/master` vào `master` của
  fork, rồi rebase `company-brand` lên trên, build lại, lặp lại đúng quy trình test 3 bước ở
  trên trước khi thay container thật.
