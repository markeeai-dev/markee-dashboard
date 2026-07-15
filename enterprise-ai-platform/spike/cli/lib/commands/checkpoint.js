'use strict';
const { readGlobalConfig, findGitRoot, readSessionJson } = require('../config');
const { ControlPlaneClient } = require('../api');
const git = require('../git');

// Checkpoint (Q24.5): 2 nguồn gọi lệnh này —
//   1) Thủ công: `company-ai checkpoint` — người dùng tự bấm giữa chừng.
//   2) Tự động: git hook `post-commit` (cài bởi `company-ai init`) gọi
//      `company-ai checkpoint --trigger git_commit --quiet` sau MỖI lần commit — đúng
//      ranh giới "Checkpoint tại mỗi git commit" (mục 15 POC spec) mà trước đây CLI chỉ
//      checkpoint lúc đóng tool, không theo từng commit.
// --quiet: bắt buộc cho hook — KHÔNG được làm lỗi/ồn `git commit` của người dùng nếu lúc
// đó không có Tool Session nào đang mở (vd họ tự commit tay ngoài Claude Code) — bỏ qua êm.
async function run(args = {}) {
  const quiet = args.quiet === true;
  const fail = (msg) => {
    if (quiet) return;
    throw new Error(msg);
  };

  const globalConfig = readGlobalConfig();
  if (!globalConfig) return fail('Chưa đăng nhập.');

  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) return fail('Không tìm thấy git repo.');

  const session = readSessionJson(gitRoot);
  if (!session || !session.tool_session_id) {
    return fail('Không có Tool Session nào — chạy `company-ai claude` trước.');
  }

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);
  const headNow = git.getHeadCommit(gitRoot);
  const filesChanged = git.getChangedFiles(session.started_head_commit, headNow, gitRoot);
  const trigger = ['git_commit', 'pre_compact', 'post_compact', 'tool_close', 'manual'].includes(args.trigger)
    ? args.trigger
    : 'manual';

  let result;
  try {
    result = await client.createCheckpoint(session.tool_session_id, {
      trigger,
      completed: [],
      remaining: [],
      files_changed: filesChanged,
      git_commit: headNow,
      git_branch: git.getBranch(gitRoot),
    });
  } catch (err) {
    // Hook không bao giờ được làm gián đoạn git commit vì lỗi mạng/Control Plane tạm thời.
    if (quiet) return;
    throw err;
  }

  if (!quiet) {
    console.log(`Đã tạo checkpoint (${trigger}): ${result.checkpoint_id} (${filesChanged.length} file thay đổi từ đầu Work Session).`);
  }
}

module.exports = { run };
