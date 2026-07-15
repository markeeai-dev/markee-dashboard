'use strict';
const { readGlobalConfig, findGitRoot, readSessionJson, clearSessionJson } = require('../config');
const { ControlPlaneClient } = require('../api');
const git = require('../git');
const { ask, askYesNo } = require('../prompt');

// MVP1 = handoff dựa trên Git snapshot tự động (mục 14) — KHÔNG gọi LLM để soạn handoff,
// đó là MVP2 ("handoff tự động sinh bằng LLM", mục 14). Bản tối giản này tổng hợp thẳng
// từ checkpoints + git diff, có review trước khi publish.
function buildDraft({ checkpoints, gitLog, gitDiffStat, filesChanged }) {
  const completed = [];
  const remaining = [];
  const filesFromCheckpoints = new Set();

  for (const cp of checkpoints) {
    for (const c of cp.completed || []) completed.push(c);
    for (const f of cp.files_changed || []) filesFromCheckpoints.add(f);
  }
  // remaining lấy theo checkpoint GẦN NHẤT (hiểu biết mới nhất), không cộng dồn lịch sử.
  const last = checkpoints[checkpoints.length - 1];
  if (last) for (const r of last.remaining || []) remaining.push(r);

  const allFiles = new Set([...filesFromCheckpoints, ...filesChanged]);

  const summaryLines = [];
  if (completed.length) summaryLines.push(...completed.map((c) => `- ${c}`));
  if (gitLog) summaryLines.push('', 'Commit trong phiên:', gitLog);
  const summary = summaryLines.join('\n') || '(không có ghi chú completed nào từ checkpoint — chỉ có git snapshot)';

  return {
    summary,
    next_steps: remaining,
    files_changed: [...allFiles],
    diff_stat: gitDiffStat,
  };
}

async function run(args = {}) {
  const globalConfig = readGlobalConfig();
  if (!globalConfig) throw new Error('Chưa đăng nhập.');

  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) throw new Error('Không tìm thấy git repo.');

  const session = readSessionJson(gitRoot);
  if (!session || !session.work_session_id) {
    throw new Error('Không có Work Session nào đang mở — chạy `company-ai claude` trước.');
  }

  const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);

  const { checkpoints } = await client.listWorkSessionCheckpoints(session.work_session_id);
  const headNow = git.getHeadCommit(gitRoot);
  const gitLog = git.getShortLog(session.started_head_commit, headNow, gitRoot);
  const gitDiffStat = git.getDiffStat(session.started_head_commit, headNow, gitRoot);
  const filesChanged = git.getChangedFiles(session.started_head_commit, headNow, gitRoot);

  const draft = buildDraft({ checkpoints, gitLog, gitDiffStat, filesChanged });

  console.log('\n--- Handoff draft ---');
  console.log(draft.summary);
  console.log('\nBước tiếp theo:', draft.next_steps.length ? draft.next_steps.join(', ') : '(không có)');
  console.log('File thay đổi:', draft.files_changed.length ? draft.files_changed.join(', ') : '(không có)');
  console.log('---------------------\n');

  // --yes: bỏ qua prompt, dùng cho automation/test — người dùng thật ở TTY vẫn được hỏi
  // đầy đủ như bình thường. Tách theo flag thay vì đoán "có phải chạy trong pipe không",
  // vì đoán sai sẽ nguy hiểm hơn (im lặng bỏ qua xác nhận publish handoff của người dùng thật).
  const autoYes = args.yes === true;
  const confirmed = autoYes || (await askYesNo('Publish handoff này và đóng Work Session?', true));
  if (!confirmed) {
    console.log('Đã huỷ — Work Session vẫn giữ nguyên trạng thái active, chạy `company-ai end` lại khi sẵn sàng.');
    return;
  }

  const openIssuesRaw =
    args['open-issues'] !== undefined
      ? String(args['open-issues'])
      : autoYes
      ? ''
      : await ask('Vấn đề mở / BA feedback chưa xử lý (cách nhau bằng dấu ";", Enter để bỏ trống)', '');
  const openIssues = openIssuesRaw ? openIssuesRaw.split(';').map((s) => s.trim()).filter(Boolean) : [];

  await client.createHandoff({
    task_id: session.task_id,
    work_session_id: session.work_session_id,
    summary: draft.summary,
    open_issues: openIssues,
    next_steps: draft.next_steps,
  });
  await client.endWorkSession(session.work_session_id);
  clearSessionJson(gitRoot);

  console.log('Đã publish handoff và đóng Work Session. Người tiếp theo chạy `company-ai claude` sẽ thấy đúng bàn giao này.');
}

module.exports = { run };
