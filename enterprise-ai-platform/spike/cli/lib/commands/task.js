'use strict';
// Hoàn thiện Task Management nội bộ — gap thật phát hiện: từ đầu dự án chưa từng có cách tạo
// task mới hay đổi trạng thái task qua sản phẩm (chỉ có task_tng142 seed tay), đây chính là lý
// do KPI Efficiency luôn hiện closed_task_count=0. Không tích hợp Jira/Linear (quyết định người
// dùng chốt) — hoàn thiện luồng nội bộ đã có sẵn (project/task/claim) cho công ty dùng ngay.
const { readGlobalConfig, findGitRoot, readProjectYaml } = require('../config');
const { ControlPlaneClient } = require('../api');
const { ask, askYesNo } = require('../prompt');

const TASK_STATUSES = ['open', 'in_progress', 'done', 'closed'];

async function pickAssignee(client, assigneeArg) {
  if (assigneeArg) return assigneeArg;
  const { employees } = await client.listEmployees();
  console.log('Chọn người phụ trách (Enter để bỏ trống):');
  employees.forEach((e, i) => console.log(`  ${i + 1}. [${e.id}] ${e.full_name}`));
  const answer = await ask('Số thứ tự');
  if (!answer) return undefined;
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || !employees[idx]) throw new Error('Lựa chọn không hợp lệ.');
  return employees[idx].id;
}

async function add(args) {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập — chạy `company-ai login` trước.');

  const gitRoot = findGitRoot(process.cwd());
  const projectYaml = gitRoot ? readProjectYaml(gitRoot) : null;
  const projectId = args['project-id'] || projectYaml?.project_id;
  if (!projectId) throw new Error('Không xác định được project_id — chạy trong repo đã `company-ai init`, hoặc truyền --project-id.');

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);

  const title = args.title || (await ask('Tiêu đề task'));
  if (!title) throw new Error('Tiêu đề không được để trống.');

  const assignee = args.yes ? args.assignee : await pickAssignee(client, args.assignee);

  const result = await client.createTask(projectId, { title, assignee_employee_id: assignee });
  console.log(`Đã tạo task: ${result.task_id} — "${title}"${assignee ? ` (giao cho ${assignee})` : ''}.`);
}

async function update(taskId, args) {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập — chạy `company-ai login` trước.');
  if (!taskId) throw new Error('Thiếu task_id — dùng: company-ai task update <task_id> [--status] [--assignee] [--title]');

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);

  const body = {};
  if (args.title) body.title = args.title;
  if (args.assignee) body.assignee_employee_id = args.assignee;
  if (args.status) {
    if (!TASK_STATUSES.includes(args.status)) {
      throw new Error(`--status không hợp lệ: ${args.status}. Hợp lệ: ${TASK_STATUSES.join(', ')}`);
    }
    body.status = args.status;
  }

  if (!Object.keys(body).length) {
    if (args.yes) throw new Error('Cần ít nhất 1 trong --status/--assignee/--title.');
    const newStatus = await ask(`Trạng thái mới (${TASK_STATUSES.join('/')}, Enter để bỏ qua)`);
    if (newStatus) {
      if (!TASK_STATUSES.includes(newStatus)) throw new Error(`--status không hợp lệ: ${newStatus}. Hợp lệ: ${TASK_STATUSES.join(', ')}`);
      body.status = newStatus;
    }
    if (!Object.keys(body).length) throw new Error('Không có gì để cập nhật.');
  }

  await client.updateTask(taskId, body);
  console.log(`Đã cập nhật task ${taskId}: ${JSON.stringify(body)}.`);
}

async function run(sub, args) {
  if (sub === 'add') return add(args);
  if (sub === 'update') return update(args['task-id-positional'], args);
  console.log('Dùng: company-ai task add [--project-id] [--title] [--assignee] [--yes]');
  console.log('  hoặc: company-ai task update <task_id> [--status] [--assignee] [--title] [--yes]');
}

module.exports = { run };
