'use strict';
// Center AI Control Plane — MVP1 tối giản (Track C, TEAM-SPLIT.md)
//
// Sở hữu: employees/projects/tasks, Work Session / Tool Session / Checkpoint (Q18),
// project_context/handoffs (Project Continuity — moat thật của sản phẩm, mục 15).
// KHÔNG sở hữu: routing AI request (đó là Gateway Adapter, Track B — không đổi ở đây),
// KHÔNG sở hữu vòng đời container 9Router ở MVP1 (đã chốt trong kế hoạch, để MVP2 khi
// cần state machine seat đầy đủ — pilot vài người chưa cần tự động tạo/huỷ container).
//
// Control Plane MINT token gateway (ký bằng CENTERAI_TOKEN_SECRET — đúng secret Gateway
// Adapter đang dùng để verify) khi mở Tool Session, thay vì script tay như ở MVP0 spike.

const http = require('http');
const crypto = require('crypto');
const { signToken, verifyToken } = require('../shared/token');
const { query } = require('./db');
const { id } = require('./ids');
const { estimateCostUsd } = require('./pricing');

const PORT = parseInt(process.env.PORT || '8090', 10);
const HOST = process.env.HOST || '127.0.0.1';
const GATEWAY_TOKEN_SECRET = process.env.CENTERAI_TOKEN_SECRET;
const EMPLOYEE_TOKEN_SECRET = process.env.CENTERAI_EMPLOYEE_TOKEN_SECRET;
const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://valeron.tech';
// MVP3 Đợt 5 — Seat Offboarding: Control Plane gọi thẳng sang Adapter để enforce thật (Adapter
// vẫn sở hữu registry.json, Control Plane không tự sửa file). Mặc định đúng thực tế pilot này —
// 2 service cùng chạy 1 droplet.
const ADAPTER_INTERNAL_URL = process.env.ADAPTER_INTERNAL_URL || 'http://127.0.0.1:8080';
const IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6h (Q18/Q24.5 — không dùng ranh giới "cùng ngày")
const GATEWAY_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // đủ dài cho 1 ca làm việc
// MVP2 hạng mục 4 — Task claim/lease (Q20). Lease tự gia hạn mỗi khi người giữ claim tạo
// checkpoint (còn hoạt động), tự hết hạn nếu không — KHÔNG có job nền dọn định kỳ, chỉ cần
// so sánh lease_until với now() mỗi lần đọc là đủ, đơn giản hơn và không cần thêm tiến trình.
const LEASE_DURATION_MS = 4 * 60 * 60 * 1000; // 4h — 1 ca làm việc, ngắn hơn Work Session idle timeout
// Mã pilot chia sẻ ngoài băng thông (Slack/nói trực tiếp) cho Thanh/Hoàng — CHỈ để chặn
// việc "biết email công ty là mint được token thật của người khác" một khi Control Plane
// lộ ra domain công khai cho company-ai gọi từ máy nhân viên (Bước 2). Không phải SSO thật,
// chỉ là rào chắn tối thiểu bắt buộc phải có trước khi public — không phải tính năng thêm.
const PILOT_ACCESS_CODE = process.env.CENTERAI_PILOT_ACCESS_CODE;
// MVP2 hạng mục 2 — Gateway Adapter gửi Request Span lên đây. Adapter KHÔNG phải nhân viên
// nên không có employee_token — dùng secret nội bộ riêng, khác hẳn 2 secret ở trên, để lỡ lộ
// 1 cái không kéo theo lộ cái khác (không tin nhau chéo giữa business token và internal call).
const INTERNAL_SERVICE_SECRET = process.env.CENTERAI_INTERNAL_SERVICE_SECRET;

if (!GATEWAY_TOKEN_SECRET || !EMPLOYEE_TOKEN_SECRET || !PILOT_ACCESS_CODE || !INTERNAL_SERVICE_SECRET) {
  console.error(
    '[control-plane] FATAL: thiếu 1 trong các secret bắt buộc (CENTERAI_TOKEN_SECRET, CENTERAI_EMPLOYEE_TOKEN_SECRET, CENTERAI_PILOT_ACCESS_CODE, CENTERAI_INTERNAL_SERVICE_SECRET) trong env'
  );
  process.exit(1);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

class ApiError extends Error {
  constructor(status, error, extra) {
    super(error);
    this.status = status;
    this.error = error;
    this.extra = extra;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'invalid_json_body');
  }
}

async function requireEmployee(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new ApiError(401, 'missing_token');

  const verified = verifyToken(token, EMPLOYEE_TOKEN_SECRET);
  if (!verified.ok) throw new ApiError(401, `invalid_token:${verified.reason}`);

  const { employee_id } = verified.payload;
  if (!employee_id) throw new ApiError(401, 'missing_claims');

  const { rows } = await query('SELECT id, email, full_name, status, role FROM employees WHERE id = $1', [employee_id]);
  if (!rows.length || rows[0].status !== 'active') throw new ApiError(403, 'employee_inactive');

  return rows[0];
}

// Q22 — chỉ role=admin mới xem được risk-score/audit-logs/bật Full Audit Mode. Không tự động
// xử lý ai (đúng nguyên tắc Q7/Q13), chỉ giới hạn AI XEM được — vẫn cần requireEmployee trước.
function requireAdmin(emp) {
  if (emp.role !== 'admin') throw new ApiError(403, 'admin_required');
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLogin(req) {
  const body = await readJsonBody(req);
  if (!body.email) throw new ApiError(400, 'missing_email');
  if (!body.access_code || body.access_code !== PILOT_ACCESS_CODE) {
    throw new ApiError(401, 'invalid_access_code');
  }

  const { rows } = await query('SELECT id, email, full_name, status, role FROM employees WHERE email = $1', [body.email]);
  if (!rows.length) throw new ApiError(404, 'employee_not_found');
  const emp = rows[0];
  if (emp.status !== 'active') throw new ApiError(403, 'employee_inactive');

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 ngày, tiện cho pilot
  const employee_token = signToken({ employee_id: emp.id, email: emp.email, expires_at }, EMPLOYEE_TOKEN_SECRET);

  return { status: 200, body: { employee_id: emp.id, full_name: emp.full_name, role: emp.role, employee_token, expires_at } };
}

async function handleListProjects(req) {
  await requireEmployee(req);
  const { rows } = await query('SELECT id, name, status, classification FROM projects WHERE status = $1 ORDER BY name', ['active']);
  return { status: 200, body: { projects: rows } };
}

// --- Đọc tổng hợp cho Dashboard tối giản (Q24.10 — 5 màn: Projects & Tasks, Active
// Sessions, Handoffs, Project Memory, Seats & Employees). Đọc across-employee (không giới
// hạn theo requireEmployee().id) vì đây là view vận hành chung, không phải dữ liệu cá nhân —
// vẫn yêu cầu đăng nhập hợp lệ (requireEmployee), chỉ không lọc theo employee đó.

async function handleListEmployees(req) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT e.id, e.email, e.full_name, e.status, srr.seat_id, srr.status AS seat_status
     FROM employees e LEFT JOIN seat_runtime_registry srr ON srr.employee_id = e.id
     ORDER BY e.full_name`
  );
  return { status: 200, body: { employees: rows } };
}

async function handleListActiveWorkSessions(req) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT ws.id, ws.started_at, e.full_name AS employee_name, t.id AS task_id, t.title AS task_title,
            p.name AS project_name,
            GREATEST(
              ws.started_at,
              COALESCE((SELECT MAX(ts.started_at) FROM tool_sessions ts WHERE ts.work_session_id = ws.id), ws.started_at)
            ) AS last_activity_at
     FROM work_sessions ws
     JOIN employees e ON e.id = ws.employee_id
     JOIN tasks t ON t.id = ws.task_id
     JOIN projects p ON p.id = ws.project_id
     WHERE ws.status = 'active'
     ORDER BY last_activity_at DESC`
  );
  return { status: 200, body: { work_sessions: rows } };
}

async function handleListRecentHandoffs(req) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT h.id, h.task_id, t.title AS task_title, p.name AS project_name,
            e.full_name AS from_employee_name, h.summary, h.open_issues, h.next_steps, h.created_at
     FROM handoffs h
     JOIN employees e ON e.id = h.from_employee_id
     JOIN tasks t ON t.id = h.task_id
     JOIN projects p ON p.id = t.project_id
     ORDER BY h.created_at DESC LIMIT 20`
  );
  return { status: 200, body: { handoffs: rows } };
}

// --- MVP2 hạng mục 2 · Request Span đầy đủ — Gateway Adapter gọi vào đây SAU khi đã trả
// lời client xong (async, non-blocking từ phía Adapter). Ghi lỗi không bao giờ được coi là
// lỗi nghiêm trọng phía Adapter — đây chỉ là log, mất 1 span không ảnh hưởng request AI thật.
async function handleIngestRequestSpan(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const body = await readJsonBody(req);
  if (!body.gateway_request_id) throw new ApiError(400, 'missing_gateway_request_id');

  const cost = estimateCostUsd(body.model, body.input_tokens, body.output_tokens);
  await query(
    `INSERT INTO request_spans
       (id, gateway_request_id, work_session_id, tool_session_id, employee_id, project_id, task_id,
        provider, model, input_tokens, output_tokens, cached_tokens, estimated_cost_usd, latency_ms,
        status, http_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (gateway_request_id) DO NOTHING`,
    [
      id('rs'),
      body.gateway_request_id,
      body.work_session_id || null,
      body.tool_session_id || null,
      body.employee_id || null,
      body.project_id || null,
      body.task_id || null,
      body.provider || null,
      body.model || null,
      body.input_tokens || null,
      body.output_tokens || null,
      body.cached_tokens || null,
      cost,
      body.latency_ms || null,
      body.status || null,
      body.http_status || null,
    ]
  );
  return { status: 201, body: { ok: true } };
}

async function handleGetCostSummary(req, url) {
  await requireEmployee(req);
  const projectId = url.searchParams.get('project_id');
  const { rows } = await query(
    `SELECT employee_id, e.full_name AS employee_name, COUNT(*) AS request_count,
            SUM(input_tokens) AS total_input_tokens, SUM(output_tokens) AS total_output_tokens,
            SUM(estimated_cost_usd) AS total_estimated_cost_usd, AVG(latency_ms) AS avg_latency_ms
     FROM request_spans rs LEFT JOIN employees e ON e.id = rs.employee_id
     WHERE ($1::text IS NULL OR rs.project_id = $1)
     GROUP BY employee_id, e.full_name
     ORDER BY total_estimated_cost_usd DESC NULLS LAST`,
    [projectId]
  );
  return { status: 200, body: { cost_by_employee: rows } };
}

// --- MVP3 khởi động · Governance (Q13: Secret Scan + PII Detection) + 2-mode Audit (Q22) ---

const SEVERITY_SCORE = { low: 1, med: 3, high: 5 };

async function writeAuditLog(actorId, action, targetType, targetId, metadata) {
  await query(
    `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id('al'), actorId, action, targetType || null, targetId || null, JSON.stringify(metadata || {})]
  );
}

// Gateway Adapter gọi vào đây khi phát hiện secret/PII — cùng kiểu xác thực nội bộ với
// /internal/v1/gateway/request-spans (INTERNAL_SERVICE_SECRET, không phải employee_token vì
// Adapter không phải nhân viên).
async function handleIngestFlag(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const body = await readJsonBody(req);
  if (!body.type || !body.severity) throw new ApiError(400, 'missing_type_or_severity');

  const flagId = id('fl');
  const score = SEVERITY_SCORE[body.severity] || 1;
  await query(
    `INSERT INTO flags (id, employee_id, work_session_id, type, severity, score, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [flagId, body.employee_id || null, body.work_session_id || null, body.type, body.severity, score, JSON.stringify(body.detail || {})]
  );
  // actor_id = null — hành động này do hệ thống (Adapter) tự phát hiện, không phải nhân viên
  // chủ động làm — audit_logs vẫn ghi lại để có dấu vết, đúng "mọi lần chặn/cảnh báo ghi audit_logs".
  await writeAuditLog(null, `governance_${body.type}`, 'flag', flagId, {
    employee_id: body.employee_id,
    severity: body.severity,
    blocked: body.blocked === true,
  });

  return { status: 201, body: { flag_id: flagId } };
}

async function handleGetRiskScore(req, url) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const scope = url.searchParams.get('scope') === 'project' ? 'project' : 'employee';

  if (scope === 'employee') {
    const { rows } = await query(
      `SELECT f.employee_id, e.full_name, SUM(f.score) AS risk_score, COUNT(*) AS flag_count,
              COUNT(*) FILTER (WHERE f.type = 'secret_detected') AS secret_count,
              COUNT(*) FILTER (WHERE f.type = 'pii_detected') AS pii_count
       FROM flags f LEFT JOIN employees e ON e.id = f.employee_id
       GROUP BY f.employee_id, e.full_name ORDER BY risk_score DESC`
    );
    return { status: 200, body: { scope: 'employee', risk_scores: rows } };
  }

  const { rows } = await query(
    `SELECT ws.project_id, SUM(f.score) AS risk_score, COUNT(*) AS flag_count
     FROM flags f JOIN work_sessions ws ON ws.id = f.work_session_id
     GROUP BY ws.project_id ORDER BY risk_score DESC`
  );
  return { status: 200, body: { scope: 'project', risk_scores: rows } };
}

// --- KPI 4 lớp (Q22) — chỉ 3/4 lớp có dữ liệu thật đủ tin cậy để tính. Outcome (task
// accepted/PR merged/QA passed/bug sau merge) cần tích hợp CI/PR/QA thật — KHÔNG có trong hệ
// thống, trả về null + lý do rõ ràng thay vì bịa số (đúng nguyên tắc "không tự động kết luận"
// và "không dùng token thô làm điểm số" đã chốt từ đầu tài liệu). Chỉ admin xem được — dữ
// liệu năng suất cá nhân nhạy cảm tương đương Risk Score.

async function computeAdoption() {
  const activeDaysRes = await query(
    `SELECT e.id AS employee_id, e.full_name, COUNT(DISTINCT date_trunc('day', ws.started_at)) AS ai_active_days
     FROM employees e LEFT JOIN work_sessions ws ON ws.employee_id = e.id
     GROUP BY e.id, e.full_name ORDER BY e.full_name`
  );
  const toolRes = await query(
    `SELECT ws.employee_id, ts.tool, COUNT(*) AS session_count
     FROM tool_sessions ts JOIN work_sessions ws ON ws.id = ts.work_session_id
     GROUP BY ws.employee_id, ts.tool`
  );
  const toolByEmployee = {};
  for (const r of toolRes.rows) {
    (toolByEmployee[r.employee_id] ||= {})[r.tool] = Number(r.session_count);
  }
  return activeDaysRes.rows.map((r) => ({
    employee_id: r.employee_id,
    full_name: r.full_name,
    ai_active_days: Number(r.ai_active_days),
    tool_adoption: toolByEmployee[r.employee_id] || {},
  }));
}

async function computeEfficiency() {
  // Proxy "closed" cho "accepted" — schema hiện chưa có trạng thái accepted riêng biệt, ghi
  // rõ tên field để không ai đọc nhầm là khớp 100% định nghĩa "accepted" trong tài liệu gốc.
  const { rows } = await query(
    `WITH task_cost AS (
       SELECT ws.employee_id, ws.task_id,
              SUM(COALESCE(rs.estimated_cost_usd, 0)) AS cost,
              SUM(COALESCE(rs.input_tokens, 0) + COALESCE(rs.output_tokens, 0)) AS tokens
       FROM request_spans rs JOIN work_sessions ws ON ws.id = rs.work_session_id
       GROUP BY ws.employee_id, ws.task_id
     )
     SELECT tc.employee_id, e.full_name,
            ROUND(AVG(tc.cost) FILTER (WHERE t.status = 'closed')::numeric, 4) AS avg_cost_per_closed_task,
            ROUND(AVG(tc.tokens) FILTER (WHERE t.status = 'closed')::numeric, 0) AS avg_tokens_per_closed_task,
            COUNT(*) FILTER (WHERE t.status = 'closed') AS closed_task_count
     FROM task_cost tc JOIN tasks t ON t.id = tc.task_id LEFT JOIN employees e ON e.id = tc.employee_id
     GROUP BY tc.employee_id, e.full_name ORDER BY e.full_name`
  );
  return rows;
}

async function computeCollaboration() {
  const completenessRes = await query(
    `SELECT h.from_employee_id AS employee_id, e.full_name, COUNT(*) AS handoffs_created,
            ROUND(100.0 * COUNT(*) FILTER (WHERE length(trim(h.summary)) > 0 AND jsonb_array_length(h.next_steps) > 0) / NULLIF(COUNT(*), 0), 1) AS handoff_completeness_rate
     FROM handoffs h LEFT JOIN employees e ON e.id = h.from_employee_id
     GROUP BY h.from_employee_id, e.full_name`
  );
  // Thời gian tiếp quản: người KHÁC mở Work Session gần nhất cho cùng task, SAU thời điểm
  // handoff — tái dùng đúng logic NOT EXISTS/so thời gian đã có ở Inbox (Q14), viết lại bằng
  // LATERAL join cho gọn ở đây vì cần giá trị trung bình, không phải danh sách.
  const pickupRes = await query(
    `SELECT h.from_employee_id AS employee_id,
            ROUND(AVG(EXTRACT(EPOCH FROM (pickup.started_at - h.created_at)) / 3600)::numeric, 1) AS avg_pickup_time_hours
     FROM handoffs h
     JOIN LATERAL (
       SELECT ws.started_at FROM work_sessions ws
       WHERE ws.task_id = h.task_id AND ws.employee_id != h.from_employee_id AND ws.started_at > h.created_at
       ORDER BY ws.started_at ASC LIMIT 1
     ) pickup ON true
     GROUP BY h.from_employee_id`
  );
  const contextRes = await query(`SELECT created_by AS employee_id, COUNT(*) AS context_contributions FROM project_context GROUP BY created_by`);
  const decisionRes = await query(
    `SELECT pc.created_by AS employee_id, COUNT(dd.id) AS decisions_documented
     FROM decision_detail dd JOIN project_context pc ON pc.id = dd.context_id
     GROUP BY pc.created_by`
  );

  const pickupByEmployee = Object.fromEntries(pickupRes.rows.map((r) => [r.employee_id, r.avg_pickup_time_hours]));
  const contextByEmployee = Object.fromEntries(contextRes.rows.map((r) => [r.employee_id, Number(r.context_contributions)]));
  const decisionByEmployee = Object.fromEntries(decisionRes.rows.map((r) => [r.employee_id, Number(r.decisions_documented)]));

  return completenessRes.rows.map((r) => ({
    employee_id: r.employee_id,
    full_name: r.full_name,
    handoffs_created: Number(r.handoffs_created),
    handoff_completeness_rate: r.handoff_completeness_rate === null ? null : Number(r.handoff_completeness_rate),
    avg_pickup_time_hours: pickupByEmployee[r.employee_id] !== undefined ? Number(pickupByEmployee[r.employee_id]) : null,
    context_contributions: contextByEmployee[r.employee_id] || 0,
    decisions_documented: decisionByEmployee[r.employee_id] || 0,
  }));
}

async function handleGetKpi(req, url) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const layer = url.searchParams.get('layer');

  const body = { outcome: null, outcome_note: 'Cần tích hợp CI/PR/QA thật — chưa có trong hệ thống, không bịa số.' };
  if (!layer || layer === 'adoption') body.adoption = await computeAdoption();
  if (!layer || layer === 'efficiency') body.efficiency = await computeEfficiency();
  if (!layer || layer === 'collaboration') body.collaboration = await computeCollaboration();

  return { status: 200, body };
}

async function handleGrantFullAuditMode(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const body = await readJsonBody(req);
  if (!body.scope || !body.scope_id || !body.reason) throw new ApiError(400, 'missing_fields');
  if (!['employee', 'project'].includes(body.scope)) throw new ApiError(400, 'invalid_scope');
  const durationHours = Number(body.duration_hours) > 0 ? Number(body.duration_hours) : 4;

  const grantId = id('fag');
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  await query(
    `INSERT INTO full_audit_grants (id, scope, scope_id, reason, granted_by, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [grantId, body.scope, body.scope_id, body.reason, emp.id, expiresAt]
  );
  await writeAuditLog(emp.id, 'full_audit_mode_granted', body.scope, body.scope_id, { reason: body.reason, expires_at: expiresAt });

  return { status: 201, body: { grant_id: grantId, expires_at: expiresAt } };
}

// Vá gap thật phát hiện ở Đợt 2 — grant trước đây chỉ tự hết hạn, không tắt sớm được. Set
// expires_at = now() (không thêm cột revoked_at) — findActiveFullAuditGrant đã lọc theo
// expires_at > now() nên grant biến mất khỏi active NGAY, không phải sửa logic đọc ở đâu khác.
async function handleRevokeFullAuditMode(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query('SELECT id, scope, scope_id, expires_at FROM full_audit_grants WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'grant_not_found');

  // Idempotent — revoke 1 grant đã hết hạn/đã revoke rồi vẫn 200, không lỗi vô nghĩa.
  if (new Date(rows[0].expires_at).getTime() > Date.now()) {
    await query('UPDATE full_audit_grants SET expires_at = now() WHERE id = $1', [params.id]);
    await writeAuditLog(emp.id, 'full_audit_mode_revoked', rows[0].scope, rows[0].scope_id, { grant_id: params.id });
  }
  return { status: 200, body: { revoked: true } };
}

async function handleListFullAuditGrants(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT fag.id, fag.scope, fag.scope_id, fag.reason, fag.expires_at, fag.created_at,
            e.full_name AS granted_by_name, fag.expires_at > now() AS is_active
     FROM full_audit_grants fag LEFT JOIN employees e ON e.id = fag.granted_by
     ORDER BY fag.created_at DESC LIMIT 50`
  );
  return { status: 200, body: { grants: rows } };
}

// --- MVP3 Đợt 4 — Policy Engine cơ bản: Data Classification (tầng Project — quyết định đã
// chốt với người dùng, KHÔNG phải regex real-time từng prompt như Secret/PII Scan, vì phân loại
// "dữ liệu khách hàng" vs "mã nguồn nội bộ" vs "công khai" không có pattern cấu trúc rõ, làm
// real-time sẽ báo sai/sót nhiều) + Approval workflow (Q13). ---

async function handleSetProjectClassification(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const body = await readJsonBody(req);
  const VALID_CLASS = ['unclassified', 'public', 'internal', 'customer_data'];
  if (!VALID_CLASS.includes(body.classification)) throw new ApiError(400, 'invalid_classification');

  const { rows } = await query('UPDATE projects SET classification = $1 WHERE id = $2 RETURNING id', [body.classification, params.id]);
  if (!rows.length) throw new ApiError(404, 'project_not_found');
  await writeAuditLog(emp.id, 'project_classification_set', 'project', params.id, { classification: body.classification });

  return { status: 200, body: { project_id: params.id, classification: body.classification } };
}

async function handleCreatePolicy(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const body = await readJsonBody(req);
  const VALID_CLASS = ['unclassified', 'public', 'internal', 'customer_data'];
  if (!['company', 'project'].includes(body.scope)) throw new ApiError(400, 'invalid_scope');
  if (!VALID_CLASS.includes(body.classification)) throw new ApiError(400, 'invalid_classification');
  if (body.scope === 'company' && body.scope_id) throw new ApiError(400, 'scope_id_must_be_null_for_company');
  if (body.scope === 'project') {
    if (!body.scope_id) throw new ApiError(400, 'scope_id_required_for_project');
    const { rows } = await query('SELECT id FROM projects WHERE id = $1', [body.scope_id]);
    if (!rows.length) throw new ApiError(400, 'project_not_found');
  }
  const requiresApproval = body.requires_approval !== false; // mặc định true nếu không truyền

  const policyId = id('pol');
  await query(
    `INSERT INTO policies (id, scope, scope_id, classification, requires_approval, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
    [policyId, body.scope, body.scope_id || null, body.classification, requiresApproval, emp.id]
  );
  await writeAuditLog(emp.id, 'policy_created', body.scope, body.scope_id || null, { classification: body.classification, requires_approval: requiresApproval });

  return { status: 201, body: { policy_id: policyId } };
}

async function handleListPolicies(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT p.id, p.scope, p.scope_id, pr.name AS project_name, p.classification, p.requires_approval, p.created_at, e.full_name AS created_by_name
     FROM policies p LEFT JOIN employees e ON e.id = p.created_by LEFT JOIN projects pr ON pr.id = p.scope_id
     ORDER BY p.created_at DESC`
  );
  return { status: 200, body: { policies: rows } };
}

// Ưu tiên policy gắn riêng cho project trước, fallback company-wide nếu không có.
async function findMatchingPolicy(projectId, classification) {
  const { rows } = await query(
    `SELECT id, requires_approval FROM policies
     WHERE classification = $2 AND ((scope = 'project' AND scope_id = $1) OR scope = 'company')
     ORDER BY (scope = 'project') DESC LIMIT 1`,
    [projectId, classification]
  );
  return rows[0] || null;
}

async function findActiveApproval(employeeId, projectId, classification) {
  const { rows } = await query(
    `SELECT id FROM approval_requests
     WHERE employee_id = $1 AND project_id = $2 AND classification = $3
       AND status = 'approved' AND expires_at > now()
     ORDER BY expires_at DESC LIMIT 1`,
    [employeeId, projectId, classification]
  );
  return rows[0] || null;
}

// Adapter gọi TRƯỚC khi forward request lên 9Router — cùng kiểu xác thực nội bộ với
// /internal/v1/governance/active-grant.
async function handleAccessCheck(req, url) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const employeeId = url.searchParams.get('employee_id');
  const projectId = url.searchParams.get('project_id');

  const { rows: projRows } = await query('SELECT classification FROM projects WHERE id = $1', [projectId]);
  const classification = projRows[0] ? projRows[0].classification : 'unclassified';

  const policy = await findMatchingPolicy(projectId, classification);
  if (!policy || !policy.requires_approval) {
    return { status: 200, body: { allowed: true } };
  }

  const approval = await findActiveApproval(employeeId, projectId, classification);
  if (approval) return { status: 200, body: { allowed: true } };

  return { status: 200, body: { allowed: false, classification } };
}

// Adapter gọi khi block để tự động tạo yêu cầu duyệt — upsert: đã có pending khớp
// employee/project/classification thì không tạo trùng (nhân viên thử lại nhiều lần không spam).
async function handleCreateApprovalRequestInternal(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const body = await readJsonBody(req);
  if (!body.employee_id || !body.project_id || !body.classification) throw new ApiError(400, 'missing_fields');

  const { rows: existing } = await query(
    `SELECT id FROM approval_requests WHERE employee_id=$1 AND project_id=$2 AND classification=$3 AND status='pending'`,
    [body.employee_id, body.project_id, body.classification]
  );
  if (existing.length) return { status: 200, body: { approval_request_id: existing[0].id, created: false } };

  const reqId = id('apr');
  await query(
    `INSERT INTO approval_requests (id, employee_id, project_id, classification) VALUES ($1,$2,$3,$4)`,
    [reqId, body.employee_id, body.project_id, body.classification]
  );
  return { status: 201, body: { approval_request_id: reqId, created: true } };
}

async function handleListApprovalRequests(req, url) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const status = url.searchParams.get('status');
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE ar.status = $1';
  }
  const { rows } = await query(
    `SELECT ar.id, ar.employee_id, e.full_name AS employee_name, ar.project_id, pr.name AS project_name,
            ar.classification, ar.status, ar.requested_at, ar.decided_at,
            d.full_name AS decided_by_name, ar.expires_at
     FROM approval_requests ar
       LEFT JOIN employees e ON e.id = ar.employee_id
       LEFT JOIN projects pr ON pr.id = ar.project_id
       LEFT JOIN employees d ON d.id = ar.decided_by
     ${where}
     ORDER BY ar.requested_at DESC LIMIT 50`,
    params
  );
  return { status: 200, body: { approval_requests: rows } };
}

// Chỉ quyết định được request đang 'pending' — tránh nhập nhằng approve/reject lại 1 request đã
// quyết định rồi; muốn cấp lại thì để lần block tiếp theo tự tạo request mới.
async function handleDecideApprovalRequest(req, params, approve) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query('SELECT id, status FROM approval_requests WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'approval_request_not_found');
  if (rows[0].status !== 'pending') throw new ApiError(400, 'not_pending');

  if (approve) {
    const body = await readJsonBody(req);
    const durationHours = Number(body.duration_hours) > 0 ? Number(body.duration_hours) : 4;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    await query(
      `UPDATE approval_requests SET status='approved', decided_by=$1, decided_at=now(), expires_at=$2 WHERE id=$3`,
      [emp.id, expiresAt, params.id]
    );
    await writeAuditLog(emp.id, 'approval_granted', 'approval_request', params.id, { expires_at: expiresAt });
    return { status: 200, body: { approval_request_id: params.id, status: 'approved', expires_at: expiresAt } };
  }

  await query(`UPDATE approval_requests SET status='rejected', decided_by=$1, decided_at=now() WHERE id=$2`, [emp.id, params.id]);
  await writeAuditLog(emp.id, 'approval_rejected', 'approval_request', params.id, {});
  return { status: 200, body: { approval_request_id: params.id, status: 'rejected' } };
}

// Cùng gap class đã vá cho full_audit_grants (Vá gap A) — 1 approval đã cấp không tắt sớm được
// nếu admin đổi ý/cấp nhầm, chỉ tự hết hạn theo duration_hours. Cùng cách vá: set expires_at =
// now(), findActiveApproval đã lọc expires_at > now() nên biến mất khỏi active NGAY.
async function handleRevokeApproval(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query('SELECT id, status, expires_at FROM approval_requests WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'approval_request_not_found');

  if (rows[0].status === 'approved' && new Date(rows[0].expires_at).getTime() > Date.now()) {
    await query(`UPDATE approval_requests SET expires_at = now() WHERE id = $1`, [params.id]);
    await writeAuditLog(emp.id, 'approval_revoked', 'approval_request', params.id, {});
  }
  return { status: 200, body: { revoked: true } };
}

// --- MVP3 Đợt 5 — Pattern Library (Q16): CHỈ phần "generalize có gate", KHÔNG bật reuse tự
// động giữa project (tài liệu ghi rõ khoá tới MVP4). `content_anonymized` do chính người gọi tự
// tay viết lại — không có auto-redaction/anonymize tự động, cùng lý do đã từ chối regex Data
// Classification real-time ở Đợt 4: ẩn danh hoá tự động không đáng tin, phải là hành động thủ
// công có ý thức của con người. ---

async function handleGeneralizePattern(req) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.title || !body.content || !body.category) throw new ApiError(400, 'missing_fields');

  const patternId = id('pat');
  await query(
    `INSERT INTO pattern_library (id, source_context_id, title, content_anonymized, category, generalized_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [patternId, body.source_context_id || null, body.title, body.content, body.category, emp.id]
  );
  return { status: 201, body: { pattern_id: patternId } };
}

async function handleApprovePattern(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query('SELECT id, generalized_by, approved_by FROM pattern_library WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'pattern_not_found');
  if (rows[0].approved_by) throw new ApiError(400, 'already_approved');
  // Đúng yêu cầu tài liệu Q16: "người duyệt phải khác người tạo" — khác hẳn context/ingest
  // (tự khai) hay Approval workflow Đợt 4 (không có ràng buộc này, mục đích khác).
  if (rows[0].generalized_by === emp.id) throw new ApiError(400, 'cannot_approve_own_pattern');

  await query('UPDATE pattern_library SET approved_by = $1 WHERE id = $2', [emp.id, params.id]);
  await writeAuditLog(emp.id, 'pattern_approved', 'pattern_library', params.id, {});
  return { status: 200, body: { pattern_id: params.id, approved: true } };
}

async function handleListPatterns(req, url) {
  const emp = await requireEmployee(req);
  const category = url.searchParams.get('category');
  const statusPending = url.searchParams.get('status') === 'pending';
  if (statusPending) requireAdmin(emp); // chỉ admin xem được hàng chờ duyệt

  const conditions = [statusPending ? 'pl.approved_by IS NULL' : 'pl.approved_by IS NOT NULL'];
  const params = [];
  if (category) {
    params.push(category);
    conditions.push(`pl.category = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT pl.id, pl.title, pl.content_anonymized, pl.category, pl.created_at,
            g.full_name AS generalized_by_name, a.full_name AS approved_by_name
     FROM pattern_library pl
       JOIN employees g ON g.id = pl.generalized_by
       LEFT JOIN employees a ON a.id = pl.approved_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY pl.created_at DESC LIMIT 50`,
    params
  );
  return { status: 200, body: { patterns: rows } };
}

// --- MVP3 Đợt 5 — Seat Offboarding: enforcement THẬT, không chỉ đổi cờ DB. seats.status/
// seat_runtime_registry.status ở Control Plane KHÔNG phải nơi Adapter thực sự chặn (Adapter đọc
// registry.json trên đĩa, xem gateway-adapter/registry.js) — nếu chỉ đổi DB thì offboarding là
// tính năng giấy tờ không có tác dụng thật. Gọi thẳng sang Adapter để enforce trước khi báo
// thành công, không cập nhật DB nếu Adapter không xác nhận được. ---

async function handleListSeats(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT s.id, s.provider, s.status, srr.employee_id, e.full_name AS employee_name, srr.status AS runtime_status
     FROM seats s
       LEFT JOIN seat_runtime_registry srr ON srr.seat_id = s.id
       LEFT JOIN employees e ON e.id = srr.employee_id
     ORDER BY s.id`
  );
  return { status: 200, body: { seats: rows } };
}

async function handleOffboardSeat(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const body = await readJsonBody(req);
  if (!body.reason) throw new ApiError(400, 'missing_reason');

  const { rows } = await query('SELECT id, status FROM seats WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'seat_not_found');
  if (rows[0].status === 'revoked') throw new ApiError(400, 'already_revoked');

  // Await, KHÔNG fire-and-forget — phải biết chắc enforcement thật đã xảy ra trước khi báo
  // thành công, không được để DB nói "đã offboard" trong khi seat vẫn truy cập được thật.
  let adapterRes;
  try {
    adapterRes = await fetch(`${ADAPTER_INTERNAL_URL}/internal/v1/seats/${encodeURIComponent(params.id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
      body: JSON.stringify({ status: 'destroyed' }),
    });
  } catch (err) {
    throw new ApiError(502, 'adapter_unreachable', { detail: err.message });
  }
  if (!adapterRes.ok) throw new ApiError(502, 'adapter_rejected_status_update');

  await query(`UPDATE seats SET status = 'revoked' WHERE id = $1`, [params.id]);
  await query(`UPDATE seat_runtime_registry SET status = 'destroyed', updated_at = now() WHERE seat_id = $1`, [params.id]);
  await writeAuditLog(emp.id, 'seat_offboarded', 'seat', params.id, { reason: body.reason });

  return { status: 200, body: { seat_id: params.id, status: 'revoked' } };
}

async function handleListAuditLogs(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT al.id, al.action, al.target_type, al.target_id, al.metadata, al.created_at, e.full_name AS actor_name
     FROM audit_logs al LEFT JOIN employees e ON e.id = al.actor_id
     ORDER BY al.created_at DESC LIMIT 100`
  );
  return { status: 200, body: { audit_logs: rows } };
}

async function handleListFlags(req) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT f.id, f.employee_id, e.full_name, f.type, f.severity, f.score, f.detail, f.status, f.detected_at
     FROM flags f LEFT JOIN employees e ON e.id = f.employee_id
     ORDER BY f.detected_at DESC LIMIT 50`
  );
  return { status: 200, body: { flags: rows } };
}

// --- MVP3 tiếp theo, hạng mục 1 · Full Audit Mode — lưu nội dung thô có redact (Q22) ---
// Adapter gọi endpoint này TRƯỚC (kiểm tra có grant active không) rồi mới quyết định redact +
// gửi nội dung — Control Plane vẫn tự kiểm tra lại grant còn hiệu lực lúc INSERT (defense in
// depth, không tin tưởng tuyệt đối cache phía Adapter).

async function findActiveFullAuditGrant(employeeId, projectId) {
  const { rows } = await query(
    `SELECT id, scope, scope_id, expires_at FROM full_audit_grants
     WHERE expires_at > now()
       AND ((scope = 'employee' AND scope_id = $1) OR (scope = 'project' AND scope_id = $2))
     ORDER BY expires_at DESC LIMIT 1`,
    [employeeId, projectId]
  );
  return rows[0] || null;
}

async function handleCheckActiveGrant(req, url) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const employeeId = url.searchParams.get('employee_id');
  const projectId = url.searchParams.get('project_id');
  const grant = await findActiveFullAuditGrant(employeeId, projectId);
  return { status: 200, body: { grant } };
}

async function handleIngestPrompt(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== INTERNAL_SERVICE_SECRET) throw new ApiError(401, 'invalid_internal_secret');

  const body = await readJsonBody(req);
  if (!body.gateway_request_id || !body.full_audit_grant_id || !body.prompt_redacted || !body.prompt_hash) {
    throw new ApiError(400, 'missing_fields');
  }

  // Kiểm tra lại grant còn hiệu lực NGAY LÚC GHI — không chỉ tin Adapter đã kiểm tra trước đó
  // (grant có thể vừa hết hạn giữa lúc Adapter check và lúc request AI trả lời xong).
  const { rows: grantRows } = await query(`SELECT id FROM full_audit_grants WHERE id = $1 AND expires_at > now()`, [body.full_audit_grant_id]);
  if (!grantRows.length) throw new ApiError(403, 'grant_expired_or_not_found');

  const promptId = id('pr');
  await query(
    `INSERT INTO prompts (id, gateway_request_id, employee_id, work_session_id, content_redacted, content_hash, full_audit_grant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [promptId, body.gateway_request_id, body.employee_id || null, body.work_session_id || null, body.prompt_redacted, body.prompt_hash, body.full_audit_grant_id]
  );
  if (body.response_redacted) {
    await query(`INSERT INTO responses (id, prompt_id, content_redacted) VALUES ($1,$2,$3)`, [id('rs'), promptId, body.response_redacted]);
  }
  return { status: 201, body: { prompt_id: promptId } };
}

// Xem nội dung thô đã lưu — chỉ admin, VÀ mỗi lần xem đều ghi audit_logs (xem = hành động cần
// dấu vết, đúng Q22 "bắt buộc kèm lý do truy cập... ghi audit_logs", không phải xem tự do).
async function handleListPrompts(req, params) {
  const emp = await requireEmployee(req);
  requireAdmin(emp);
  const { rows } = await query(
    `SELECT p.id, p.employee_id, e.full_name, p.content_redacted, p.created_at,
            r.content_redacted AS response_redacted
     FROM prompts p LEFT JOIN employees e ON e.id = p.employee_id
       LEFT JOIN responses r ON r.prompt_id = p.id
     WHERE p.work_session_id = $1 ORDER BY p.created_at ASC`,
    [params.id]
  );
  await writeAuditLog(emp.id, 'full_audit_content_viewed', 'work_session', params.id, { row_count: rows.length });
  return { status: 200, body: { prompts: rows } };
}

// --- MVP3 tiếp theo, hạng mục 2 · Context Confidence + Reasoning Log/ADR (Q15) ---

const CONFIDENCE_DECAY_DAYS = 30; // mốc khởi điểm đơn giản (100% -> 20% qua 30 ngày), có thể
// tinh chỉnh sau — không phải công thức "đúng" duy nhất, ghi rõ để không ai hiểu nhầm là chuẩn cứng.
const CONTEXT_TYPE_LABEL = {
  decision: 'Decision', status: 'Status', known_issue: 'Known issue', requirement: 'Requirement',
  ba_feedback: 'BA feedback', next_step: 'Next step', handoff: 'Handoff', code_context: 'Code context',
};

function computeConfidence(row) {
  if (row.valid_to && new Date(row.valid_to).getTime() < Date.now()) return 0;
  if (row.type === 'decision' && row.approved_by) return 100; // KHÔNG decay cho decision đã duyệt (Q15)
  const ageDays = Math.max(0, (Date.now() - new Date(row.valid_from).getTime()) / 86400000);
  const decayed = Math.round(100 - (ageDays / CONFIDENCE_DECAY_DAYS) * 80);
  return Math.max(20, Math.min(100, decayed));
}

function withConfidence(row) {
  const confidence = computeConfidence(row);
  const typeLabel = CONTEXT_TYPE_LABEL[row.type] || row.type;
  const approvedTxt = row.approved_by ? 'approved, ' : '';
  const staleTxt = confidence < 30 ? ', có thể đã lỗi thời' : '';
  return { ...row, confidence, confidence_label: `${typeLabel} — ${approvedTxt}${confidence}% confidence${staleTxt}` };
}

async function handleCreateDecisionDetail(req, params) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.chosen || !body.rationale) throw new ApiError(400, 'missing_fields');

  const ctxRes = await query('SELECT id, type FROM project_context WHERE id = $1', [params.id]);
  if (!ctxRes.rows.length) throw new ApiError(404, 'context_not_found');
  if (ctxRes.rows[0].type !== 'decision') throw new ApiError(400, 'context_not_decision_type');

  const detailId = id('dd');
  await query(
    `INSERT INTO decision_detail (id, context_id, options_considered, criteria, chosen, rationale, superseded_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [detailId, params.id, JSON.stringify(body.options_considered || []), JSON.stringify(body.criteria || []), body.chosen, body.rationale, body.superseded_reason || null]
  );
  await writeAuditLog(emp.id, 'decision_detail_created', 'project_context', params.id, { chosen: body.chosen });
  return { status: 201, body: { decision_detail_id: detailId } };
}

// --- MVP2 · AI Timeline + AI Inbox (Q14) — "view, không phải bảng mới": union theo thời
// gian trên các bảng MVP1 đã có, không tạo bảng mới, đúng như tài liệu yêu cầu.

async function handleTimeline(req, url) {
  await requireEmployee(req);
  const projectId = url.searchParams.get('project_id');
  if (!projectId) throw new ApiError(400, 'missing_project_id');

  const { rows } = await query(
    `SELECT 'work_session_started' AS event_type, ws.started_at AS occurred_at,
            e.full_name AS employee_name, ws.task_id, t.title AS task_title, NULL AS detail
     FROM work_sessions ws JOIN employees e ON e.id = ws.employee_id JOIN tasks t ON t.id = ws.task_id
     WHERE ws.project_id = $1
     UNION ALL
     SELECT 'work_session_ended', ws.ended_at, e.full_name, ws.task_id, t.title, NULL
     FROM work_sessions ws JOIN employees e ON e.id = ws.employee_id JOIN tasks t ON t.id = ws.task_id
     WHERE ws.project_id = $1 AND ws.ended_at IS NOT NULL
     UNION ALL
     SELECT 'checkpoint', cp.created_at, e.full_name, ws.task_id, t.title, cp.trigger
     FROM checkpoints cp
       JOIN tool_sessions ts ON ts.id = cp.tool_session_id
       JOIN work_sessions ws ON ws.id = ts.work_session_id
       JOIN employees e ON e.id = ws.employee_id
       JOIN tasks t ON t.id = ws.task_id
     WHERE ws.project_id = $1
     UNION ALL
     SELECT 'handoff', h.created_at, e.full_name, h.task_id, t.title, h.summary
     FROM handoffs h JOIN employees e ON e.id = h.from_employee_id JOIN tasks t ON t.id = h.task_id
     WHERE t.project_id = $1
     ORDER BY occurred_at DESC LIMIT 100`,
    [projectId]
  );
  return { status: 200, body: { events: rows } };
}

async function handleInbox(req, url) {
  const emp = await requireEmployee(req);
  const employeeId = url.searchParams.get('employee_id') || emp.id;

  const assignedRes = await query(
    `SELECT t.id, t.title, t.status, p.name AS project_name
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE t.assignee_employee_id = $1 AND t.status IN ('open', 'in_progress')
     ORDER BY t.created_at`,
    [employeeId]
  );

  // Cần tiếp quản: handoff mới nhất của 1 task mà CHƯA có Work Session nào (của ai cũng
  // được — pilot nhỏ, to_employee_id thường không set) mở SAU thời điểm handoff đó.
  const pickupRes = await query(
    `SELECT DISTINCT ON (h.task_id) h.task_id, t.title AS task_title, p.name AS project_name,
            h.summary, h.created_at AS handoff_created_at, e.full_name AS from_employee_name
     FROM handoffs h
       JOIN tasks t ON t.id = h.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN employees e ON e.id = h.from_employee_id
     WHERE (h.to_employee_id IS NULL OR h.to_employee_id = $1)
       AND h.from_employee_id != $1
       AND NOT EXISTS (
         SELECT 1 FROM work_sessions ws2 WHERE ws2.task_id = h.task_id AND ws2.started_at > h.created_at
       )
     ORDER BY h.task_id, h.created_at DESC`,
    [employeeId]
  );

  return {
    status: 200,
    body: { assigned_open_tasks: assignedRes.rows, handoffs_to_pick_up: pickupRes.rows },
  };
}

// Vá gap thật phát hiện ở Đợt 2 — project_context CHƯA từng có endpoint tạo mới ở bất kỳ MVP
// nào trước đây (Confidence/ADR đúng nhưng chỉ chạy được trên dữ liệu seed). Mở cho MỌI nhân
// viên gọi (không giới hạn admin) — đúng bản chất cộng tác của bảng này, giống
// checkpoints/handoffs, khác hẳn dữ liệu governance nhạy cảm (flags/audit_logs/prompts).
async function handleIngestContext(req) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.project_id || !body.type || !body.content) throw new ApiError(400, 'missing_fields');
  if (!CONTEXT_TYPE_LABEL[body.type]) throw new ApiError(400, 'invalid_type');

  // approved_by ở ĐÂY vẫn là tự khai (TIN TRỰC TIẾP giá trị truyền lên) — khác với Approval
  // workflow xây ở Đợt 4 (gate AI access theo Data Classification, không liên quan tới ai được
  // đánh dấu "đã duyệt" một context) và khác với gate riêng "người duyệt phải khác người tạo"
  // của Pattern Library (Q16, đợt này) — 3 cơ chế phục vụ 3 mục đích khác nhau, cố tình không
  // gộp chung, không phải thiếu nhất quán.
  const approvedBy = body.approved_by === true ? emp.id : body.approved_by || null;

  // Q16 — Company Brain scope_level, thu hẹp: 5 giá trị hợp lệ ở CHECK constraint, nhưng chỉ
  // session/personal/project có injection logic thật ở đợt này (department/company chưa test
  // được thật vì pilot chỉ có 1 project — xem MVP3-PROGRESS.md). Vẫn nhận đủ 5 giá trị ở đây
  // để không phải sửa lại API khi có dữ liệu thật để làm phần còn lại.
  const SCOPE_LEVELS = ['session', 'personal', 'project', 'department', 'company'];
  if (body.scope_level && !SCOPE_LEVELS.includes(body.scope_level)) throw new ApiError(400, 'invalid_scope_level');
  const scopeLevel = body.scope_level || 'project';

  const contextId = id('ctx');
  await query(
    `INSERT INTO project_context (id, project_id, task_id, type, content, created_by, approved_by, valid_to, scope_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [contextId, body.project_id, body.task_id || null, body.type, body.content, emp.id, approvedBy, body.valid_to || null, scopeLevel]
  );
  return { status: 201, body: { context_id: contextId } };
}

async function handleListProjectContext(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT pc.id, pc.task_id, pc.type, pc.content, pc.created_at, pc.approved_by, pc.valid_from, pc.valid_to, pc.scope_level,
            e.full_name AS created_by_name
     FROM project_context pc JOIN employees e ON e.id = pc.created_by
     WHERE pc.project_id = $1 ORDER BY pc.created_at DESC LIMIT 50`,
    [params.projectId]
  );
  return { status: 200, body: { context_notes: rows.map(withConfidence) } };
}

async function handleListTasks(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT t.id, t.project_id, t.title, t.status, t.assignee_employee_id, a.full_name AS assignee_name,
            t.claim_mode, t.claimed_by_employee_id, t.lease_until, e.full_name AS claimed_by_name
     FROM tasks t
       LEFT JOIN employees e ON e.id = t.claimed_by_employee_id
       LEFT JOIN employees a ON a.id = t.assignee_employee_id
     WHERE t.project_id = $1 ORDER BY t.created_at`,
    [params.projectId]
  );
  // Ẩn claim đã hết hạn (đọc ra là coi như chưa claim) — không cần job dọn định kỳ.
  const now = Date.now();
  const tasks = rows.map((t) => {
    const active = t.claimed_by_employee_id && t.lease_until && new Date(t.lease_until).getTime() > now;
    return { ...t, claimed_by_employee_id: active ? t.claimed_by_employee_id : null, claimed_by_name: active ? t.claimed_by_name : null, lease_until: active ? t.lease_until : null };
  });
  return { status: 200, body: { tasks } };
}

// Hoàn thiện Task Management nội bộ — từ đầu dự án tới giờ CHƯA từng có cách tạo task mới hay
// đổi trạng thái task qua sản phẩm (chỉ có task_tng142 seed tay), đây là gap thật khiến KPI
// Efficiency (Đợt 3) luôn hiện closed_task_count=0. Mở cho MỌI nhân viên (giống context/ingest,
// checkpoints) — task là dữ liệu làm việc chung, không phải governance nhạy cảm.
const TASK_STATUSES = ['open', 'in_progress', 'done', 'closed'];

async function handleCreateTask(req, params) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.title) throw new ApiError(400, 'missing_title');
  if (body.assignee_employee_id) {
    const { rows } = await query('SELECT id FROM employees WHERE id = $1', [body.assignee_employee_id]);
    if (!rows.length) throw new ApiError(400, 'assignee_not_found');
  }

  const taskId = id('task');
  await query(
    `INSERT INTO tasks (id, project_id, title, assignee_employee_id) VALUES ($1,$2,$3,$4)`,
    [taskId, params.projectId, body.title, body.assignee_employee_id || null]
  );
  return { status: 201, body: { task_id: taskId } };
}

async function handleUpdateTask(req, params) {
  await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.title && !body.status && !body.assignee_employee_id) throw new ApiError(400, 'no_fields_to_update');

  const { rows } = await query('SELECT id, status FROM tasks WHERE id = $1', [params.id]);
  if (!rows.length) throw new ApiError(404, 'task_not_found');

  if (body.status && !TASK_STATUSES.includes(body.status)) throw new ApiError(400, 'invalid_status');
  if (body.assignee_employee_id) {
    const { rows: empRows } = await query('SELECT id FROM employees WHERE id = $1', [body.assignee_employee_id]);
    if (!empRows.length) throw new ApiError(400, 'assignee_not_found');
  }

  const sets = [];
  const values = [];
  if (body.title) { values.push(body.title); sets.push(`title = $${values.length}`); }
  if (body.assignee_employee_id) { values.push(body.assignee_employee_id); sets.push(`assignee_employee_id = $${values.length}`); }
  if (body.status) {
    values.push(body.status);
    sets.push(`status = $${values.length}`);
    // closed_at phải nhất quán với status: có giá trị khi và chỉ khi đang closed.
    sets.push(body.status === 'closed' ? 'closed_at = now()' : 'closed_at = NULL');
  }
  values.push(params.id);
  await query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);

  return { status: 200, body: { task_id: params.id, updated: true } };
}

async function findEmployeeSeat(employeeId) {
  const { rows } = await query(
    `SELECT srr.seat_id, srr.status FROM seat_runtime_registry srr WHERE srr.employee_id = $1 AND srr.status = 'healthy' LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

async function handleCreateWorkSession(req) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.task_id) throw new ApiError(400, 'missing_task_id');

  const taskRes = await query('SELECT id, project_id FROM tasks WHERE id = $1', [body.task_id]);
  if (!taskRes.rows.length) throw new ApiError(404, 'task_not_found');
  const task = taskRes.rows[0];

  const seat = await findEmployeeSeat(emp.id);
  if (!seat) throw new ApiError(403, 'no_seat_assigned');

  // Resume: Work Session active của đúng (employee, task) này, chưa vượt idle timeout 6h,
  // tính theo hoạt động gần nhất (checkpoint hoặc tool_session mới nhất) — KHÔNG dùng "cùng ngày" (Q18/Q24.5).
  const activeRes = await query(
    `SELECT ws.id, ws.started_at,
            GREATEST(
              ws.started_at,
              COALESCE((SELECT MAX(ts.started_at) FROM tool_sessions ts WHERE ts.work_session_id = ws.id), ws.started_at),
              COALESCE((SELECT MAX(cp.created_at) FROM checkpoints cp
                          JOIN tool_sessions ts2 ON ts2.id = cp.tool_session_id
                          WHERE ts2.work_session_id = ws.id), ws.started_at)
            ) AS last_activity_at
     FROM work_sessions ws
     WHERE ws.employee_id = $1 AND ws.task_id = $2 AND ws.status = 'active'
     ORDER BY ws.started_at DESC LIMIT 1`,
    [emp.id, body.task_id]
  );

  if (activeRes.rows.length) {
    const ws = activeRes.rows[0];
    const idleMs = Date.now() - new Date(ws.last_activity_at).getTime();
    if (idleMs <= IDLE_TIMEOUT_MS) {
      return { status: 200, body: { work_session_id: ws.id, resumed: true, seat_id: seat.seat_id } };
    }
    await query(`UPDATE work_sessions SET status = 'closed', ended_at = now() WHERE id = $1`, [ws.id]);
  }

  const wsId = id('ws');
  await query(
    `INSERT INTO work_sessions (id, employee_id, seat_id, project_id, task_id, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [wsId, emp.id, seat.seat_id, task.project_id, task.id]
  );
  return { status: 201, body: { work_session_id: wsId, resumed: false, seat_id: seat.seat_id } };
}

// --- MVP2 hạng mục 4 · Task claim/lease đầy đủ (Q20) — thay cảnh báo mềm 1 dòng của POC.
// exclusive: 1 người sở hữu, lease có hạn, tự gia hạn khi còn hoạt động (renew ở
// handleCreateCheckpoint bên dưới), KHÔNG khoá cứng người khác — chỉ trả về 409 kèm đúng
// thông tin ai đang giữ để CLI cảnh báo rõ, quyết định vẫn ở người dùng (đúng tinh thần Q20:
// "vẫn xem được, xin tham gia được, hoặc chờ lease hết hạn").
// shared: nhiều người cùng lúc được, claim chỉ mang tính thông tin, không có "chủ" duy nhất.

async function loadTaskForClaim(taskId) {
  const { rows } = await query(
    `SELECT t.id, t.claim_mode, t.claimed_by_employee_id, t.lease_until, e.full_name AS claimed_by_name
     FROM tasks t LEFT JOIN employees e ON e.id = t.claimed_by_employee_id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!rows.length) throw new ApiError(404, 'task_not_found');
  return rows[0];
}

function claimIsActive(task) {
  return !!(task.claimed_by_employee_id && task.lease_until && new Date(task.lease_until).getTime() > Date.now());
}

async function handleGetTaskClaim(req, params) {
  await requireEmployee(req);
  const task = await loadTaskForClaim(params.id);
  return {
    status: 200,
    body: {
      claim_mode: task.claim_mode,
      claimed_by_employee_id: claimIsActive(task) ? task.claimed_by_employee_id : null,
      claimed_by_name: claimIsActive(task) ? task.claimed_by_name : null,
      lease_until: claimIsActive(task) ? task.lease_until : null,
    },
  };
}

async function handleClaimTask(req, params) {
  const emp = await requireEmployee(req);
  const task = await loadTaskForClaim(params.id);

  if (task.claim_mode === 'shared') {
    return { status: 200, body: { claim_mode: 'shared', claimed: true } };
  }

  if (claimIsActive(task) && task.claimed_by_employee_id !== emp.id) {
    throw new ApiError(409, 'task_already_claimed', {
      claimed_by_employee_id: task.claimed_by_employee_id,
      claimed_by_name: task.claimed_by_name,
      lease_until: task.lease_until,
    });
  }

  const leaseUntil = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
  await query(`UPDATE tasks SET claimed_by_employee_id = $1, lease_until = $2 WHERE id = $3`, [
    emp.id,
    leaseUntil,
    task.id,
  ]);
  return { status: 200, body: { claim_mode: 'exclusive', claimed_by_employee_id: emp.id, lease_until: leaseUntil } };
}

async function handleReleaseTaskClaim(req, params) {
  const emp = await requireEmployee(req);
  const task = await loadTaskForClaim(params.id);
  if (task.claimed_by_employee_id && task.claimed_by_employee_id !== emp.id) {
    throw new ApiError(403, 'not_claim_owner');
  }
  await query(`UPDATE tasks SET claimed_by_employee_id = NULL, lease_until = NULL WHERE id = $1`, [task.id]);
  return { status: 200, body: { released: true } };
}

// Phát hiện va chạm file (Q20) — quét checkpoint GẦN NHẤT của mỗi Work Session đang active
// trên task, so file đang sửa giữa các nhân viên KHÁC nhau. Chỉ cảnh báo, không chặn gì.
async function handleOverlapCheck(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT ws.id AS work_session_id, ws.employee_id, e.full_name, cp.files_changed, cp.created_at
     FROM work_sessions ws
       JOIN employees e ON e.id = ws.employee_id
       JOIN tool_sessions ts ON ts.work_session_id = ws.id
       JOIN checkpoints cp ON cp.tool_session_id = ts.id
     WHERE ws.task_id = $1 AND ws.status = 'active'
     ORDER BY cp.created_at ASC`,
    [params.id]
  );

  const latestByWorkSession = new Map();
  for (const r of rows) latestByWorkSession.set(r.work_session_id, r); // ASC -> giá trị cuối = mới nhất

  const fileToEmployees = new Map();
  for (const r of latestByWorkSession.values()) {
    for (const f of r.files_changed || []) {
      if (!fileToEmployees.has(f)) fileToEmployees.set(f, new Map());
      fileToEmployees.get(f).set(r.employee_id, r.full_name);
    }
  }

  const overlaps = [];
  for (const [file, employeesMap] of fileToEmployees) {
    if (employeesMap.size > 1) {
      overlaps.push({ file, employees: [...employeesMap.entries()].map(([employee_id, full_name]) => ({ employee_id, full_name })) });
    }
  }
  return { status: 200, body: { overlaps } };
}

async function loadOwnedWorkSession(workSessionId, employeeId) {
  const { rows } = await query('SELECT * FROM work_sessions WHERE id = $1', [workSessionId]);
  if (!rows.length) throw new ApiError(404, 'work_session_not_found');
  if (rows[0].employee_id !== employeeId) throw new ApiError(403, 'not_owner');
  return rows[0];
}

async function handleEndWorkSession(req, params) {
  const emp = await requireEmployee(req);
  const ws = await loadOwnedWorkSession(params.id, emp.id);
  if (ws.status === 'closed') return { status: 200, body: { work_session_id: ws.id, status: 'closed' } };
  await query(`UPDATE work_sessions SET status = 'closed', ended_at = now() WHERE id = $1`, [ws.id]);

  // `company-ai end` = chủ động xong việc — nhả claim exclusive nếu đúng người này đang giữ,
  // để người khác không phải chờ hết lease 4h mới nhận task được (Q20: không khoá cứng).
  await query(
    `UPDATE tasks SET claimed_by_employee_id = NULL, lease_until = NULL
     WHERE id = $1 AND claimed_by_employee_id = $2`,
    [ws.task_id, emp.id]
  );

  return { status: 200, body: { work_session_id: ws.id, status: 'closed' } };
}

async function handleCreateToolSession(req, params) {
  const emp = await requireEmployee(req);
  const ws = await loadOwnedWorkSession(params.id, emp.id);
  if (ws.status !== 'active') throw new ApiError(409, 'work_session_not_active');
  const body = await readJsonBody(req);
  const tool = body.tool || 'claude_code';
  if (!['claude_code', 'codex', 'other'].includes(tool)) throw new ApiError(400, 'invalid_tool');
  if (!ws.seat_id) throw new ApiError(409, 'work_session_missing_seat');

  const tsId = id('ts');
  await query(
    `INSERT INTO tool_sessions (id, work_session_id, tool, machine_id, status)
     VALUES ($1, $2, $3, $4, 'active')`,
    [tsId, ws.id, tool, body.machine_id || null]
  );

  const expires_at = new Date(Date.now() + GATEWAY_TOKEN_TTL_MS).toISOString();
  const gateway_token = signToken(
    {
      employee_id: emp.id,
      seat_id: ws.seat_id,
      provider: 'anthropic',
      tool,
      work_session_id: ws.id,
      tool_session_id: tsId,
      project_id: ws.project_id,
      task_id: ws.task_id,
      expires_at,
    },
    GATEWAY_TOKEN_SECRET
  );

  return {
    status: 201,
    body: { tool_session_id: tsId, gateway_token, gateway_base_url: GATEWAY_BASE_URL, expires_at },
  };
}

async function loadOwnedToolSession(toolSessionId, employeeId) {
  const { rows } = await query(
    `SELECT ts.*, ws.employee_id AS ws_employee_id, ws.task_id AS ws_task_id FROM tool_sessions ts
     JOIN work_sessions ws ON ws.id = ts.work_session_id WHERE ts.id = $1`,
    [toolSessionId]
  );
  if (!rows.length) throw new ApiError(404, 'tool_session_not_found');
  if (rows[0].ws_employee_id !== employeeId) throw new ApiError(403, 'not_owner');
  return rows[0];
}

async function handleCreateCheckpoint(req, params) {
  const emp = await requireEmployee(req);
  const ts = await loadOwnedToolSession(params.id, emp.id);
  const body = await readJsonBody(req);
  const trigger = body.trigger || 'manual';
  if (!['git_commit', 'pre_compact', 'post_compact', 'tool_close', 'manual'].includes(trigger)) {
    throw new ApiError(400, 'invalid_trigger');
  }

  const cpId = id('cp');
  await query(
    `INSERT INTO checkpoints (id, tool_session_id, trigger, completed, remaining, files_changed, git_commit, git_branch)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      cpId,
      ts.id,
      trigger,
      JSON.stringify(body.completed || []),
      JSON.stringify(body.remaining || []),
      JSON.stringify(body.files_changed || []),
      body.git_commit || null,
      body.git_branch || null,
    ]
  );

  // Gia hạn lease claim (Q20) nếu người tạo checkpoint này đang là chủ claim exclusive của
  // task — "tự nhả nếu idle" hoạt động tự nhiên: không hoạt động thì không ai gia hạn, lease
  // cứ thế hết hạn theo đúng mốc đã đặt, không cần job nền dọn dẹp riêng.
  await query(
    `UPDATE tasks SET lease_until = $1
     WHERE id = $2 AND claimed_by_employee_id = $3 AND claim_mode = 'exclusive'`,
    [new Date(Date.now() + LEASE_DURATION_MS).toISOString(), ts.ws_task_id, emp.id]
  );

  return { status: 201, body: { checkpoint_id: cpId } };
}

async function handleEndToolSession(req, params) {
  const emp = await requireEmployee(req);
  const ts = await loadOwnedToolSession(params.id, emp.id);
  if (ts.status === 'closed') return { status: 200, body: { tool_session_id: ts.id, status: 'closed' } };
  await query(`UPDATE tool_sessions SET status = 'closed', ended_at = now() WHERE id = $1`, [ts.id]);
  return { status: 200, body: { tool_session_id: ts.id, status: 'closed' } };
}

// --- MVP2 hạng mục 3 · Handoff tự động sinh bằng LLM (mục 14) ---
// Chỉ VIẾT giúp bản tóm tắt — người dùng vẫn xem lại/sửa/xác nhận trước khi publish (CLI
// không tự động publish draft này). Nếu lỗi/timeout, CLI tự fallback về draft git-diff thuần
// của MVP1 — endpoint này KHÔNG BAO GIỜ là điều kiện bắt buộc để `company-ai end` chạy được.
function buildDraftHandoffPrompt({ taskTitle, checkpoints, gitLog, gitDiffStat }) {
  const data = {
    task: taskTitle,
    checkpoints: checkpoints.map((c) => ({
      trigger: c.trigger,
      completed: c.completed,
      remaining: c.remaining,
      files_changed: c.files_changed,
      git_commit: c.git_commit,
    })),
    git_log: gitLog || null,
    git_diff_stat: gitDiffStat || null,
  };
  return [
    'Bạn viết bản bàn giao công việc (handoff) ngắn gọn cho lập trình viên tiếp theo, dựa',
    'CHÍNH XÁC vào dữ liệu JSON dưới đây — KHÔNG bịa thêm việc/chi tiết không có trong dữ liệu.',
    'Nếu dữ liệu ít/trống, cứ viết ngắn, đừng suy diễn. Trả lời bằng tiếng Việt, dạng gạch đầu',
    'dòng ngắn gọn, có 2 phần rõ ràng: "Đã làm" và "Còn lại / cần chú ý". KHÔNG thêm lời chào,',
    'không thêm ghi chú ngoài 2 phần đó.',
    '',
    'Dữ liệu:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

async function handleDraftHandoff(req, params) {
  const emp = await requireEmployee(req);
  const ws = await loadOwnedWorkSession(params.id, emp.id);
  if (!ws.seat_id) throw new ApiError(409, 'work_session_missing_seat');
  const body = await readJsonBody(req);

  const [cpRes, taskRes] = await Promise.all([
    query(
      `SELECT cp.trigger, cp.completed, cp.remaining, cp.files_changed, cp.git_commit
       FROM checkpoints cp JOIN tool_sessions ts ON ts.id = cp.tool_session_id
       WHERE ts.work_session_id = $1 ORDER BY cp.created_at ASC`,
      [ws.id]
    ),
    query('SELECT title FROM tasks WHERE id = $1', [ws.task_id]),
  ]);

  // Token ngắn hạn (5 phút) chỉ để gọi 1 lần cho việc soạn draft — không phải token Tool
  // Session thật, không dùng cho request AI nghiệp vụ khác.
  const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const draftToken = signToken(
    {
      employee_id: emp.id,
      seat_id: ws.seat_id,
      provider: 'anthropic',
      tool: 'handoff_draft',
      work_session_id: ws.id,
      expires_at,
    },
    GATEWAY_TOKEN_SECRET
  );

  const prompt = buildDraftHandoffPrompt({
    taskTitle: taskRes.rows[0]?.title,
    checkpoints: cpRes.rows,
    gitLog: body.git_log,
    gitDiffStat: body.git_diff_stat,
  });

  let draftText;
  try {
    const llmRes = await fetch(`${GATEWAY_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${draftToken}`, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ model: 'cc/claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });
    const text = await llmRes.text();
    const parsed = JSON.parse(text.split('data: [DONE]')[0].trim());
    if (!llmRes.ok || !Array.isArray(parsed.content)) throw new Error(`llm_call_failed_http_${llmRes.status}`);
    draftText = parsed.content.map((c) => c.text || '').join('\n').trim();
    if (!draftText) throw new Error('llm_empty_response');
  } catch (err) {
    throw new ApiError(502, 'draft_generation_failed', { detail: String(err && err.message) });
  }

  return { status: 200, body: { draft_summary: draftText } };
}

async function handleCreateHandoff(req) {
  const emp = await requireEmployee(req);
  const body = await readJsonBody(req);
  if (!body.task_id || !body.work_session_id || !body.summary) {
    throw new ApiError(400, 'missing_fields');
  }
  const ws = await loadOwnedWorkSession(body.work_session_id, emp.id);
  if (ws.task_id !== body.task_id) throw new ApiError(400, 'task_id_mismatch');

  const hId = id('ho');
  await query(
    `INSERT INTO handoffs (id, task_id, from_employee_id, to_employee_id, work_session_id, summary, open_issues, next_steps)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      hId,
      body.task_id,
      emp.id,
      body.to_employee_id || null,
      body.work_session_id,
      body.summary,
      JSON.stringify(body.open_issues || []),
      JSON.stringify(body.next_steps || []),
    ]
  );
  return { status: 201, body: { handoff_id: hId } };
}

async function handleListWorkSessionCheckpoints(req, params) {
  const emp = await requireEmployee(req);
  const ws = await loadOwnedWorkSession(params.id, emp.id);
  const { rows } = await query(
    `SELECT cp.id, cp.tool_session_id, cp.trigger, cp.completed, cp.remaining, cp.files_changed,
            cp.git_commit, cp.git_branch, cp.created_at
     FROM checkpoints cp
     JOIN tool_sessions ts ON ts.id = cp.tool_session_id
     WHERE ts.work_session_id = $1
     ORDER BY cp.created_at ASC`,
    [ws.id]
  );
  return { status: 200, body: { checkpoints: rows } };
}

async function handleGetLatestHandoff(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT h.*, e.full_name AS from_employee_name FROM handoffs h
     JOIN employees e ON e.id = h.from_employee_id
     WHERE h.task_id = $1 ORDER BY h.created_at DESC LIMIT 1`,
    [params.taskId]
  );
  if (!rows.length) return { status: 200, body: { handoff: null } };
  return { status: 200, body: { handoff: rows[0] } };
}

async function handleContextRender(req, url) {
  await requireEmployee(req);
  const taskId = url.searchParams.get('task_id');
  if (!taskId) throw new ApiError(400, 'missing_task_id');

  const taskRes = await query(
    `SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1`,
    [taskId]
  );
  if (!taskRes.rows.length) throw new ApiError(404, 'task_not_found');

  const handoffRes = await query(
    `SELECT h.*, e.full_name AS from_employee_name FROM handoffs h
     JOIN employees e ON e.id = h.from_employee_id
     WHERE h.task_id = $1 ORDER BY h.created_at DESC LIMIT 1`,
    [taskId]
  );
  const contextRes = await query(
    `SELECT id, type, content, created_at, approved_by, valid_from, valid_to, scope_level FROM project_context
     WHERE task_id = $1 OR (project_id = $2 AND task_id IS NULL)
     ORDER BY created_at DESC LIMIT 20`,
    [taskId, taskRes.rows[0].project_id]
  );

  return {
    status: 200,
    body: {
      task: taskRes.rows[0],
      latest_handoff: handoffRes.rows[0] || null,
      context_notes: contextRes.rows.map(withConfidence),
    },
  };
}

// ---------------------------------------------------------------------------
// Router (thuần, không framework — nhất quán style gateway-adapter/server.js)
// ---------------------------------------------------------------------------

const routes = [
  { method: 'POST', pattern: /^\/v1\/auth\/login$/, handler: (req) => handleLogin(req) },
  { method: 'POST', pattern: /^\/v1\/governance\/full-audit-mode$/, handler: (req) => handleGrantFullAuditMode(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/governance\/full-audit-mode\/([^/]+)\/revoke$/,
    handler: (req, m) => handleRevokeFullAuditMode(req, { id: m[1] }),
  },
  { method: 'GET', pattern: /^\/v1\/governance\/full-audit-grants$/, handler: (req) => handleListFullAuditGrants(req) },
  { method: 'POST', pattern: /^\/v1\/context\/ingest$/, handler: (req) => handleIngestContext(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/projects\/([^/]+)\/classification$/,
    handler: (req, m) => handleSetProjectClassification(req, { id: m[1] }),
  },
  { method: 'POST', pattern: /^\/v1\/policies$/, handler: (req) => handleCreatePolicy(req) },
  { method: 'GET', pattern: /^\/v1\/policies$/, handler: (req) => handleListPolicies(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/governance\/approval-requests\/([^/]+)\/approve$/,
    handler: (req, m) => handleDecideApprovalRequest(req, { id: m[1] }, true),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/governance\/approval-requests\/([^/]+)\/reject$/,
    handler: (req, m) => handleDecideApprovalRequest(req, { id: m[1] }, false),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/governance\/approval-requests\/([^/]+)\/revoke$/,
    handler: (req, m) => handleRevokeApproval(req, { id: m[1] }),
  },
  { method: 'POST', pattern: /^\/v1\/pattern-library\/generalize$/, handler: (req) => handleGeneralizePattern(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/pattern-library\/([^/]+)\/approve$/,
    handler: (req, m) => handleApprovePattern(req, { id: m[1] }),
  },
  { method: 'GET', pattern: /^\/v1\/seats$/, handler: (req) => handleListSeats(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/seats\/([^/]+)\/offboard$/,
    handler: (req, m) => handleOffboardSeat(req, { id: m[1] }),
  },
  { method: 'GET', pattern: /^\/v1\/audit-logs$/, handler: (req) => handleListAuditLogs(req) },
  { method: 'GET', pattern: /^\/v1\/flags$/, handler: (req) => handleListFlags(req) },
  { method: 'GET', pattern: /^\/v1\/projects$/, handler: (req) => handleListProjects(req) },
  {
    method: 'GET',
    pattern: /^\/v1\/projects\/([^/]+)\/tasks$/,
    handler: (req, m) => handleListTasks(req, { projectId: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/projects\/([^/]+)\/tasks$/,
    handler: (req, m) => handleCreateTask(req, { projectId: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/tasks\/([^/]+)\/update$/,
    handler: (req, m) => handleUpdateTask(req, { id: m[1] }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/projects\/([^/]+)\/context-notes$/,
    handler: (req, m) => handleListProjectContext(req, { projectId: m[1] }),
  },
  { method: 'GET', pattern: /^\/v1\/employees$/, handler: (req) => handleListEmployees(req) },
  {
    method: 'GET',
    pattern: /^\/v1\/work-sessions$/,
    handler: (req) => handleListActiveWorkSessions(req),
  },
  { method: 'GET', pattern: /^\/v1\/handoffs$/, handler: (req) => handleListRecentHandoffs(req) },
  { method: 'GET', pattern: /^\/v1\/tasks\/([^/]+)\/claim$/, handler: (req, m) => handleGetTaskClaim(req, { id: m[1] }) },
  { method: 'POST', pattern: /^\/v1\/tasks\/([^/]+)\/claim$/, handler: (req, m) => handleClaimTask(req, { id: m[1] }) },
  { method: 'POST', pattern: /^\/v1\/tasks\/([^/]+)\/release$/, handler: (req, m) => handleReleaseTaskClaim(req, { id: m[1] }) },
  { method: 'GET', pattern: /^\/v1\/tasks\/([^/]+)\/overlap-check$/, handler: (req, m) => handleOverlapCheck(req, { id: m[1] }) },
  { method: 'POST', pattern: /^\/v1\/work-sessions$/, handler: (req) => handleCreateWorkSession(req) },
  {
    method: 'POST',
    pattern: /^\/v1\/work-sessions\/([^/]+)\/end$/,
    handler: (req, m) => handleEndWorkSession(req, { id: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/work-sessions\/([^/]+)\/tool-sessions$/,
    handler: (req, m) => handleCreateToolSession(req, { id: m[1] }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/work-sessions\/([^/]+)\/checkpoints$/,
    handler: (req, m) => handleListWorkSessionCheckpoints(req, { id: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/work-sessions\/([^/]+)\/draft-handoff$/,
    handler: (req, m) => handleDraftHandoff(req, { id: m[1] }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/work-sessions\/([^/]+)\/prompts$/,
    handler: (req, m) => handleListPrompts(req, { id: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/context\/([^/]+)\/decision-detail$/,
    handler: (req, m) => handleCreateDecisionDetail(req, { id: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/tool-sessions\/([^/]+)\/checkpoints$/,
    handler: (req, m) => handleCreateCheckpoint(req, { id: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/tool-sessions\/([^/]+)\/end$/,
    handler: (req, m) => handleEndToolSession(req, { id: m[1] }),
  },
  { method: 'POST', pattern: /^\/v1\/handoffs$/, handler: (req) => handleCreateHandoff(req) },
  {
    method: 'GET',
    pattern: /^\/v1\/handoffs\/([^/]+)$/,
    handler: (req, m) => handleGetLatestHandoff(req, { taskId: m[1] }),
  },
];

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  // CORS — dashboard tối giản (Bước 4) chạy ở domain khác (ops.valeron.tech) gọi thẳng
  // Control Plane từ trình duyệt. Cho phép mọi origin đọc (GET, có Authorization) — dữ liệu
  // vẫn đòi hỏi employee_token hợp lệ, CORS chỉ nới same-origin policy của trình duyệt,
  // không thay thế xác thực.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/v1/context/render') {
      const result = await handleContextRender(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/timeline') {
      const result = await handleTimeline(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/inbox') {
      const result = await handleInbox(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'POST' && url.pathname === '/internal/v1/gateway/request-spans') {
      const result = await handleIngestRequestSpan(req);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/cost-summary') {
      const result = await handleGetCostSummary(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'POST' && url.pathname === '/internal/v1/governance/flags') {
      const result = await handleIngestFlag(req);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/governance/risk-score') {
      const result = await handleGetRiskScore(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/kpi') {
      const result = await handleGetKpi(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/internal/v1/governance/active-grant') {
      const result = await handleCheckActiveGrant(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'POST' && url.pathname === '/internal/v1/gateway/prompts') {
      const result = await handleIngestPrompt(req);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/internal/v1/governance/access-check') {
      const result = await handleAccessCheck(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'POST' && url.pathname === '/internal/v1/governance/approval-requests') {
      const result = await handleCreateApprovalRequestInternal(req);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/governance/approval-requests') {
      const result = await handleListApprovalRequests(req, url);
      return sendJson(res, result.status, result.body);
    }
    if (req.method === 'GET' && url.pathname === '/v1/pattern-library') {
      const result = await handleListPatterns(req, url);
      return sendJson(res, result.status, result.body);
    }

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const m = url.pathname.match(route.pattern);
      if (!m) continue;
      const result = await route.handler(req, m);
      return sendJson(res, result.status, result.body);
    }

    return sendJson(res, 404, { error: 'not_found', request_id: requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return sendJson(res, err.status, { error: err.error, request_id: requestId, ...(err.extra || {}) });
    }
    console.error('[control-plane] unhandled error', requestId, err);
    return sendJson(res, 500, { error: 'internal_error', request_id: requestId });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[control-plane] listening on ${HOST}:${PORT}`);
});
