'use strict';
const { readGlobalConfig, findGitRoot, readSessionJson } = require('../config');

async function run() {
  const globalConfig = readGlobalConfig();
  console.log(`Đăng nhập: ${globalConfig ? `${globalConfig.full_name} (${globalConfig.employee_id})` : 'CHƯA đăng nhập'}`);

  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) {
    console.log('Không ở trong git repo.');
    return;
  }

  const session = readSessionJson(gitRoot);
  if (!session) {
    console.log('Không có Work Session nào đang mở trong repo này.');
    return;
  }

  console.log(`Work Session: ${session.work_session_id} (task ${session.task_id}, project ${session.project_id})`);
  console.log(`Tool Session gần nhất: ${session.tool_session_id}`);
  console.log(`Seat: ${session.seat_id}`);
  console.log(`Git snapshot đầu phiên: ${session.started_head_commit} (branch ${session.branch})`);
}

module.exports = { run };
