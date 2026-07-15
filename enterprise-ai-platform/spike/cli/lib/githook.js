'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = '# center-ai-post-commit-checkpoint';
const HOOK_BODY = [
  '#!/bin/sh',
  MARKER,
  '# Cài bởi `company-ai init` — tạo Checkpoint tự động tại MỖI git commit (mục 15 POC spec).',
  '# Không bao giờ được chặn/làm lỗi commit thật — luôn thoát 0, im lặng nếu không có gì để làm.',
  'company-ai checkpoint --trigger git_commit --quiet >/dev/null 2>&1',
  'exit 0',
  '',
].join('\n');

// Trả về: 'installed' | 'already_installed' | 'skipped_foreign_hook'
function installPostCommitHook(gitRoot) {
  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) return 'no_hooks_dir'; // repo lạ, không có .git/hooks chuẩn — không đoán mò

  const hookFile = path.join(hooksDir, 'post-commit');
  if (fs.existsSync(hookFile)) {
    const existing = fs.readFileSync(hookFile, 'utf8');
    if (existing.includes(MARKER)) return 'already_installed';
    return 'skipped_foreign_hook'; // đã có hook khác của dev — KHÔNG ghi đè, tránh phá việc đang có
  }

  fs.writeFileSync(hookFile, HOOK_BODY);
  try {
    fs.chmodSync(hookFile, 0o755);
  } catch {
    // Windows: chmod thường no-op — Git for Windows vẫn chạy được hook có shebang #!/bin/sh
  }
  return 'installed';
}

module.exports = { installPostCommitHook };
