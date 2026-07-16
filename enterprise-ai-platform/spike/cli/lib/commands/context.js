'use strict';
// Vá gap thật phát hiện ở MVP3 Đợt 2: project_context chưa từng có đường tạo mới qua CLI —
// Confidence/ADR (Q15) đúng nhưng chỉ chạy được trên dữ liệu seed cho tới khi có lệnh này.
const { readGlobalConfig, findGitRoot, readProjectYaml } = require('../config');
const { ControlPlaneClient } = require('../api');
const { ask, askYesNo } = require('../prompt');

// Đúng 8 giá trị CHECK constraint của project_context.type ở Control Plane — không tự thêm
// loại mới ở đây, phải khớp chính xác với schema.
const CONTEXT_TYPES = ['requirement', 'decision', 'ba_feedback', 'status', 'known_issue', 'next_step', 'handoff', 'code_context'];

async function pickType(typeArg) {
  if (typeArg) {
    if (!CONTEXT_TYPES.includes(typeArg)) throw new Error(`type không hợp lệ: ${typeArg}. Hợp lệ: ${CONTEXT_TYPES.join(', ')}`);
    return typeArg;
  }
  console.log('Chọn loại ghi chú:');
  CONTEXT_TYPES.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  const answer = await ask('Số thứ tự');
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || !CONTEXT_TYPES[idx]) throw new Error('Lựa chọn không hợp lệ.');
  return CONTEXT_TYPES[idx];
}

async function add(args) {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập — chạy `company-ai login` trước.');

  const gitRoot = findGitRoot(process.cwd());
  const projectYaml = gitRoot ? readProjectYaml(gitRoot) : null;
  const projectId = args['project-id'] || projectYaml?.project_id;
  if (!projectId) throw new Error('Không xác định được project_id — chạy trong repo đã `company-ai init`, hoặc truyền --project-id.');

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);

  const taskId = args['task-id'] || (args.yes ? undefined : (await ask('task_id (Enter để bỏ trống — ghi chú ở tầng project)')) || undefined);
  const type = await pickType(args.type);
  const content = args.content || (await ask('Nội dung'));
  if (!content) throw new Error('Nội dung không được để trống.');

  const approved = args.approved === true || (args.yes ? false : await askYesNo('Đánh dấu đã duyệt luôn? (hệ thống chưa có Approval workflow thật, đây là tự khai)', false));

  const result = await client.ingestContext({
    project_id: projectId,
    task_id: taskId,
    type,
    content,
    approved_by: approved,
  });

  console.log(`Đã tạo context: ${result.context_id} (${type}${approved ? ', đã tự đánh dấu duyệt' : ''}).`);
}

async function run(sub, args) {
  if (sub !== 'add') {
    console.log('Dùng: company-ai context add [--project-id] [--task-id] [--type] [--content] [--approved] [--yes]');
    return;
  }
  await add(args);
}

module.exports = { run };
