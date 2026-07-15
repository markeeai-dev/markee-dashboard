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
const LOG_PATH = path.join(__dirname, '..', 'logs', 'request-spans.jsonl');

function logSpan(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(LOG_PATH, line);
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

    const target = new URL(seat.endpoint + req.url);
    const upstreamReq = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: req.method,
        headers: {
          ...req.headers,
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

server.listen(PORT, () => {
  console.log(`[adapter] Gateway Adapter listening on :${PORT}`);
});
