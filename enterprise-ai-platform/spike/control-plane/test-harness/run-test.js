'use strict';
// Test-harness thật cho Control Plane MVP1 — chạy trên droplet (có cả Postgres cục bộ lẫn
// đường tới Gateway Adapter công khai), không mock. Test cả API Control Plane lẫn việc
// token nó mint ra có thật sự dùng được với Gateway Adapter thật hay không (tích hợp thật,
// không dừng ở việc "trông có vẻ đúng token").

const CP = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8090';
const GATEWAY = process.env.GATEWAY_URL || 'https://valeron.tech';
const ACCESS_CODE = process.env.CENTERAI_PILOT_ACCESS_CODE;
const INTERNAL_SECRET = process.env.CENTERAI_INTERNAL_SERVICE_SECRET;
if (!ACCESS_CODE || !INTERNAL_SECRET) {
  console.error('[test-harness] thiếu CENTERAI_PILOT_ACCESS_CODE hoặc CENTERAI_INTERNAL_SERVICE_SECRET trong env, không chạy được');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`PASS - ${name}`);
  } else {
    failed++;
    console.log(`FAIL - ${name}${detail ? ' :: ' + JSON.stringify(detail) : ''}`);
  }
}

async function post(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(url, token) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // --- Login ---
  const wrongCode = await post(`${CP}/v1/auth/login`, { email: 'thanh@company.local', access_code: 'sai-ma' });
  check('login sai access_code -> 401', wrongCode.status === 401 && wrongCode.json.error === 'invalid_access_code', wrongCode);

  const noCode = await post(`${CP}/v1/auth/login`, { email: 'thanh@company.local' });
  check('login thiếu access_code -> 401', noCode.status === 401, noCode);

  const thanhLogin = await post(`${CP}/v1/auth/login`, { email: 'thanh@company.local', access_code: ACCESS_CODE });
  check('login Thanh (đúng access_code) -> 200 + employee_token', thanhLogin.status === 200 && !!thanhLogin.json.employee_token, thanhLogin);
  const thanhToken = thanhLogin.json.employee_token;

  const hoangLogin = await post(`${CP}/v1/auth/login`, { email: 'hoang@company.local', access_code: ACCESS_CODE });
  check('login Hoang (đúng access_code) -> 200 + employee_token', hoangLogin.status === 200 && !!hoangLogin.json.employee_token, hoangLogin);
  const hoangToken = hoangLogin.json.employee_token;

  const unknownLogin = await post(`${CP}/v1/auth/login`, { email: 'nobody@company.local', access_code: ACCESS_CODE });
  check('login email không tồn tại -> 404', unknownLogin.status === 404, unknownLogin);

  // --- Projects / Tasks ---
  const projects = await get(`${CP}/v1/projects`, thanhToken);
  check('list projects có proj_trungnguyen', projects.status === 200 && projects.json.projects.some((p) => p.id === 'proj_trungnguyen'), projects);

  const tasks = await get(`${CP}/v1/projects/proj_trungnguyen/tasks`, thanhToken);
  check('list tasks có task_tng142', tasks.status === 200 && tasks.json.tasks.some((t) => t.id === 'task_tng142'), tasks);

  const noAuthProjects = await get(`${CP}/v1/projects`);
  check('list projects không token -> 401', noAuthProjects.status === 401, noAuthProjects);

  // --- Work Session: tạo mới + resume ---
  // Không assert cứng resumed:false ở lần gọi đầu — DB thật (Postgres, không phải mock)
  // có thể còn Work Session active từ lần chạy test-harness trước (đây là hành vi ĐÚNG
  // theo thiết kế: resume theo idle timeout thật, không phải theo lần chạy test). Cái
  // thật sự cần đúng là: status hợp lệ, seat_id đúng, và gọi lại ngay lập tức phải luôn
  // resume ra cùng 1 work_session_id (bất biến quan trọng nhất).
  const ws1 = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, thanhToken);
  check('tạo/resume Work Session Thanh -> đúng seat', [200, 201].includes(ws1.status) && ws1.json.seat_id === 'seat_claude_thanh', ws1);
  const wsId = ws1.json.work_session_id;

  const ws2 = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, thanhToken);
  check('gọi lại ngay -> resume đúng Work Session cũ', ws2.status === 200 && ws2.json.resumed === true && ws2.json.work_session_id === wsId, ws2);

  const wsHoang = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, hoangToken);
  check('Work Session của Hoàng dùng đúng seat của Hoàng (không lẫn Thanh)', [200, 201].includes(wsHoang.status) && wsHoang.json.seat_id === 'seat_claude_hoang', wsHoang);

  // --- Tool Session + mint gateway token, gọi THẬT qua Gateway Adapter ---
  const ts1 = await post(`${CP}/v1/work-sessions/${wsId}/tool-sessions`, { tool: 'claude_code', machine_id: 'test-harness' }, thanhToken);
  check('tạo Tool Session -> 201 + gateway_token', ts1.status === 201 && !!ts1.json.gateway_token, ts1);
  const tsId = ts1.json.tool_session_id;
  const gatewayToken = ts1.json.gateway_token;

  const realCall = await fetch(`${GATEWAY}/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'cc/claude-sonnet-5',
      max_tokens: 40,
      messages: [{ role: 'user', content: 'Reply with exactly: PONG-CONTROLPLANE-MINTED-TOKEN' }],
    }),
  });
  // Phát hiện thật (không phải giả định): 9Router luôn nối thêm trailer kiểu SSE
  // "data: [DONE]" thẳng sau khối JSON ngay cả ở response non-streaming, không có
  // dấu phân cách -> body KHÔNG phải JSON hợp lệ theo strict JSON.parse. Đã xác nhận
  // bằng xxd trực tiếp trên 9Router (bypass Adapter) nên đây là hành vi gốc của
  // 9Router, không phải lỗi Adapter làm sai lệch response. Client thật (vd company-ai
  // CLI nếu tự gọi HTTP JSON thay vì qua SDK streaming-aware) phải tự cắt bỏ trailer
  // này trước khi parse.
  const realCallText = await realCall.text().catch(() => '');
  let realCallJson = {};
  try {
    realCallJson = JSON.parse(realCallText.split('data: [DONE]')[0].trim());
  } catch {
    // giữ realCallJson rỗng để check() bên dưới fail rõ ràng kèm raw text để debug
    realCallJson = { _unparsed_raw: realCallText.slice(0, 300) };
  }
  check(
    'token Control Plane mint ra dùng được thật với Gateway Adapter (Claude thật trả lời)',
    realCall.status === 200 && realCallJson.content && realCallJson.content[0] && realCallJson.content[0].text.includes('PONG-CONTROLPLANE-MINTED-TOKEN'),
    realCallJson
  );

  // --- Checkpoint ---
  const cp1 = await post(
    `${CP}/v1/tool-sessions/${tsId}/checkpoints`,
    { trigger: 'git_commit', completed: ['API lay comment'], remaining: ['Pagination'], files_changed: ['facebook.service.ts'], git_commit: 'abc123', git_branch: 'main' },
    thanhToken
  );
  check('tạo checkpoint -> 201', cp1.status === 201 && !!cp1.json.checkpoint_id, cp1);

  const cpList = await get(`${CP}/v1/work-sessions/${wsId}/checkpoints`, thanhToken);
  check(
    'đọc lại checkpoints của Work Session (cho company-ai end tổng hợp handoff)',
    cpList.status === 200 && cpList.json.checkpoints.some((c) => c.id === cp1.json.checkpoint_id),
    cpList
  );

  const endTs = await post(`${CP}/v1/tool-sessions/${tsId}/end`, {}, thanhToken);
  check('đóng Tool Session -> status closed', endTs.status === 200 && endTs.json.status === 'closed', endTs);

  // --- Handoff (mục 15 Bước 3-4) ---
  const handoff = await post(
    `${CP}/v1/handoffs`,
    {
      task_id: 'task_tng142',
      work_session_id: wsId,
      summary: 'Da lam API lay comment + retry timeout',
      open_issues: ['BA yeu cau filter thoi gian'],
      next_steps: ['Pagination', 'Deduplicate'],
    },
    thanhToken
  );
  check('publish handoff -> 201', handoff.status === 201 && !!handoff.json.handoff_id, handoff);

  // --- AI Inbox (MVP2 · Q14): Hoàng phải thấy task_tng142 "cần tiếp quản" ngay sau khi
  // Thanh publish handoff, TRƯỚC KHI có ai mở Work Session mới cho task đó ---
  const inboxHoang = await get(`${CP}/v1/inbox?employee_id=emp_hoang`, hoangToken);
  check(
    'inbox Hoàng thấy task_tng142 cần tiếp quản (handoff mới của Thanh, chưa ai pick up)',
    inboxHoang.status === 200 && inboxHoang.json.handoffs_to_pick_up.some((h) => h.task_id === 'task_tng142'),
    inboxHoang
  );

  const timeline = await get(`${CP}/v1/timeline?project_id=proj_trungnguyen`, thanhToken);
  check(
    'timeline project có đủ event handoff + checkpoint vừa tạo',
    timeline.status === 200 &&
      timeline.json.events.some((e) => e.event_type === 'handoff' && e.task_id === 'task_tng142') &&
      timeline.json.events.some((e) => e.event_type === 'checkpoint' && e.task_id === 'task_tng142'),
    timeline
  );

  const endWs = await post(`${CP}/v1/work-sessions/${wsId}/end`, {}, thanhToken);
  check('đóng Work Session -> status closed', endWs.status === 200 && endWs.json.status === 'closed', endWs);

  // --- Hoàng tiếp quản: đọc đúng handoff của Thanh ---
  const latestHandoff = await get(`${CP}/v1/handoffs/task_tng142`, hoangToken);
  check(
    'Hoàng đọc đúng handoff mới nhất của Thanh',
    latestHandoff.status === 200 && latestHandoff.json.handoff && latestHandoff.json.handoff.from_employee_id === 'emp_thanh',
    latestHandoff
  );

  const contextRender = await get(`${CP}/v1/context/render?task_id=task_tng142`, hoangToken);
  check(
    'context/render cho Hoàng có kèm handoff mới nhất',
    contextRender.status === 200 && contextRender.json.latest_handoff && contextRender.json.latest_handoff.summary.includes('API lay comment'),
    contextRender
  );

  // --- Bảo mật: Hoàng không được đóng/thao tác Work Session của Thanh ---
  const wsThanh2 = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, thanhToken);
  const crossAccess = await post(`${CP}/v1/work-sessions/${wsThanh2.json.work_session_id}/end`, {}, hoangToken);
  check('Hoàng thao tác Work Session của Thanh -> 403 not_owner', crossAccess.status === 403 && crossAccess.json.error === 'not_owner', crossAccess);

  // --- Endpoint đọc tổng hợp cho Dashboard (Bước 4) ---
  const employees = await get(`${CP}/v1/employees`, thanhToken);
  check(
    'list employees có cả Thanh/Hoàng kèm đúng seat',
    employees.status === 200 &&
      employees.json.employees.some((e) => e.id === 'emp_thanh' && e.seat_id === 'seat_claude_thanh') &&
      employees.json.employees.some((e) => e.id === 'emp_hoang' && e.seat_id === 'seat_claude_hoang'),
    employees
  );

  const recentHandoffs = await get(`${CP}/v1/handoffs`, hoangToken);
  check(
    'list handoffs gần nhất (across task) có handoff vừa publish',
    recentHandoffs.status === 200 && recentHandoffs.json.handoffs.some((h) => h.id === handoff.json.handoff_id),
    recentHandoffs
  );

  const wsThanh3 = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, thanhToken);
  const activeSessions = await get(`${CP}/v1/work-sessions`, hoangToken);
  check(
    'list active work sessions thấy đúng session vừa mở',
    activeSessions.status === 200 && activeSessions.json.work_sessions.some((w) => w.id === wsThanh3.json.work_session_id),
    activeSessions
  );
  await post(`${CP}/v1/work-sessions/${wsThanh3.json.work_session_id}/end`, {}, thanhToken);

  const contextNotes = await get(`${CP}/v1/projects/proj_trungnguyen/context-notes`, thanhToken);
  check('list project context-notes -> 200 (rỗng hoặc có dữ liệu đều hợp lệ)', contextNotes.status === 200 && Array.isArray(contextNotes.json.context_notes), contextNotes);

  // --- MVP2 hạng mục 2: Request Span đầy đủ ---
  const spanWrongSecret = await post(`${CP}/internal/v1/gateway/request-spans`, { gateway_request_id: 'wrong-secret-test' }, 'sai-secret-hoan-toan');
  check('ingest request-span sai internal secret -> 401', spanWrongSecret.status === 401 && spanWrongSecret.json.error === 'invalid_internal_secret', spanWrongSecret);

  const spanId = `test-harness-span-${Date.now()}`;
  const spanOk = await post(
    `${CP}/internal/v1/gateway/request-spans`,
    {
      gateway_request_id: spanId,
      employee_id: 'emp_thanh',
      project_id: 'proj_trungnguyen',
      task_id: 'task_tng142',
      provider: 'anthropic',
      model: 'cc/claude-sonnet-5',
      input_tokens: 1000,
      output_tokens: 500,
      latency_ms: 999,
      status: 'ok',
      http_status: 200,
    },
    INTERNAL_SECRET
  );
  check('ingest request-span đúng secret -> 201', spanOk.status === 201 && spanOk.json.ok === true, spanOk);

  const costSummary = await get(`${CP}/v1/cost-summary?project_id=proj_trungnguyen`, thanhToken);
  const thanhCost = costSummary.json.cost_by_employee?.find((r) => r.employee_id === 'emp_thanh');
  check(
    'cost-summary tính đúng cost span vừa ingest (1000 in + 500 out, giá claude-sonnet-5)',
    costSummary.status === 200 && thanhCost && Number(thanhCost.total_estimated_cost_usd) >= 0.0105,
    costSummary
  );

  console.log(`\n${passed} PASS / ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[test-harness] lỗi khi chạy:', err);
  process.exit(1);
});
