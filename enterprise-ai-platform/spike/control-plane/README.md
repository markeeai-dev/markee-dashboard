# Control Plane (MVP1, Track C)

Dịch vụ Node thuần (không framework, cùng style `gateway-adapter/`) + Postgres, sở hữu
`employees/projects/tasks/work_sessions/tool_sessions/checkpoints/project_context/handoffs/
seats/seat_runtime_registry`. Xem `schema.sql` để biết chỗ cắt gọn so với mục 11 tài liệu
chính (đã ghi rõ trong comment, không cắt âm thầm).

**Không sở hữu**: routing AI request (Gateway Adapter, không đổi ở đây), vòng đời container
9Router (để MVP2 — pilot vài người chưa cần tự động tạo/huỷ container).

## Chạy

```bash
cd control-plane
npm install
# .env cần: PORT, HOST, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD,
#           CENTERAI_TOKEN_SECRET (PHẢI khớp secret Gateway Adapter đang dùng),
#           CENTERAI_EMPLOYEE_TOKEN_SECRET (secret riêng, khác với secret trên),
#           GATEWAY_BASE_URL (vd https://valeron.tech)
psql < schema.sql       # 1 lần
node seed.js            # 1 lần, idempotent
node server.js
```

Test: `node test-harness/run-test.js` — 18/18 tiêu chí PASS lần chạy gần nhất (bao gồm gọi
thật qua Gateway Adapter công khai bằng token do Control Plane mint, không mock).

## Deploy thật đang chạy

Systemd service `center-ai-control-plane` trên droplet `103.253.146.113`, bind
`127.0.0.1:8090` (không lộ internet, chỉ CLI wrapper trên máy nhân viên gọi qua — sau này
nếu cần public thì qua nginx như Adapter, chưa cần ở MVP1 vì `company-ai` gọi trực tiếp).
Postgres chạy Docker (`center-ai-pg`, cũng chỉ `127.0.0.1`), volume `/srv/center-ai-pg`.

## Phát hiện thật đáng chú ý (không phải giả định)

**9Router nối thêm `data: [DONE]` ngay sau khối JSON kể cả ở response non-streaming, không
có dấu phân cách** — xác nhận bằng `xxd` trực tiếp trên 9Router (bypass Adapter hoàn toàn),
nên đây là hành vi gốc của 9Router, không phải Adapter làm sai lệch. Bất kỳ client nào dùng
`JSON.parse`/`res.json()` nghiêm ngặt (không phải SDK streaming-aware) đều phải tự cắt bỏ
`data: [DONE]` trước khi parse — xem cách xử lý trong `test-harness/run-test.js`. Ghi chú
này quan trọng nếu sau này `company-ai` CLI tự gọi HTTP JSON thay vì qua Anthropic SDK.

## API (tóm tắt — chi tiết đọc `server.js`)

```
POST /v1/auth/login {email} -> {employee_id, employee_token}
GET  /v1/projects
GET  /v1/projects/:id/tasks
POST /v1/work-sessions {task_id} -> tạo/resume, mint không kèm token gateway (chỉ seat_id)
POST /v1/work-sessions/:id/end
POST /v1/work-sessions/:id/tool-sessions {tool, machine_id} -> mint gateway_token (Q9/Q18)
POST /v1/tool-sessions/:id/checkpoints {trigger, completed, remaining, files_changed, git_commit, git_branch}
POST /v1/tool-sessions/:id/end
POST /v1/handoffs {task_id, work_session_id, summary, open_issues, next_steps}
GET  /v1/handoffs/:task_id -> handoff mới nhất
GET  /v1/context/render?task_id= -> {task, latest_handoff, context_notes}
```

Mọi endpoint (trừ `/v1/auth/login`) yêu cầu `Authorization: Bearer <employee_token>` —
token nhân viên (khác hoàn toàn với `gateway_token` dùng để gọi AI qua Adapter).
