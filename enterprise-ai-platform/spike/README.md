# Spike code — Gateway Feasibility (bản mock)

Code thật cho phần **có thể làm được mà không cần 9Router/Claude Team account thật**. Xem kết quả đầy đủ ở `../MVP0-SPIKE.md` mục 6. Không cần `npm install` — chỉ dùng Node built-in (`http`, `crypto`, `fs`).

## Cấu trúc

```
spike/
├── shared/token.js          — sign/verify token nghiệp vụ (HMAC-SHA256, tự viết)
├── mock-router/server.js    — giả lập 1 instance 9Router (1 seat/process)
├── gateway-adapter/
│   ├── server.js            — Gateway Adapter thật (Metadata enforcement mặc định)
│   ├── registry.js          — đọc Seat Runtime Registry
│   └── registry.json        — registry giả lập (Control Plane thật sẽ thay bằng DB — Q9)
├── scripts/generate-tokens.js — sinh token thử cho Thanh/Hoàng
└── test-harness/run-test.js — chạy toàn bộ test, in PASS/FAIL
```

## Chạy lại từ đầu

Mở 4 terminal (hoặc chạy nền bằng `&`):

```bash
# 1. Mock router cho Thanh
cd spike/mock-router && SEAT_NAME=seat_claude_thanh PORT=20128 node server.js

# 2. Mock router cho Hoàng
cd spike/mock-router && SEAT_NAME=seat_claude_hoang PORT=20129 node server.js

# 3. Gateway Adapter
cd spike/gateway-adapter && PORT=8080 node server.js

# 4. Sinh token rồi chạy test
cd spike/scripts && node generate-tokens.js
cd spike/test-harness && node run-test.js
```

Log Request Span ghi ở `spike/logs/request-spans.jsonl` (1 dòng JSON/request, kể cả request bị từ chối — có `flagged: true`).

## Đây KHÔNG phải spike thật — là bước de-risk trước spike thật

`mock-router` chỉ là 1 HTTP server trả JSON/SSE giả, không phải 9Router thật, không gọi Anthropic/OpenAI thật. Mục đích: xác nhận **logic của Gateway Adapter đúng** (routing theo `seat_id`, không route chéo seat, revoke tức thời, không sửa body, proxy streaming đúng thứ tự) trước khi cắm vào 9Router thật.

**`9router` đã xác nhận là package npm/Docker thật (`decolua/9router`) — đã cài và test thật (không phải trong repo này) để lấy thông tin dưới đây. Chi tiết đầy đủ ở mục "Đã xác nhận thật" trong `../ai-operations-center-design.md` Q9.**

### Việc tiếp theo khi có host + 2 Claude Team/Max account thật

```bash
# 1. Dựng 2 container, MỖI CÁI RIÊNG, port host khác nhau (container internal luôn là 20128)
docker run -d --name router-thanh -p 29128:20128 \
  -v /srv/9router/thanh:/app/data -e DATA_DIR=/app/data decolua/9router:latest
docker run -d --name router-hoang -p 29129:20128 \
  -v /srv/9router/hoang:/app/data -e DATA_DIR=/app/data decolua/9router:latest

# 2. Mở dashboard mỗi container 1 lần (http://<host>:29128, :29129) — set admin password
#    lần đầu (không có API bootstrap, phải qua UI), connect ĐÚNG 1 Claude Team/Max
#    account/instance qua OAuth, tạo 1 API key trong mục Keys.

# 3. QUAN TRỌNG NHẤT — kiểm tra thủ công trong dashboard mỗi instance:
#    - KHÔNG tạo combo/fallback chain nào
#    - KHÔNG connect thêm provider "free" nào (Kiro AI, OpenCode Free...)
#    9Router quảng cáo round-robin/fallback-free như tính năng chính — phải tắt bằng tay,
#    không có cờ "enterprise mode" nào tự tắt hộ.
```

Sau đó:

1. Đổi `gateway-adapter/registry.json`: `endpoint` → `http://<host>:29128`/`29129`, `api_key` → key thật vừa tạo (không phải token nghiệp vụ Center AI — code Adapter đã tự đổi header đúng chỗ, xem comment trong `server.js`).
2. Chạy lại `test-harness/run-test.js` — Nhóm A phải vẫn PASS y hệt (không cần đổi code Adapter/test-harness, chỉ đổi registry.json và endpoint mock router bằng 9Router thật).
3. Đổi 2 script/process giả lập Claude Code trong test-harness thành Claude Code thật, set `ANTHROPIC_BASE_URL` trỏ Gateway Adapter — bổ sung test Nhóm B còn thiếu: tool-use, prompt caching, OAuth refresh, agent loop dài, cancel request (danh sách đầy đủ ở `../MVP0-SPIKE.md` mục 5, Nhóm B).
4. Điền PASS/FAIL cuối cùng vào `../MVP0-SPIKE.md` mục 6.

## Dọn tiến trình đang chạy nền (nếu cần)

```bash
# Windows/Git Bash — tìm và kill theo port
netstat -ano | grep -E "20128|20129|8080"
# rồi taskkill //PID <pid> //F
```
