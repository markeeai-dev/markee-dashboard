'use strict';
const { readGlobalConfig, findGitRoot, readSessionJson } = require('../config');
const { ControlPlaneClient } = require('../api');
const git = require('../git');

// Checkpoint thủ công (Q24.5: "bấm checkpoint thủ công") — gắn vào Tool Session gần nhất
// đã ghi trong session.json. Ranh giới CHECKPOINT, không phải ranh giới Work/Tool Session.
async function run() {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập.');

  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) throw new Error('Không tìm thấy git repo.');

  const session = readSessionJson(gitRoot);
  if (!session || !session.tool_session_id) {
    throw new Error('Không có Tool Session nào — chạy `company-ai claude` trước.');
  }

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);
  const headNow = git.getHeadCommit(gitRoot);
  const filesChanged = git.getChangedFiles(session.started_head_commit, headNow, gitRoot);

  const result = await client.createCheckpoint(session.tool_session_id, {
    trigger: 'manual',
    completed: [],
    remaining: [],
    files_changed: filesChanged,
    git_commit: headNow,
    git_branch: git.getBranch(gitRoot),
  });

  console.log(`Đã tạo checkpoint thủ công: ${result.checkpoint_id} (${filesChanged.length} file thay đổi từ đầu Work Session).`);
}

module.exports = { run };
