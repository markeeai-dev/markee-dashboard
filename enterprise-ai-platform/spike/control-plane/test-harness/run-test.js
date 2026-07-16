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
  check('login Thanh trả đúng role=admin (MVP3 seed)', thanhLogin.json.role === 'admin', thanhLogin);
  const thanhToken = thanhLogin.json.employee_token;

  const hoangLogin = await post(`${CP}/v1/auth/login`, { email: 'hoang@company.local', access_code: ACCESS_CODE });
  check('login Hoang (đúng access_code) -> 200 + employee_token', hoangLogin.status === 200 && !!hoangLogin.json.employee_token, hoangLogin);
  check('login Hoang trả đúng role=member (mặc định)', hoangLogin.json.role === 'member', hoangLogin);
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

  // --- MVP2 hạng mục 4: Task claim/lease (Q20) ---
  const claimThanh = await post(`${CP}/v1/tasks/task_tng142/claim`, {}, thanhToken);
  check('Thanh claim task_tng142 -> 200, exclusive', claimThanh.status === 200 && claimThanh.json.claimed_by_employee_id === 'emp_thanh', claimThanh);

  const claimHoangBlocked = await post(`${CP}/v1/tasks/task_tng142/claim`, {}, hoangToken);
  check(
    'Hoàng claim khi Thanh đang giữ lease -> 409, kèm đúng thông tin ai đang giữ',
    claimHoangBlocked.status === 409 && claimHoangBlocked.json.claimed_by_employee_id === 'emp_thanh' && claimHoangBlocked.json.claimed_by_name === 'Thanh',
    claimHoangBlocked
  );

  const getClaimStatus = await get(`${CP}/v1/tasks/task_tng142/claim`, hoangToken);
  check('Hoàng xem được claim hiện tại (không bị chặn xem, chỉ chặn claim)', getClaimStatus.status === 200 && getClaimStatus.json.claimed_by_employee_id === 'emp_thanh', getClaimStatus);

  const releaseByHoang = await post(`${CP}/v1/tasks/task_tng142/release`, {}, hoangToken);
  check('Hoàng release claim của Thanh -> 403 not_claim_owner', releaseByHoang.status === 403, releaseByHoang);

  const releaseByThanh = await post(`${CP}/v1/tasks/task_tng142/release`, {}, thanhToken);
  check('Thanh tự release claim của mình -> 200', releaseByThanh.status === 200 && releaseByThanh.json.released === true, releaseByThanh);

  const claimHoangAfterRelease = await post(`${CP}/v1/tasks/task_tng142/claim`, {}, hoangToken);
  check('Sau khi Thanh release, Hoàng claim thành công', claimHoangAfterRelease.status === 200 && claimHoangAfterRelease.json.claimed_by_employee_id === 'emp_hoang', claimHoangAfterRelease);
  await post(`${CP}/v1/tasks/task_tng142/release`, {}, hoangToken); // dọn lại cho phần test còn lại không bị ảnh hưởng

  // --- Overlap-check: 2 người cùng sửa 1 file trong 2 Work Session active khác nhau ---
  const wsOverlapThanh = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, thanhToken);
  const tsOverlapThanh = await post(`${CP}/v1/work-sessions/${wsOverlapThanh.json.work_session_id}/tool-sessions`, { tool: 'claude_code', machineId: 'overlap-test' }, thanhToken);
  await post(`${CP}/v1/tool-sessions/${tsOverlapThanh.json.tool_session_id}/checkpoints`, { trigger: 'manual', files_changed: ['shared-file.ts'] }, thanhToken);

  const wsOverlapHoang = await post(`${CP}/v1/work-sessions`, { task_id: 'task_tng142' }, hoangToken);
  const tsOverlapHoang = await post(`${CP}/v1/work-sessions/${wsOverlapHoang.json.work_session_id}/tool-sessions`, { tool: 'claude_code', machineId: 'overlap-test' }, hoangToken);
  await post(`${CP}/v1/tool-sessions/${tsOverlapHoang.json.tool_session_id}/checkpoints`, { trigger: 'manual', files_changed: ['shared-file.ts'] }, hoangToken);

  const overlapCheck = await get(`${CP}/v1/tasks/task_tng142/overlap-check`, thanhToken);
  check(
    'overlap-check phát hiện đúng shared-file.ts bị 2 người cùng sửa',
    overlapCheck.status === 200 &&
      overlapCheck.json.overlaps.some((o) => o.file === 'shared-file.ts' && o.employees.length === 2),
    overlapCheck
  );

  // dọn 2 Work Session vừa tạo để không ảnh hưởng các test resume phía dưới
  await post(`${CP}/v1/work-sessions/${wsOverlapThanh.json.work_session_id}/end`, {}, thanhToken);
  await post(`${CP}/v1/work-sessions/${wsOverlapHoang.json.work_session_id}/end`, {}, hoangToken);

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

  // --- MVP2 hạng mục 3: Handoff sinh bằng LLM — gọi AI thật, không assert đúng từng chữ
  // (output không xác định), chỉ assert có trả về text thật, hợp lý về độ dài ---
  const draftHandoff = await post(
    `${CP}/v1/work-sessions/${wsId}/draft-handoff`,
    { git_log: 'abc123 fix retry logic', git_diff_stat: 'facebook.service.ts | 10 ++++' },
    thanhToken
  );
  check(
    'draft-handoff gọi AI thật trả về text hợp lý (>20 ký tự)',
    draftHandoff.status === 200 && typeof draftHandoff.json.draft_summary === 'string' && draftHandoff.json.draft_summary.length > 20,
    draftHandoff
  );

  const draftHandoffWrongOwner = await post(`${CP}/v1/work-sessions/${wsId}/draft-handoff`, {}, hoangToken);
  check('draft-handoff Hoàng gọi vào Work Session của Thanh -> 403 not_owner', draftHandoffWrongOwner.status === 403, draftHandoffWrongOwner);

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

  // --- MVP3 khởi động: Governance (Q13) + 2-mode Audit (Q22) ---
  const flagWrongSecret = await post(`${CP}/internal/v1/governance/flags`, { type: 'secret_detected', severity: 'high' }, 'sai-secret-hoan-toan');
  check('ingest flag sai internal secret -> 401', flagWrongSecret.status === 401, flagWrongSecret);

  const flagOk = await post(
    `${CP}/internal/v1/governance/flags`,
    { employee_id: 'emp_thanh', type: 'secret_detected', severity: 'high', detail: { pattern: 'aws_access_key' }, blocked: true },
    INTERNAL_SECRET
  );
  check('ingest flag đúng secret -> 201', flagOk.status === 201 && !!flagOk.json.flag_id, flagOk);

  const flagPiiOk = await post(
    `${CP}/internal/v1/governance/flags`,
    { employee_id: 'emp_thanh', type: 'pii_detected', severity: 'med', detail: { pattern: 'vn_national_id' }, blocked: false },
    INTERNAL_SECRET
  );
  check('ingest flag PII (cảnh báo, không chặn) -> 201', flagPiiOk.status === 201, flagPiiOk);

  const riskScoreAsMember = await get(`${CP}/v1/governance/risk-score`, hoangToken);
  check('Hoàng (member) xem risk-score -> 403 admin_required', riskScoreAsMember.status === 403 && riskScoreAsMember.json.error === 'admin_required', riskScoreAsMember);

  const riskScoreAsAdmin = await get(`${CP}/v1/governance/risk-score`, thanhToken);
  const thanhRisk = riskScoreAsAdmin.json.risk_scores?.find((r) => r.employee_id === 'emp_thanh');
  check(
    'Thanh (admin) xem risk-score -> 200, đúng tổng điểm (high=5 + med=3 = 8)',
    riskScoreAsAdmin.status === 200 && thanhRisk && Number(thanhRisk.risk_score) >= 8,
    riskScoreAsAdmin
  );

  const grantAsMember = await post(`${CP}/v1/governance/full-audit-mode`, { scope: 'employee', scope_id: 'emp_hoang', reason: 'test' }, hoangToken);
  check('Hoàng (member) bật Full Audit Mode -> 403', grantAsMember.status === 403, grantAsMember);

  const grantAsAdmin = await post(
    `${CP}/v1/governance/full-audit-mode`,
    { scope: 'employee', scope_id: 'emp_hoang', reason: 'điều tra rò rỉ secret nghi vấn', duration_hours: 2 },
    thanhToken
  );
  check('Thanh (admin) bật Full Audit Mode có lý do -> 201', grantAsAdmin.status === 201 && !!grantAsAdmin.json.grant_id, grantAsAdmin);

  const auditLogsAsMember = await get(`${CP}/v1/audit-logs`, hoangToken);
  check('Hoàng (member) xem audit-logs -> 403', auditLogsAsMember.status === 403, auditLogsAsMember);

  const auditLogsAsAdmin = await get(`${CP}/v1/audit-logs`, thanhToken);
  check(
    'Thanh (admin) xem audit-logs -> 200, có đủ log secret_detected + full_audit_mode_granted vừa tạo',
    auditLogsAsAdmin.status === 200 &&
      auditLogsAsAdmin.json.audit_logs.some((a) => a.action === 'governance_secret_detected') &&
      auditLogsAsAdmin.json.audit_logs.some((a) => a.action === 'full_audit_mode_granted'),
    auditLogsAsAdmin
  );

  const flagsAsMember = await get(`${CP}/v1/flags`, hoangToken);
  check('Hoàng (member) xem flags -> 403', flagsAsMember.status === 403, flagsAsMember);

  const flagsAsAdmin = await get(`${CP}/v1/flags`, thanhToken);
  check(
    'Thanh (admin) xem flags -> 200, có flag secret_detected vừa ingest',
    flagsAsAdmin.status === 200 && flagsAsAdmin.json.flags.some((f) => f.id === flagOk.json.flag_id),
    flagsAsAdmin
  );

  // --- MVP3 tiếp theo, hạng mục 2: Context Confidence + ADR (Q15) ---
  const contextNotesConfidence = await get(`${CP}/v1/projects/proj_trungnguyen/context-notes`, thanhToken);
  const decisionNote = contextNotesConfidence.json.context_notes?.find((c) => c.id === 'ctx_decision_1');
  const statusNote = contextNotesConfidence.json.context_notes?.find((c) => c.id === 'ctx_status_1');
  check(
    'context-notes: decision đã approved -> confidence 100%, không decay',
    decisionNote && decisionNote.confidence === 100 && decisionNote.confidence_label.includes('approved'),
    decisionNote
  );
  check(
    'context-notes: status chưa duyệt, 20 ngày tuổi -> confidence decay đúng khoảng 20-100%',
    statusNote && statusNote.confidence > 20 && statusNote.confidence < 100,
    statusNote
  );

  const contextRenderConfidence = await get(`${CP}/v1/context/render?task_id=task_tng142`, thanhToken);
  check(
    'context/render cũng trả kèm confidence (company-ai claude dùng endpoint này)',
    contextRenderConfidence.status === 200 && contextRenderConfidence.json.context_notes.every((c) => typeof c.confidence === 'number'),
    contextRenderConfidence
  );

  const adrMissingFields = await post(`${CP}/v1/context/ctx_decision_1/decision-detail`, {}, thanhToken);
  check('tạo ADR thiếu field -> 400', adrMissingFields.status === 400, adrMissingFields);

  const adrWrongType = await post(
    `${CP}/v1/context/ctx_status_1/decision-detail`,
    { chosen: 'x', rationale: 'y' },
    thanhToken
  );
  check('tạo ADR trên context không phải type=decision -> 400', adrWrongType.status === 400 && adrWrongType.json.error === 'context_not_decision_type', adrWrongType);

  const adrOk = await post(
    `${CP}/v1/context/ctx_decision_1/decision-detail`,
    {
      options_considered: ['retry voi backoff', 'queue rieng'],
      criteria: ['do phuc tap', 'chi phi van hanh'],
      chosen: 'retry voi backoff',
      rationale: 'Don gian hon, khong can them ha tang queue cho quy mo hien tai',
    },
    thanhToken
  );
  check('tạo ADR hợp lệ -> 201', adrOk.status === 201 && !!adrOk.json.decision_detail_id, adrOk);

  // --- Vá gap A: POST /v1/context/ingest — test khép kín cả vòng (tạo -> đọc lại 2 đường) ---
  const ingestMissingFields = await post(`${CP}/v1/context/ingest`, { project_id: 'proj_trungnguyen' }, thanhToken);
  check('context/ingest thiếu field -> 400', ingestMissingFields.status === 400, ingestMissingFields);

  const ingestInvalidType = await post(
    `${CP}/v1/context/ingest`,
    { project_id: 'proj_trungnguyen', type: 'khong_hop_le', content: 'x' },
    thanhToken
  );
  check('context/ingest type sai -> 400 invalid_type', ingestInvalidType.status === 400 && ingestInvalidType.json.error === 'invalid_type', ingestInvalidType);

  const ingestOk = await post(
    `${CP}/v1/context/ingest`,
    {
      project_id: 'proj_trungnguyen',
      task_id: 'task_tng142',
      type: 'requirement',
      content: 'BA yeu cau them bo loc theo khu vuc dia ly (test vá gap A)',
      approved_by: true, // tự khai đã duyệt — hệ thống chưa có Approval workflow, ghi rõ trong plan
    },
    thanhToken
  );
  check('context/ingest hợp lệ -> 201', ingestOk.status === 201 && !!ingestOk.json.context_id, ingestOk);

  const contextNotesAfterIngest = await get(`${CP}/v1/projects/proj_trungnguyen/context-notes`, thanhToken);
  check(
    'đọc lại qua context-notes thấy đúng entry vừa tạo, approved_by = chính người tạo',
    contextNotesAfterIngest.json.context_notes.some((c) => c.id === ingestOk.json.context_id && c.approved_by === 'emp_thanh'),
    contextNotesAfterIngest
  );

  const contextRenderAfterIngest = await get(`${CP}/v1/context/render?task_id=task_tng142`, thanhToken);
  check(
    'đọc lại qua context/render (đường company-ai claude thật dùng) cũng thấy đúng entry',
    contextRenderAfterIngest.json.context_notes.some((c) => c.id === ingestOk.json.context_id),
    contextRenderAfterIngest
  );

  // --- Vá gap A: revoke Full Audit Mode sớm ---
  const grantToRevoke = await post(
    `${CP}/v1/governance/full-audit-mode`,
    { scope: 'employee', scope_id: 'emp_hoang', reason: 'test revoke som (vá gap A)', duration_hours: 4 },
    thanhToken
  );
  const revokeAsMember = await post(`${CP}/v1/governance/full-audit-mode/${grantToRevoke.json.grant_id}/revoke`, {}, hoangToken);
  check('Hoàng (member) revoke grant -> 403', revokeAsMember.status === 403, revokeAsMember);

  const activeGrantBeforeRevoke = await get(`${CP}/internal/v1/governance/active-grant?employee_id=emp_hoang&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('trước revoke: grant của Hoàng đang active', activeGrantBeforeRevoke.json.grant?.id === grantToRevoke.json.grant_id, activeGrantBeforeRevoke);

  const revokeAsAdmin = await post(`${CP}/v1/governance/full-audit-mode/${grantToRevoke.json.grant_id}/revoke`, {}, thanhToken);
  check('Thanh (admin) revoke grant -> 200', revokeAsAdmin.status === 200 && revokeAsAdmin.json.revoked === true, revokeAsAdmin);

  const activeGrantAfterRevoke = await get(`${CP}/internal/v1/governance/active-grant?employee_id=emp_hoang&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check(
    'sau revoke: grant KHÔNG còn active nữa (hoặc null, hoặc grant active khác nếu Hoàng còn grant tồn đọng)',
    activeGrantAfterRevoke.json.grant?.id !== grantToRevoke.json.grant_id,
    activeGrantAfterRevoke
  );

  const revokeAlreadyRevoked = await post(`${CP}/v1/governance/full-audit-mode/${grantToRevoke.json.grant_id}/revoke`, {}, thanhToken);
  check('revoke lại 1 grant đã revoke rồi -> vẫn 200 (idempotent)', revokeAlreadyRevoked.status === 200, revokeAlreadyRevoked);

  const revokeNotFound = await post(`${CP}/v1/governance/full-audit-mode/fag_khong_ton_tai/revoke`, {}, thanhToken);
  check('revoke grant_id không tồn tại -> 404', revokeNotFound.status === 404, revokeNotFound);

  const listGrantsAsMember = await get(`${CP}/v1/governance/full-audit-grants`, hoangToken);
  check('Hoàng (member) list grants -> 403', listGrantsAsMember.status === 403, listGrantsAsMember);

  const listGrantsAsAdmin = await get(`${CP}/v1/governance/full-audit-grants`, thanhToken);
  const revokedGrantInList = listGrantsAsAdmin.json.grants?.find((g) => g.id === grantToRevoke.json.grant_id);
  check(
    'Thanh (admin) list grants -> 200, thấy đúng grant vừa revoke với is_active=false',
    listGrantsAsAdmin.status === 200 && revokedGrantInList && revokedGrantInList.is_active === false,
    revokedGrantInList
  );

  // --- MVP3 tiếp theo, hạng mục 1: Full Audit Mode — lưu nội dung thô có redact (Q22) ---
  const activeGrantWrongSecret = await get(`${CP}/internal/v1/governance/active-grant?employee_id=emp_thanh&project_id=proj_trungnguyen`, 'sai-secret-hoan-toan');
  check('active-grant sai internal secret -> 401', activeGrantWrongSecret.status === 401, activeGrantWrongSecret);

  // Dùng employee_id không có thật thay vì emp_hoang — test-harness chạy nhiều lần tích luỹ
  // grant thật (vd Hoàng đã có grant 2h còn hiệu lực từ lần chạy Governance trước đó), giả
  // định "Hoàng chưa có grant" không còn đúng theo DB thật, không phải lỗi code active-grant.
  const activeGrantNone = await get(`${CP}/internal/v1/governance/active-grant?employee_id=emp_khong_ton_tai&project_id=proj_khong_ton_tai`, INTERNAL_SECRET);
  check('active-grant khi không có grant nào khớp -> grant:null', activeGrantNone.status === 200 && activeGrantNone.json.grant === null, activeGrantNone);

  const grantForThanh = await post(
    `${CP}/v1/governance/full-audit-mode`,
    { scope: 'employee', scope_id: 'emp_thanh', reason: 'test luu noi dung tho co redact', duration_hours: 1 },
    thanhToken
  );
  check('tạo grant cho Thanh (test hạng mục 1) -> 201', grantForThanh.status === 201, grantForThanh);
  const thanhGrantId = grantForThanh.json.grant_id;

  const activeGrantFound = await get(`${CP}/internal/v1/governance/active-grant?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('active-grant tìm đúng grant vừa tạo cho Thanh', activeGrantFound.status === 200 && activeGrantFound.json.grant?.id === thanhGrantId, activeGrantFound);

  const ingestPromptWrongSecret = await post(`${CP}/internal/v1/gateway/prompts`, { gateway_request_id: 'x' }, 'sai-secret-hoan-toan');
  check('ingest prompt sai internal secret -> 401', ingestPromptWrongSecret.status === 401, ingestPromptWrongSecret);

  const ingestPromptFakeGrant = await post(
    `${CP}/internal/v1/gateway/prompts`,
    { gateway_request_id: 'x', full_audit_grant_id: 'fag_khong_ton_tai', prompt_redacted: 'test', prompt_hash: 'abc' },
    INTERNAL_SECRET
  );
  check('ingest prompt với grant_id giả/hết hạn -> 403', ingestPromptFakeGrant.status === 403 && ingestPromptFakeGrant.json.error === 'grant_expired_or_not_found', ingestPromptFakeGrant);

  const ingestPromptOk = await post(
    `${CP}/internal/v1/gateway/prompts`,
    {
      gateway_request_id: 'gw_test_full_audit',
      employee_id: 'emp_thanh',
      work_session_id: wsId,
      prompt_redacted: 'giup toi debug ham nay, key la [REDACTED:aws_access_key]',
      prompt_hash: 'sha256_gia_lap_cho_test',
      full_audit_grant_id: thanhGrantId,
      response_redacted: 'day la cach debug...',
    },
    INTERNAL_SECRET
  );
  check('ingest prompt với grant hợp lệ -> 201', ingestPromptOk.status === 201 && !!ingestPromptOk.json.prompt_id, ingestPromptOk);

  const promptsAsMember = await get(`${CP}/v1/work-sessions/${wsId}/prompts`, hoangToken);
  check('Hoàng (member) xem prompts đã lưu -> 403', promptsAsMember.status === 403, promptsAsMember);

  const promptsAsAdmin = await get(`${CP}/v1/work-sessions/${wsId}/prompts`, thanhToken);
  check(
    'Thanh (admin) xem prompts -> 200, thấy đúng nội dung ĐÃ REDACT (không phải bản gốc)',
    promptsAsAdmin.status === 200 && promptsAsAdmin.json.prompts.some((p) => p.id === ingestPromptOk.json.prompt_id && p.content_redacted.includes('[REDACTED:aws_access_key]')),
    promptsAsAdmin
  );

  const auditLogsAfterView = await get(`${CP}/v1/audit-logs`, thanhToken);
  check(
    'Xem prompts đã tự ghi audit_logs (full_audit_content_viewed) — xem là hành động có dấu vết',
    auditLogsAfterView.status === 200 && auditLogsAfterView.json.audit_logs.some((a) => a.action === 'full_audit_content_viewed'),
    auditLogsAfterView
  );

  // --- KPI 4 lớp (Q22) — chỉ 3/4 lớp có dữ liệu thật ---
  const kpiAsMember = await get(`${CP}/v1/kpi`, hoangToken);
  check('Hoàng (member) xem KPI -> 403', kpiAsMember.status === 403, kpiAsMember);

  const kpiFull = await get(`${CP}/v1/kpi`, thanhToken);
  check(
    'KPI đầy đủ: outcome:null kèm lý do rõ ràng, không bịa số',
    kpiFull.status === 200 && kpiFull.json.outcome === null && typeof kpiFull.json.outcome_note === 'string' && kpiFull.json.outcome_note.length > 0,
    kpiFull
  );

  const thanhAdoption = kpiFull.json.adoption?.find((a) => a.employee_id === 'emp_thanh');
  check(
    'Adoption: Thanh có ai_active_days >= 1 và tool_adoption.claude_code > 0 (dữ liệu thật đã tích luỹ)',
    thanhAdoption && thanhAdoption.ai_active_days >= 1 && thanhAdoption.tool_adoption.claude_code > 0,
    thanhAdoption
  );

  const thanhEfficiency = kpiFull.json.efficiency?.find((e) => e.employee_id === 'emp_thanh');
  check(
    'Efficiency: có dòng cho Thanh (closed_task_count >= 0, không lỗi khi chưa có task closed)',
    thanhEfficiency && typeof thanhEfficiency.closed_task_count !== 'undefined',
    thanhEfficiency
  );

  const thanhCollab = kpiFull.json.collaboration?.find((c) => c.employee_id === 'emp_thanh');
  check(
    'Collaboration: Thanh có handoffs_created >= 1 (đã publish nhiều handoff thật trong session này)',
    thanhCollab && thanhCollab.handoffs_created >= 1,
    thanhCollab
  );

  const kpiLayerFiltered = await get(`${CP}/v1/kpi?layer=adoption`, thanhToken);
  check(
    'layer=adoption chỉ trả về adoption, không trả efficiency/collaboration',
    kpiLayerFiltered.status === 200 && Array.isArray(kpiLayerFiltered.json.adoption) && kpiLayerFiltered.json.efficiency === undefined && kpiLayerFiltered.json.collaboration === undefined,
    kpiLayerFiltered
  );

  // --- MVP3 Đợt 4 — Policy Engine cơ bản: Data Classification (tầng Project) + Approval (Q13) ---

  // Dọn approval tồn đọng từ lần chạy trước (hoặc từ test/demo thủ công trước đó) TRƯỚC khi
  // test — "chưa duyệt -> allowed:false" chỉ đáng tin nếu không còn approval nào từ trước vẫn
  // hiệu lực. Cùng vấn đề đã gặp ở "Hoàng chưa có grant" (Đợt 2): không giả định trạng thái
  // sạch, chủ động dọn bằng chính endpoint revoke vừa xây (không phải bỏ sót ở Đợt 4 — lúc đó
  // chưa cần vì chưa có ai chạy lại nhiều lần trong cùng khung giờ hiệu lực).
  async function revokeStaleApprovals(employeeId) {
    const list = await get(`${CP}/v1/governance/approval-requests?status=approved`, thanhToken);
    const stale = (list.json.approval_requests || []).filter(
      (a) => a.employee_id === employeeId && a.project_id === 'proj_trungnguyen' && a.classification === 'customer_data'
    );
    for (const a of stale) await post(`${CP}/v1/governance/approval-requests/${a.id}/revoke`, {}, thanhToken);
  }
  await revokeStaleApprovals('emp_thanh');
  await revokeStaleApprovals('emp_hoang');

  // An toàn mặc định TRƯỚC KHI tạo policy nào — đúng yêu cầu plan, phải xác nhận traffic thật
  // của Thanh/Hoàng không bị ảnh hưởng cho tới khi admin chủ động cấu hình.
  const accessCheckDefault = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check(
    'access-check mặc định (chưa có policy nào) -> allowed:true, không ảnh hưởng traffic thật',
    accessCheckDefault.status === 200 && accessCheckDefault.json.allowed === true,
    accessCheckDefault
  );

  const setClassInvalid = await post(`${CP}/v1/projects/proj_trungnguyen/classification`, { classification: 'khong-hop-le' }, thanhToken);
  check('set classification sai giá trị -> 400', setClassInvalid.status === 400, setClassInvalid);

  const setClassAsMember = await post(`${CP}/v1/projects/proj_trungnguyen/classification`, { classification: 'customer_data' }, hoangToken);
  check('Hoàng (member) set classification -> 403', setClassAsMember.status === 403, setClassAsMember);

  const setClassOk = await post(`${CP}/v1/projects/proj_trungnguyen/classification`, { classification: 'customer_data' }, thanhToken);
  check('Thanh (admin) set classification customer_data -> 200', setClassOk.status === 200 && setClassOk.json.classification === 'customer_data', setClassOk);

  const projectsAfterClass = await get(`${CP}/v1/projects`, thanhToken);
  check(
    'list projects hiện đúng classification vừa set',
    projectsAfterClass.json.projects.find((p) => p.id === 'proj_trungnguyen')?.classification === 'customer_data',
    projectsAfterClass
  );

  const policyBadScope = await post(`${CP}/v1/policies`, { scope: 'khong-hop-le', classification: 'customer_data' }, thanhToken);
  check('tạo policy scope sai -> 400', policyBadScope.status === 400, policyBadScope);

  const policyCompanyWithScopeId = await post(`${CP}/v1/policies`, { scope: 'company', scope_id: 'proj_trungnguyen', classification: 'customer_data' }, thanhToken);
  check('tạo policy scope=company nhưng có scope_id -> 400', policyCompanyWithScopeId.status === 400, policyCompanyWithScopeId);

  const policyProjectNoScopeId = await post(`${CP}/v1/policies`, { scope: 'project', classification: 'customer_data' }, thanhToken);
  check('tạo policy scope=project thiếu scope_id -> 400', policyProjectNoScopeId.status === 400, policyProjectNoScopeId);

  const policyProjectNotFound = await post(`${CP}/v1/policies`, { scope: 'project', scope_id: 'proj_khong_ton_tai', classification: 'customer_data' }, thanhToken);
  check('tạo policy scope=project với project không tồn tại -> 400', policyProjectNotFound.status === 400, policyProjectNotFound);

  const policyOk = await post(`${CP}/v1/policies`, { scope: 'company', classification: 'customer_data', requires_approval: true }, thanhToken);
  check('Thanh (admin) tạo policy company-wide customer_data requires_approval -> 201', policyOk.status === 201 && !!policyOk.json.policy_id, policyOk);

  const policiesAsMember = await get(`${CP}/v1/policies`, hoangToken);
  check('Hoàng (member) xem policies -> 403', policiesAsMember.status === 403, policiesAsMember);

  const policiesAsAdmin = await get(`${CP}/v1/policies`, thanhToken);
  check('Thanh (admin) xem policies -> 200, thấy đúng policy vừa tạo', policiesAsAdmin.status === 200 && policiesAsAdmin.json.policies.some((p) => p.id === policyOk.json.policy_id), policiesAsAdmin);

  const accessCheckWrongSecret = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, 'sai-secret-hoan-toan');
  check('access-check sai internal secret -> 401', accessCheckWrongSecret.status === 401, accessCheckWrongSecret);

  const accessCheckBlocked = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check(
    'access-check sau khi có policy + chưa duyệt -> allowed:false, đúng classification',
    accessCheckBlocked.status === 200 && accessCheckBlocked.json.allowed === false && accessCheckBlocked.json.classification === 'customer_data',
    accessCheckBlocked
  );

  const createApprovalWrongSecret = await post(`${CP}/internal/v1/governance/approval-requests`, { employee_id: 'emp_thanh', project_id: 'proj_trungnguyen', classification: 'customer_data' }, 'sai-secret-hoan-toan');
  check('tạo approval request nội bộ sai secret -> 401', createApprovalWrongSecret.status === 401, createApprovalWrongSecret);

  const createApproval1 = await post(`${CP}/internal/v1/governance/approval-requests`, { employee_id: 'emp_thanh', project_id: 'proj_trungnguyen', classification: 'customer_data' }, INTERNAL_SECRET);
  check('Adapter tự tạo approval request khi block -> 201, created:true', createApproval1.status === 201 && createApproval1.json.created === true, createApproval1);

  const createApproval2 = await post(`${CP}/internal/v1/governance/approval-requests`, { employee_id: 'emp_thanh', project_id: 'proj_trungnguyen', classification: 'customer_data' }, INTERNAL_SECRET);
  check(
    'gọi lại lần 2 (nhân viên thử lại) -> upsert, không tạo trùng pending',
    createApproval2.status === 200 && createApproval2.json.created === false && createApproval2.json.approval_request_id === createApproval1.json.approval_request_id,
    createApproval2
  );

  const approvalListAsMember = await get(`${CP}/v1/governance/approval-requests`, hoangToken);
  check('Hoàng (member) xem approval requests -> 403', approvalListAsMember.status === 403, approvalListAsMember);

  const approvalListPending = await get(`${CP}/v1/governance/approval-requests?status=pending`, thanhToken);
  check(
    'Thanh (admin) xem approval requests pending -> 200, thấy đúng request vừa tạo',
    approvalListPending.status === 200 && approvalListPending.json.approval_requests.some((a) => a.id === createApproval1.json.approval_request_id),
    approvalListPending
  );

  const approveAsMember = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/approve`, { duration_hours: 1 }, hoangToken);
  check('Hoàng (member) approve -> 403', approveAsMember.status === 403, approveAsMember);

  const approveNotFound = await post(`${CP}/v1/governance/approval-requests/apr_khong_ton_tai/approve`, { duration_hours: 1 }, thanhToken);
  check('approve id không tồn tại -> 404', approveNotFound.status === 404, approveNotFound);

  const approveOk = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/approve`, { duration_hours: 1 }, thanhToken);
  check('Thanh (admin) approve -> 200, status=approved, có expires_at', approveOk.status === 200 && approveOk.json.status === 'approved' && !!approveOk.json.expires_at, approveOk);

  const approveAgain = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/approve`, { duration_hours: 1 }, thanhToken);
  check('approve lại request đã quyết định -> 400 not_pending', approveAgain.status === 400, approveAgain);

  const accessCheckAfterApprove = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('access-check sau khi được duyệt -> allowed:true', accessCheckAfterApprove.status === 200 && accessCheckAfterApprove.json.allowed === true, accessCheckAfterApprove);

  const revokeApprovalAsMember = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/revoke`, {}, hoangToken);
  check('Hoàng (member) revoke approval -> 403', revokeApprovalAsMember.status === 403, revokeApprovalAsMember);

  const revokeApprovalOk = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/revoke`, {}, thanhToken);
  check('Thanh (admin) revoke approval đã duyệt -> 200', revokeApprovalOk.status === 200 && revokeApprovalOk.json.revoked === true, revokeApprovalOk);

  const revokeApprovalAgainIdempotent = await post(`${CP}/v1/governance/approval-requests/${createApproval1.json.approval_request_id}/revoke`, {}, thanhToken);
  check('revoke lại approval đã revoke rồi -> vẫn 200 (idempotent)', revokeApprovalAgainIdempotent.status === 200, revokeApprovalAgainIdempotent);

  const accessCheckAfterRevoke = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('access-check sau khi revoke -> allowed:false ngay lập tức', accessCheckAfterRevoke.status === 200 && accessCheckAfterRevoke.json.allowed === false, accessCheckAfterRevoke);

  const createApprovalHoang = await post(`${CP}/internal/v1/governance/approval-requests`, { employee_id: 'emp_hoang', project_id: 'proj_trungnguyen', classification: 'customer_data' }, INTERNAL_SECRET);
  const rejectOk = await post(`${CP}/v1/governance/approval-requests/${createApprovalHoang.json.approval_request_id}/reject`, {}, thanhToken);
  check('Thanh (admin) reject -> 200, status=rejected', rejectOk.status === 200 && rejectOk.json.status === 'rejected', rejectOk);

  const accessCheckHoangAfterReject = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_hoang&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('access-check của Hoàng sau khi bị reject -> vẫn allowed:false (reject không cấp quyền)', accessCheckHoangAfterReject.status === 200 && accessCheckHoangAfterReject.json.allowed === false, accessCheckHoangAfterReject);

  // Dọn lại đúng trạng thái mặc định — không để lại policy nào chặn traffic thật của
  // Thanh/Hoàng sau khi test-harness chạy xong (policy company-wide vẫn còn nhưng chỉ khớp
  // classification='customer_data', proj_trungnguyen trở lại 'unclassified' nên không khớp nữa).
  const resetClass = await post(`${CP}/v1/projects/proj_trungnguyen/classification`, { classification: 'unclassified' }, thanhToken);
  check('reset proj_trungnguyen về unclassified sau test -> 200', resetClass.status === 200 && resetClass.json.classification === 'unclassified', resetClass);

  const accessCheckAfterReset = await get(`${CP}/internal/v1/governance/access-check?employee_id=emp_thanh&project_id=proj_trungnguyen`, INTERNAL_SECRET);
  check('access-check sau khi reset về unclassified -> allowed:true (không còn policy khớp)', accessCheckAfterReset.status === 200 && accessCheckAfterReset.json.allowed === true, accessCheckAfterReset);

  // --- MVP3 Đợt 5 — Company Brain scope_level (Q16, thu hẹp) + Pattern Library (Q16) ---

  const ctxScopeDefault = await post(`${CP}/v1/context/ingest`, { project_id: 'proj_trungnguyen', type: 'status', content: 'test scope_level mặc định' }, thanhToken);
  check('context/ingest không truyền scope_level -> mặc định project', ctxScopeDefault.status === 201, ctxScopeDefault);

  const notesAfterDefault = await get(`${CP}/v1/projects/proj_trungnguyen/context-notes`, thanhToken);
  check(
    'context vừa tạo (không truyền scope_level) đọc lại thấy scope_level=project',
    notesAfterDefault.json.context_notes.find((n) => n.id === ctxScopeDefault.json.context_id)?.scope_level === 'project',
    notesAfterDefault
  );

  const ctxScopePersonal = await post(`${CP}/v1/context/ingest`, { project_id: 'proj_trungnguyen', type: 'status', content: 'test scope_level personal', scope_level: 'personal' }, thanhToken);
  check('context/ingest với scope_level=personal -> 201', ctxScopePersonal.status === 201, ctxScopePersonal);

  const notesAfterPersonal = await get(`${CP}/v1/projects/proj_trungnguyen/context-notes`, thanhToken);
  check(
    'context vừa tạo (scope_level=personal) đọc lại đúng',
    notesAfterPersonal.json.context_notes.find((n) => n.id === ctxScopePersonal.json.context_id)?.scope_level === 'personal',
    notesAfterPersonal
  );

  const ctxScopeInvalid = await post(`${CP}/v1/context/ingest`, { project_id: 'proj_trungnguyen', type: 'status', content: 'test scope_level sai', scope_level: 'khong-hop-le' }, thanhToken);
  check('context/ingest scope_level sai -> 400', ctxScopeInvalid.status === 400, ctxScopeInvalid);

  const contextRenderScope = await get(`${CP}/v1/context/render?task_id=task_tng142`, thanhToken);
  check(
    'context/render (đường company-ai claude thật dùng) cũng trả kèm scope_level',
    contextRenderScope.status === 200 && contextRenderScope.json.context_notes.every((n) => typeof n.scope_level === 'string'),
    contextRenderScope
  );

  // Pattern Library — generalize thủ công + gate "người duyệt phải khác người tạo"
  const patternMissingFields = await post(`${CP}/v1/pattern-library/generalize`, { title: 'thiếu content/category' }, thanhToken);
  check('generalize thiếu field -> 400', patternMissingFields.status === 400, patternMissingFields);

  const patternGeneralize = await post(
    `${CP}/v1/pattern-library/generalize`,
    { title: 'Retry pattern cho API rate limit', content: 'Dùng exponential backoff + jitter, tối đa 5 lần thử, không giữ tên khách hàng cụ thể.', category: 'reliability' },
    thanhToken
  );
  check('Thanh generalize 1 pattern mới -> 201', patternGeneralize.status === 201 && !!patternGeneralize.json.pattern_id, patternGeneralize);

  const patternListBeforeApprove = await get(`${CP}/v1/pattern-library?category=reliability`, hoangToken);
  check(
    'pattern chưa duyệt -> KHÔNG hiện trong GET công khai',
    patternListBeforeApprove.status === 200 && !patternListBeforeApprove.json.patterns.some((p) => p.id === patternGeneralize.json.pattern_id),
    patternListBeforeApprove
  );

  const patternPendingAsMember = await get(`${CP}/v1/pattern-library?status=pending`, hoangToken);
  check('Hoàng (member) xem hàng chờ duyệt pattern -> 403', patternPendingAsMember.status === 403, patternPendingAsMember);

  const patternPendingAsAdmin = await get(`${CP}/v1/pattern-library?status=pending`, thanhToken);
  check(
    'Thanh (admin) xem hàng chờ duyệt -> 200, thấy đúng pattern vừa tạo',
    patternPendingAsAdmin.status === 200 && patternPendingAsAdmin.json.patterns.some((p) => p.id === patternGeneralize.json.pattern_id),
    patternPendingAsAdmin
  );

  const patternApproveSelf = await post(`${CP}/v1/pattern-library/${patternGeneralize.json.pattern_id}/approve`, {}, thanhToken);
  check(
    'Thanh tự duyệt pattern của chính mình -> 400 (người duyệt phải khác người tạo)',
    patternApproveSelf.status === 400 && patternApproveSelf.json.error === 'cannot_approve_own_pattern',
    patternApproveSelf
  );

  const patternApproveNotAdmin = await post(`${CP}/v1/pattern-library/${patternGeneralize.json.pattern_id}/approve`, {}, hoangToken);
  check('Hoàng (member) duyệt pattern -> 403', patternApproveNotAdmin.status === 403, patternApproveNotAdmin);

  // Hoàng không phải admin nên không tự approve được thật qua vai trò — nhưng test cần 1 admin
  // KHÁC người tạo để xác nhận nhánh hợp lệ; seed chỉ có đúng 1 admin (Thanh), nên xác nhận
  // đúng nhánh chặn (400/403) là đủ chứng minh gate hoạt động, không giả lập thêm admin thứ 2.
  const patternApproveNotFound = await post(`${CP}/v1/pattern-library/pat_khong_ton_tai/approve`, {}, thanhToken);
  check('duyệt pattern_id không tồn tại -> 404', patternApproveNotFound.status === 404, patternApproveNotFound);

  // --- MVP3 Đợt 5 — Seat Offboarding: chỉ test được đường guard qua API (permission/not-found)
  // — không có endpoint tạo seat mới (cố ý ngoài phạm vi đợt này), nên không tự tạo seat test
  // được trong chính test-harness mà không phá quy ước "chỉ gọi API, không đụng DB trực tiếp"
  // của file này. Đường enforcement thật đầu-cuối (registry.json thật đổi + DB đổi + audit_logs)
  // đã xác nhận THỦ CÔNG bằng 1 seat giả lập tạo tạm qua SQL trực tiếp trên droplet, xem
  // MVP3-PROGRESS.md — không phải bỏ sót, ghi rõ giới hạn thật của bộ test tự động này.
  const seatsAsMember = await get(`${CP}/v1/seats`, hoangToken);
  check('Hoàng (member) xem seats -> 403', seatsAsMember.status === 403, seatsAsMember);

  const seatsAsAdmin = await get(`${CP}/v1/seats`, thanhToken);
  check(
    'Thanh (admin) xem seats -> 200, thấy đúng 2 seat thật',
    seatsAsAdmin.status === 200 && seatsAsAdmin.json.seats.some((s) => s.id === 'seat_claude_thanh') && seatsAsAdmin.json.seats.some((s) => s.id === 'seat_claude_hoang'),
    seatsAsAdmin
  );

  const offboardAsMember = await post(`${CP}/v1/seats/seat_claude_thanh/offboard`, { reason: 'test' }, hoangToken);
  check('Hoàng (member) offboard seat -> 403', offboardAsMember.status === 403, offboardAsMember);

  const offboardMissingReason = await post(`${CP}/v1/seats/seat_khong_ton_tai/offboard`, {}, thanhToken);
  check('offboard thiếu reason -> 400', offboardMissingReason.status === 400, offboardMissingReason);

  const offboardNotFound = await post(`${CP}/v1/seats/seat_khong_ton_tai/offboard`, { reason: 'test' }, thanhToken);
  check('offboard seat không tồn tại -> 404', offboardNotFound.status === 404, offboardNotFound);

  console.log(`\n${passed} PASS / ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[test-harness] lỗi khi chạy:', err);
  process.exit(1);
});
