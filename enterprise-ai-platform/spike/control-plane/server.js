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

const PORT = parseInt(process.env.PORT || '8090', 10);
const HOST = process.env.HOST || '127.0.0.1';
const GATEWAY_TOKEN_SECRET = process.env.CENTERAI_TOKEN_SECRET;
const EMPLOYEE_TOKEN_SECRET = process.env.CENTERAI_EMPLOYEE_TOKEN_SECRET;
const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://valeron.tech';
const IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6h (Q18/Q24.5 — không dùng ranh giới "cùng ngày")
const GATEWAY_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // đủ dài cho 1 ca làm việc

if (!GATEWAY_TOKEN_SECRET || !EMPLOYEE_TOKEN_SECRET) {
  console.error('[control-plane] FATAL: thiếu CENTERAI_TOKEN_SECRET hoặc CENTERAI_EMPLOYEE_TOKEN_SECRET trong env');
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

  const { rows } = await query('SELECT id, email, full_name, status FROM employees WHERE id = $1', [employee_id]);
  if (!rows.length || rows[0].status !== 'active') throw new ApiError(403, 'employee_inactive');

  return rows[0];
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLogin(req) {
  const body = await readJsonBody(req);
  if (!body.email) throw new ApiError(400, 'missing_email');

  const { rows } = await query('SELECT id, email, full_name, status FROM employees WHERE email = $1', [body.email]);
  if (!rows.length) throw new ApiError(404, 'employee_not_found');
  const emp = rows[0];
  if (emp.status !== 'active') throw new ApiError(403, 'employee_inactive');

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 ngày, tiện cho pilot
  const employee_token = signToken({ employee_id: emp.id, email: emp.email, expires_at }, EMPLOYEE_TOKEN_SECRET);

  return { status: 200, body: { employee_id: emp.id, full_name: emp.full_name, employee_token, expires_at } };
}

async function handleListProjects(req) {
  await requireEmployee(req);
  const { rows } = await query('SELECT id, name, status FROM projects WHERE status = $1 ORDER BY name', ['active']);
  return { status: 200, body: { projects: rows } };
}

async function handleListTasks(req, params) {
  await requireEmployee(req);
  const { rows } = await query(
    'SELECT id, project_id, title, status, assignee_employee_id FROM tasks WHERE project_id = $1 ORDER BY created_at',
    [params.projectId]
  );
  return { status: 200, body: { tasks: rows } };
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
    `SELECT ts.*, ws.employee_id AS ws_employee_id FROM tool_sessions ts
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
  return { status: 201, body: { checkpoint_id: cpId } };
}

async function handleEndToolSession(req, params) {
  const emp = await requireEmployee(req);
  const ts = await loadOwnedToolSession(params.id, emp.id);
  if (ts.status === 'closed') return { status: 200, body: { tool_session_id: ts.id, status: 'closed' } };
  await query(`UPDATE tool_sessions SET status = 'closed', ended_at = now() WHERE id = $1`, [ts.id]);
  return { status: 200, body: { tool_session_id: ts.id, status: 'closed' } };
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
  { method: 'GET', pattern: /^\/v1\/projects$/, handler: (req) => handleListProjects(req) },
  {
    method: 'GET',
    pattern: /^\/v1\/projects\/([^/]+)\/tasks$/,
    handler: (req, m) => handleListTasks(req, { projectId: m[1] }),
  },
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
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/v1/context/render') {
      const result = await handleContextRender(req, url);
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
