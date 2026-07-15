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
  const { rows } = await query('SELECT id, name, status FROM projects WHERE status = $1 ORDER BY name', ['active']);
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

async function handleListProjectContext(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT pc.id, pc.task_id, pc.type, pc.content, pc.created_at, e.full_name AS created_by_name
     FROM project_context pc JOIN employees e ON e.id = pc.created_by
     WHERE pc.project_id = $1 ORDER BY pc.created_at DESC LIMIT 50`,
    [params.projectId]
  );
  return { status: 200, body: { context_notes: rows } };
}

async function handleListTasks(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    `SELECT t.id, t.project_id, t.title, t.status, t.assignee_employee_id,
            t.claim_mode, t.claimed_by_employee_id, t.lease_until, e.full_name AS claimed_by_name
     FROM tasks t LEFT JOIN employees e ON e.id = t.claimed_by_employee_id
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
    `SELECT type, content, created_at FROM project_context
     WHERE task_id = $1 OR (project_id = $2 AND task_id IS NULL)
     ORDER BY created_at DESC LIMIT 20`,
    [taskId, taskRes.rows[0].project_id]
  );

  return {
    status: 200,
    body: {
      task: taskRes.rows[0],
      latest_handoff: handoffRes.rows[0] || null,
      context_notes: contextRes.rows,
    },
  };
}

// ---------------------------------------------------------------------------
// Router (thuần, không framework — nhất quán style gateway-adapter/server.js)
// ---------------------------------------------------------------------------

const routes = [
  { method: 'POST', pattern: /^\/v1\/auth\/login$/, handler: (req) => handleLogin(req) },
  { method: 'POST', pattern: /^\/v1\/governance\/full-audit-mode$/, handler: (req) => handleGrantFullAuditMode(req) },
  { method: 'GET', pattern: /^\/v1\/audit-logs$/, handler: (req) => handleListAuditLogs(req) },
  { method: 'GET', pattern: /^\/v1\/flags$/, handler: (req) => handleListFlags(req) },
  { method: 'GET', pattern: /^\/v1\/projects$/, handler: (req) => handleListProjects(req) },
  {
    method: 'GET',
    pattern: /^\/v1\/projects\/([^/]+)\/tasks$/,
    handler: (req, m) => handleListTasks(req, { projectId: m[1] }),
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
