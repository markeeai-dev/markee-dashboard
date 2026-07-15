'use strict';
// Center AI Gateway Adapter — spike tối giản (Q9, Q24.10, v16)
//
// Trách nhiệm đúng theo tài liệu đã khoá:
//   - Xác thực token nghiệp vụ đã ký (KHÔNG tin bất kỳ header/env var nào khác)
//   - Kiểm seat_id có đang gán đúng employee_id không (Q9 — 1 người có thể nhiều seat)
//   - Tra Seat Runtime Registry theo seat_id để route đúng instance (KHÔNG route
//     theo employee_id một mình — đó là lỗi đã sửa ở v16)
//   - MẶC ĐỊNH Metadata enforcement: KHÔNG sửa nội dung request, chỉ forward nguyên vẹn
//   - Sở hữu Request Span (business telemetry) — ghi log tại đây, không đợi 9Router đẩy về
//
// KHÔNG làm trong spike: Prompt enforcement (sửa body), quota thật, cost thật —
// đó là MVP1/MVP2 (xem mục 15 tài liệu chính).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { verifyToken } = require('../shared/token');
const { resolveSeat } = require('./registry');

const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.CENTERAI_TOKEN_SECRET || 'spike-dev-secret-change-me';
// Cho phép override đường dẫn log lúc deploy thật (không phải lúc nào cũng chạy
// đúng từ thư mục spike/ có sẵn logs/ cạnh nó) — sửa lỗi thật gặp khi deploy lên
// droplet: thư mục logs/ không tồn tại làm appendFileSync throw, làm CHẾT CẢ SERVER
// (bug nghiêm trọng — lỗi ghi log không bao giờ được phép làm sập service chính).
const LOG_PATH = process.env.LOG_PATH || path.join(__dirname, '..', 'logs', 'request-spans.jsonl');
fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

function logSpan(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {
    // Không bao giờ để lỗi ghi log làm sập request đang xử lý hay cả service.
    console.error('[adapter] logSpan write failed (non-fatal):', err.message);
  }
  console.log('[adapter]', JSON.stringify(entry));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const gatewayRequestId = crypto.randomUUID();
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Env vars CENTER_AI_* nếu có mặt trong request (vd header debug) KHÔNG được đọc
  // ở đây để quyết định identity — chỉ token mới có giá trị (security contract Q24.2).

  if (!token) {
    logSpan({
      gateway_request_id: gatewayRequestId,
      status: 'rejected',
      reason: 'missing_token',
      flagged: true,
    });
    return sendJson(res, 401, { error: 'missing_token', gateway_request_id: gatewayRequestId });
  }

  const verified = verifyToken(token, SECRET);
  if (!verified.ok) {
    logSpan({
      gateway_request_id: gatewayRequestId,
      status: 'rejected',
      reason: verified.reason, // malformed | bad_signature | expired
      flagged: true,
    });
    return sendJson(res, 401, {
      error: `invalid_token:${verified.reason}`,
      gateway_request_id: gatewayRequestId,
    });
  }

  const { employee_id, seat_id, work_session_id, tool_session_id, project_id, task_id } =
    verified.payload;

  if (!employee_id || !seat_id) {
    logSpan({
      gateway_request_id: gatewayRequestId,
      status: 'rejected',
      reason: 'missing_claims',
      flagged: true,
    });
    return sendJson(res, 401, { error: 'missing_claims', gateway_request_id: gatewayRequestId });
  }

  const seat = resolveSeat(seat_id, employee_id);
  if (!seat) {
    // seat không tồn tại HOẶC không thuộc về employee_id này — đây chính là
    // invariant quan trọng nhất (không route chéo seat), test-harness sẽ cố tình
    // gửi token seat_id/employee_id lệch nhau để xác nhận nhánh này kích hoạt.
    logSpan({
      gateway_request_id: gatewayRequestId,
      employee_id,
      seat_id,
      status: 'rejected',
      reason: 'seat_not_assigned_to_employee',
      flagged: true,
    });
    return sendJson(res, 403, {
      error: 'seat_not_assigned_to_employee',
      gateway_request_id: gatewayRequestId,
    });
  }

  if (seat.status !== 'healthy') {
    logSpan({
      gateway_request_id: gatewayRequestId,
      employee_id,
      seat_id,
      status: 'rejected',
      reason: `seat_status_${seat.status}`,
      flagged: false,
    });
    return sendJson(res, 403, {
      error: `seat_status_${seat.status}`,
      gateway_request_id: gatewayRequestId,
    });
  }

  // ---- Metadata enforcement: forward NGUYÊN VẸN, không sửa body ----
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);

    let modelForLog = undefined;
    try {
      const peek = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
      modelForLog = peek.model;
    } catch {
      // không parse được cũng không sao — vẫn forward nguyên bytes gốc
    }

    // Sửa lỗi thật phát hiện khi test với 9Router thật (bản Docker decolua/9router):
    // /v1/messages trả 401 "API key required for remote API access" nếu forward
    // nguyên authorization header của Center AI token — 9Router không hiểu token đó,
    // nó cần đúng API key MÀ NÓ TỰ PHÁT HÀNH cho seat/connection đó (tạo qua dashboard
    // 9Router, lưu vào registry.json field `api_key`). Đây chính là bước
    // "đổi sang credential mà 9Router thực sự hiểu" đã mô tả ở Q9 — trước đây
    // code spike quên làm bước đổi này, chỉ forward nguyên header cũ.
    const target = new URL(seat.endpoint + req.url);
    const upstreamHeaders = { ...req.headers };
    delete upstreamHeaders.authorization; // bỏ token nghiệp vụ Center AI, KHÔNG cho lọt lên 9Router
    if (seat.api_key) {
      upstreamHeaders.authorization = `Bearer ${seat.api_key}`;
    }
    const upstreamReq = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: req.method,
        headers: {
          ...upstreamHeaders,
          host: target.host,
          'content-length': Buffer.byteLength(rawBody),
        },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res); // proxy streaming nguyên vẹn, không buffer lại toàn bộ
        upstreamRes.on('end', () => {
          logSpan({
            gateway_request_id: gatewayRequestId,
            employee_id,
            seat_id,
            work_session_id,
            tool_session_id,
            project_id,
            task_id,
            model: modelForLog,
            endpoint_used: seat.endpoint,
            status: 'ok',
            http_status: upstreamRes.statusCode,
          });
        });
      }
    );

    upstreamReq.on('error', (err) => {
      logSpan({
        gateway_request_id: gatewayRequestId,
        employee_id,
        seat_id,
        status: 'upstream_error',
        error: String(err),
        flagged: true,
      });
      if (!res.headersSent) sendJson(res, 502, { error: 'upstream_error', gateway_request_id: gatewayRequestId });
    });

    upstreamReq.end(rawBody);
  });
});

// Mặc định chỉ bind 127.0.0.1 — Adapter không nên tự lộ ra internet, nginx/reverse
// proxy mới là cửa duy nhất (defense in depth, không chỉ dựa vào firewall).
// Set HOST=0.0.0.0 tường minh nếu môi trường nào đó thực sự cần khác (không khuyến nghị).
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`[adapter] Gateway Adapter listening on ${HOST}:${PORT}`);
});
