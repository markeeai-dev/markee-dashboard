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

`mock-router` chỉ là 1 HTTP server trả JSON/SSE giả, không phải 9Router thật, không gọi Anthropic/OpenAI thật. Mục đích: xác nhận **logic của Gateway Adapter đúng** (routing theo `seat_id`, không route chéo seat, revoke tức thời, không sửa body, proxy streaming đúng thứ tự) trước khi cắm vào 9Router thật — để khi có 9Router + Claude Team account thật, chỉ cần đổi `registry.json` trỏ sang endpoint 9Router thật, không phải viết lại Adapter.

**Việc tiếp theo (cần 9Router thật + ít nhất 2 Claude Team/Max account thật, xem `../MVP0-SPIKE.md` mục 3):**
1. Cài 9Router thật, dựng 2 container/instance như đã mô tả (Q9).
2. Đổi `gateway-adapter/registry.json` trỏ `endpoint` sang 2 instance 9Router thật thay vì mock-router.
3. Chạy lại `test-harness/run-test.js` — Nhóm A phải vẫn PASS y hệt (không đổi code Adapter).
4. Bổ sung test Nhóm B còn thiếu bằng Claude Code thật: tool-use, prompt caching, OAuth refresh, agent loop dài, cancel request (danh sách đầy đủ ở `../MVP0-SPIKE.md` mục 5, Nhóm B).
5. Điền PASS/FAIL cuối cùng vào `../MVP0-SPIKE.md` mục 6.

## Dọn tiến trình đang chạy nền (nếu cần)

```bash
# Windows/Git Bash — tìm và kill theo port
netstat -ano | grep -E "20128|20129|8080"
# rồi taskkill //PID <pid> //F
```
