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
const { resolveSeat, loadRegistry, REGISTRY_PATH } = require('./registry');
const { scanForSecrets, scanForPii, redact } = require('../shared/governance-scan');

const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET = process.env.CENTERAI_TOKEN_SECRET || 'spike-dev-secret-change-me';
// MVP2 hạng mục 2 — Request Span đầy đủ. Adapter gọi Control Plane SAU khi đã trả lời
// client xong (fire-and-forget), không phải nhân viên nên dùng secret nội bộ riêng.
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8090';
const INTERNAL_SERVICE_SECRET = process.env.CENTERAI_INTERNAL_SERVICE_SECRET || '';
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

// Best-effort, dùng chung cho cả non-streaming JSON lẫn streaming SSE — quét toàn bộ text
// đã nhận, lấy occurrence CUỐI CÙNG của mỗi field (streaming gửi usage tăng dần, giá trị
// cuối là đầy đủ nhất). Không cố JSON.parse/bracket-match nested object — rẻ và đủ đúng cho
// "Request Span cơ bản" (mục 15), không cần chính xác tuyệt đối như billing thật.
function extractUsageBestEffort(text) {
  const lastNumber = (regex) => {
    const matches = [...text.matchAll(regex)];
    return matches.length ? parseInt(matches[matches.length - 1][1], 10) : undefined;
  };
  return {
    input_tokens: lastNumber(/"input_tokens"\s*:\s*(\d+)/g),
    output_tokens: lastNumber(/"output_tokens"\s*:\s*(\d+)/g),
    cached_tokens: lastNumber(/"cache_read_input_tokens"\s*:\s*(\d+)/g),
  };
}

// Fire-and-forget — KHÔNG bao giờ được ảnh hưởng request AI thật đang/đã xử lý. Gọi sau khi
// response đã stream xong về client, lỗi chỉ log cục bộ, không throw/không retry.
function reportRequestSpan(entry) {
  if (!INTERNAL_SERVICE_SECRET) return; // chưa cấu hình (vd môi trường mock/test) — bỏ qua êm
  fetch(`${CONTROL_PLANE_URL}/internal/v1/gateway/request-spans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
    body: JSON.stringify(entry),
  }).catch((err) => {
    console.error('[adapter] reportRequestSpan failed (non-fatal):', err.message);
  });
}

// MVP3 khởi động · Q13 — cùng kiểu fire-and-forget với reportRequestSpan. CHỈ gửi type/severity,
// KHÔNG BAO GIỜ gửi giá trị match thật (chuỗi secret/PII thật) lên Control Plane hay ghi vào
// log cục bộ — mục đích là phát hiện rò rỉ, không phải tạo thêm 1 nơi lưu chính thứ đang chặn.
function reportFlag(entry) {
  if (!INTERNAL_SERVICE_SECRET) return;
  fetch(`${CONTROL_PLANE_URL}/internal/v1/governance/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
    body: JSON.stringify(entry),
  }).catch((err) => {
    console.error('[adapter] reportFlag failed (non-fatal):', err.message);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// MVP3 tiếp theo · Q22 — Full Audit Mode: kiểm tra có grant active không TRƯỚC KHI quyết định
// lưu nội dung. Cache trong process (TTL ngắn) để đỡ round-trip Control Plane trên MỌI request
// — mặc định (không có grant) là đường đi phổ biến nhất, phải rẻ. Cache sai lệch vài chục giây
// chấp nhận được (không phải cơ chế bảo mật chặn cứng như Secret Scan, chỉ ảnh hưởng việc có
// bắt đầu/dừng lưu audit content sớm/muộn vài giây quanh lúc bật/tắt Full Audit Mode).
const activeGrantCache = new Map(); // key: `${employee_id}:${project_id}` -> { grant, fetchedAt }
const ACTIVE_GRANT_CACHE_TTL_MS = 30_000;

async function checkActiveGrant(employeeId, projectId) {
  if (!INTERNAL_SERVICE_SECRET) return null;
  const key = `${employeeId}:${projectId}`;
  const cached = activeGrantCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ACTIVE_GRANT_CACHE_TTL_MS) return cached.grant;

  try {
    const res = await fetch(
      `${CONTROL_PLANE_URL}/internal/v1/governance/active-grant?employee_id=${encodeURIComponent(employeeId)}&project_id=${encodeURIComponent(projectId || '')}`,
      { headers: { Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` } }
    );
    const json = await res.json().catch(() => ({}));
    const grant = res.ok ? json.grant || null : null;
    activeGrantCache.set(key, { grant, fetchedAt: Date.now() });
    return grant;
  } catch (err) {
    console.error('[adapter] checkActiveGrant failed (non-fatal, coi như không có grant):', err.message);
    return null; // lỗi mạng KHÔNG được chặn request AI thật — chỉ đơn giản là không lưu audit content lần này
  }
}

function reportPrompt(entry) {
  if (!INTERNAL_SERVICE_SECRET) return;
  fetch(`${CONTROL_PLANE_URL}/internal/v1/gateway/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
    body: JSON.stringify(entry),
  }).catch((err) => {
    console.error('[adapter] reportPrompt failed (non-fatal):', err.message);
  });
}

// MVP3 Đợt 4 — Policy Engine cơ bản (Q13): Data Classification (tầng Project) + Approval.
// Cùng kiểu cache/fail-open với checkActiveGrant — mặc định (không có policy nào) là đường đi
// phổ biến nhất, phải rẻ và không bao giờ chặn request AI thật vì lỗi hạ tầng nội bộ (Q23: P0
// uptime, gateway không được là SPOF chặn cả việc code).
const accessCheckCache = new Map(); // key: `${employee_id}:${project_id}` -> { result, fetchedAt }
const ACCESS_CHECK_CACHE_TTL_MS = 30_000;

async function checkAccess(employeeId, projectId) {
  if (!INTERNAL_SERVICE_SECRET) return { allowed: true };
  const key = `${employeeId}:${projectId}`;
  const cached = accessCheckCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ACCESS_CHECK_CACHE_TTL_MS) return cached.result;

  try {
    const res = await fetch(
      `${CONTROL_PLANE_URL}/internal/v1/governance/access-check?employee_id=${encodeURIComponent(employeeId)}&project_id=${encodeURIComponent(projectId || '')}`,
      { headers: { Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` } }
    );
    const json = await res.json().catch(() => ({}));
    const result = res.ok ? json : { allowed: true };
    accessCheckCache.set(key, { result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('[adapter] checkAccess failed (non-fatal, fail-open — không chặn request AI thật vì lỗi hạ tầng nội bộ):', err.message);
    return { allowed: true };
  }
}

function reportApprovalRequest(entry) {
  if (!INTERNAL_SERVICE_SECRET) return;
  fetch(`${CONTROL_PLANE_URL}/internal/v1/governance/approval-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
    body: JSON.stringify(entry),
  }).catch((err) => {
    console.error('[adapter] reportApprovalRequest failed (non-fatal):', err.message);
  });
}

const server = http.createServer((req, res) => {
  const gatewayRequestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // MVP3 Đợt 5 (offboard) + đợt seat gán (assign) — đường ghi DUY NHẤT vào registry.json, xác
  // thực bằng INTERNAL_SERVICE_SECRET (KHÔNG phải token nghiệp vụ ký cho AI request) — Control
  // Plane gọi sau khi admin xác nhận offboard/assign, để enforcement thật xảy ra ngay (Adapter
  // đọc lại file này mỗi request, xem registry.js). Nhận cả `status` (offboard) lẫn
  // `employee_id` (assign — đổi ai sở hữu seat) độc lập nhau, ít nhất 1 trong 2. Phải xử lý và
  // return TRƯỚC toàn bộ logic proxy AI bên dưới.
  if (req.method === 'POST' && /^\/internal\/v1\/seats\/[^/]+\/status$/.test(req.url)) {
    if (!INTERNAL_SERVICE_SECRET || token !== INTERNAL_SERVICE_SECRET) {
      return sendJson(res, 401, { error: 'invalid_internal_secret' });
    }
    const seatId = req.url.split('/')[4];
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(chunks.length ? Buffer.concat(chunks).toString('utf8') : '{}');
      } catch {
        return sendJson(res, 400, { error: 'invalid_json_body' });
      }
      if (!body.status && !body.employee_id) return sendJson(res, 400, { error: 'missing_status_or_employee_id' });
      try {
        const registry = loadRegistry();
        if (!registry[seatId]) return sendJson(res, 404, { error: 'seat_not_found' });
        if (body.status) registry[seatId].status = body.status;
        if (body.employee_id) registry[seatId].employee_id = body.employee_id;
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
        return sendJson(res, 200, { seat_id: seatId, status: registry[seatId].status, employee_id: registry[seatId].employee_id });
      } catch (err) {
        return sendJson(res, 500, { error: 'registry_write_failed', detail: err.message });
      }
    });
    return;
  }

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
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks);

    let modelForLog = undefined;
    try {
      const peek = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
      modelForLog = peek.model;
    } catch {
      // không parse được cũng không sao — vẫn forward nguyên bytes gốc
    }

    // MVP3 khởi động · Q13 — Secret Scan (chặn cứng) + PII Detection (chỉ cảnh báo, đợt này
    // chưa chặn — xem lý do trong plan). Quét TOÀN BỘ rawBody (không chỉ field `content`) vì
    // secret có thể nằm ở bất kỳ đâu trong payload (system prompt, tool_result...). Đây vẫn là
    // Metadata enforcement — chỉ ĐỌC để quyết định pass/block, KHÔNG sửa nội dung gửi đi.
    const bodyText = rawBody.toString('utf8');
    const secretMatches = scanForSecrets(bodyText);
    if (secretMatches.length) {
      logSpan({
        gateway_request_id: gatewayRequestId,
        employee_id,
        seat_id,
        status: 'rejected',
        reason: 'secret_detected',
        secret_types: secretMatches.map((m) => m.type), // chỉ loại pattern, KHÔNG log giá trị match thật
        flagged: true,
      });
      for (const m of secretMatches) {
        reportFlag({
          employee_id,
          work_session_id,
          type: 'secret_detected',
          severity: m.severity,
          detail: { pattern: m.type },
          blocked: true,
        });
      }
      return sendJson(res, 403, {
        error: 'secret_detected',
        detail: 'Nội dung có chứa thứ giống secret/API key thật (' + secretMatches.map((m) => m.type).join(', ') + ') — bị chặn, không gửi lên provider AI. Xoá secret khỏi nội dung rồi thử lại.',
        gateway_request_id: gatewayRequestId,
      });
    }

    const piiMatches = scanForPii(bodyText);
    if (piiMatches.length) {
      // Chỉ cảnh báo, KHÔNG chặn — request vẫn forward bình thường bên dưới.
      for (const m of piiMatches) {
        reportFlag({
          employee_id,
          work_session_id,
          type: 'pii_detected',
          severity: m.severity,
          detail: { pattern: m.type },
          blocked: false,
        });
      }
    }

    // MVP3 Đợt 4 · Q13 — Policy Engine cơ bản: Data Classification (tầng Project) + Approval.
    // MẶC ĐỊNH (project chưa phân loại, chưa có policy) là allowed:true, hành vi y hệt trước
    // đây — chỉ chặn khi admin đã chủ động classify project + tạo policy requires_approval,
    // và nhân viên đó chưa có approval đang hiệu lực cho đúng project/classification đó.
    const access = await checkAccess(employee_id, project_id);
    if (!access.allowed) {
      reportApprovalRequest({ employee_id, project_id, classification: access.classification });
      logSpan({
        gateway_request_id: gatewayRequestId,
        employee_id,
        seat_id,
        status: 'rejected',
        reason: 'approval_required',
        classification: access.classification,
        flagged: true,
      });
      return sendJson(res, 403, {
        error: 'approval_required',
        detail: `Project này được phân loại "${access.classification}" và cần admin duyệt trước khi dùng AI. Yêu cầu duyệt đã được ghi nhận — báo admin duyệt qua dashboard rồi thử lại.`,
        gateway_request_id: gatewayRequestId,
      });
    }

    // MVP3 tiếp theo · Q22 — Full Audit Mode: MẶC ĐỊNH (không có grant active) là KHÔNG lưu
    // gì thêm ngoài hiện tại, hành vi y hệt trước đây. Chỉ khi có grant active mới redact +
    // lưu — không bao giờ lưu bản thô dù chỉ tạm thời (redact() chạy trước reportPrompt(),
    // không có bước nào gửi bodyText/tapText gốc đi đâu cả).
    const activeGrant = await checkActiveGrant(employee_id, project_id);

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

        // Tap song song với pipe() để đọc usage sau khi xong — Readable hỗ trợ nhiều listener
        // 'data' cùng lúc, KHÔNG ảnh hưởng luồng chính đang stream về client (đã test thật,
        // xem MVP2-PROGRESS.md hạng mục 2 — chạy lại đúng kịch bản Claude Code CLI thật qua
        // Adapter để xác nhận streaming/tool-use không bị phá bởi thay đổi này).
        const tapChunks = [];
        upstreamRes.on('data', (c) => tapChunks.push(c));

        upstreamRes.on('end', () => {
          const httpStatus = upstreamRes.statusCode;
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
            http_status: httpStatus,
          });

          if (httpStatus >= 200 && httpStatus < 300) {
            const tapText = Buffer.concat(tapChunks).toString('utf8');
            const usage = extractUsageBestEffort(tapText);
            reportRequestSpan({
              gateway_request_id: gatewayRequestId,
              employee_id,
              work_session_id,
              tool_session_id,
              project_id,
              task_id,
              provider: 'anthropic',
              model: modelForLog,
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cached_tokens: usage.cached_tokens,
              latency_ms: Date.now() - requestStartedAt,
              status: 'ok',
              http_status: httpStatus,
            });

            // Full Audit Mode — chỉ tới đây khi có grant active (kiểm tra ở trên trước khi
            // forward). Redact CẢ request lẫn response trước khi gửi đi — chưa từng có bước
            // nào gửi bản gốc ra khỏi tiến trình Adapter.
            if (activeGrant) {
              reportPrompt({
                gateway_request_id: gatewayRequestId,
                employee_id,
                work_session_id,
                full_audit_grant_id: activeGrant.id,
                prompt_redacted: redact(bodyText),
                prompt_hash: crypto.createHash('sha256').update(bodyText).digest('hex'),
                response_redacted: redact(tapText),
              });
            }
          }
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
