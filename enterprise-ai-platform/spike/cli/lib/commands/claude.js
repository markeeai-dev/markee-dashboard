'use strict';
const os = require('os');
// cross-spawn thay vì child_process.spawn thẳng — spawn thẳng .cmd shim của npm trên Windows
// bị EINVAL (không shell) hoặc bị vỡ quoting (shell:true + args mảng, phát hiện thật khi
// test: '-A' của 1 lệnh git bị hiểu sai). cross-spawn xử lý đúng việc này trên cả 2 nền tảng,
// đây là lý do hợp lý để thêm 1 dependency nhỏ, không phải phá nguyên tắc "không framework".
const spawn = require('cross-spawn');
const {
  readGlobalConfig,
  findGitRoot,
  readProjectYaml,
  readSessionJson,
  writeSessionJson,
} = require('../config');
const { ControlPlaneClient } = require('../api');
const git = require('../git');
const render = require('../render');
const { ask } = require('../prompt');

// Phát hiện thật ở Bước 0 (MVP0-SPIKE.md): Claude Code CLI mặc định gửi alias model rút
// gọn mà 9Router không hiểu (404) — company-ai BẮT BUỘC tự truyền đúng id 9Router.
const DEFAULT_MODEL = 'cc/claude-sonnet-5';

async function pickTask(client, projectId, taskArg) {
  const { tasks } = await client.listTasks(projectId);
  if (!tasks.length) throw new Error(`Project ${projectId} chưa có task nào trên Control Plane.`);

  if (taskArg) {
    const found = tasks.find((t) => t.id === taskArg);
    if (!found) throw new Error(`Không tìm thấy task_id=${taskArg} trong project ${projectId}.`);
    return found;
  }

  if (tasks.length === 1) return tasks[0];

  console.log('Chọn task:');
  tasks.forEach((t, i) => console.log(`  ${i + 1}. [${t.id}] ${t.title} (${t.status})`));
  const answer = await ask('Số thứ tự task');
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || !tasks[idx]) throw new Error('Lựa chọn không hợp lệ.');
  return tasks[idx];
}

async function run(args, tool) {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập — chạy `company-ai login` trước.');

  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) throw new Error('Không tìm thấy git repo.');

  const projectYaml = readProjectYaml(gitRoot);
  if (!projectYaml || !projectYaml.project_id) {
    throw new Error('Chưa có .center-ai/project.yaml — chạy `company-ai init` trước.');
  }

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);

  const task = await pickTask(client, projectYaml.project_id, args.task);
  console.log(`\nProject: ${projectYaml.project_id}\nTask: [${task.id}] ${task.title}\n`);

  const wsResult = await client.createWorkSession(task.id);
  console.log(
    wsResult.resumed
      ? `Tiếp tục Work Session ${wsResult.work_session_id} (chưa quá 6h không hoạt động).`
      : `Tạo Work Session mới: ${wsResult.work_session_id}`
  );

  // Context bundle -> .center-ai/generated/ (Q24.6) — không đụng gì ngoài thư mục này.
  const contextData = await client.contextRender(task.id);
  render.renderTaskMd(gitRoot, { task: contextData.task, project: { name: contextData.task.project_name } });
  render.renderCheckpointMd(gitRoot, { latestHandoff: contextData.latest_handoff, contextNotes: contextData.context_notes });
  render.writePlaceholder(gitRoot, 'company.md', 'Chưa có nội dung company-level ở MVP1 pilot');
  render.writePlaceholder(gitRoot, 'team.md', 'Chưa có nội dung team-level ở MVP1 pilot');
  render.writePlaceholder(gitRoot, 'project.md', 'Chưa có nội dung project-level riêng ở MVP1 pilot — xem task.md');
  console.log('Đã ghi context vào .center-ai/generated/.');

  // Git snapshot — nguồn liên kết chính (Q24.8), không dựa trailer.
  const existingSession = readSessionJson(gitRoot);
  const startedHeadCommit =
    existingSession && existingSession.work_session_id === wsResult.work_session_id
      ? existingSession.started_head_commit
      : git.getHeadCommit(gitRoot);
  const branch = git.getBranch(gitRoot);

  const tsResult = await client.createToolSession(wsResult.work_session_id, { tool, machineId: os.hostname() });
  console.log(`Tool Session mới: ${tsResult.tool_session_id}\n`);

  writeSessionJson(gitRoot, {
    work_session_id: wsResult.work_session_id,
    tool_session_id: tsResult.tool_session_id,
    task_id: task.id,
    project_id: projectYaml.project_id,
    seat_id: wsResult.seat_id,
    started_head_commit: startedHeadCommit,
    branch,
  });

  const model = args.model ? (args.model.startsWith('cc/') ? args.model : `cc/${args.model}`) : DEFAULT_MODEL;
  const binName = tool === 'codex' ? 'codex' : 'claude';

  const child = spawn(binName, ['--model', model, ...(args._extra || [])], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: tsResult.gateway_base_url,
      ANTHROPIC_AUTH_TOKEN: tsResult.gateway_token,
      // CENTER_AI_* chỉ để log/debug cục bộ — Adapter KHÔNG đọc các biến này để xác định
      // identity, chỉ tin claim đã ký trong ANTHROPIC_AUTH_TOKEN (security contract Q24.2).
      CENTER_AI_EMPLOYEE_ID: globalConfig.employee_id,
      CENTER_AI_PROJECT_ID: projectYaml.project_id,
      CENTER_AI_TASK_ID: task.id,
      CENTER_AI_WORK_SESSION_ID: wsResult.work_session_id,
    },
  });

  await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
  });

  // Tool thoát: đóng Tool Session, checkpoint tự động — Work Session VẪN active,
  // KHÔNG tạo handoff (chỉ `company-ai end` mới làm việc đó — Q24.2/24.5).
  const headAfter = git.getHeadCommit(gitRoot);
  const filesChanged = git.getChangedFiles(startedHeadCommit, headAfter, gitRoot);

  await client.createCheckpoint(tsResult.tool_session_id, {
    trigger: 'tool_close',
    completed: [],
    remaining: [],
    files_changed: filesChanged,
    git_commit: headAfter,
    git_branch: git.getBranch(gitRoot),
  });
  await client.endToolSession(tsResult.tool_session_id);

  console.log('\nTool Session đã đóng (checkpoint tự động đã ghi). Work Session vẫn active.');
  console.log('Chạy `company-ai end` khi đã xong hẳn việc để tạo handoff cho người tiếp theo.');
}

module.exports = { run };
