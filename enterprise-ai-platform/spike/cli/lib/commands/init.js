'use strict';
const { findGitRoot, readProjectYaml, writeProjectYaml } = require('../config');
const { ensureClaudeMdMarker } = require('../render');
const { installPostCommitHook } = require('../githook');
const { ask, askYesNo } = require('../prompt');

async function run(args) {
  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) throw new Error('Không tìm thấy git repo (chạy trong 1 repo đã git init).');

  const autoYes = args.yes === true;
  const existing = readProjectYaml(gitRoot);
  if (existing && !(autoYes || (await askYesNo(`.center-ai/project.yaml đã tồn tại (project_id=${existing.project_id}). Ghi đè?`, false)))) {
    console.log('Giữ nguyên project.yaml hiện tại.');
  } else {
    const project_id =
      args['project-id'] || (await ask('project_id (PHẢI khớp đúng id project trên Control Plane, vd proj_trungnguyen)'));
    const organization_id = args['organization-id'] || (await ask('organization_id', 'company'));
    const team_id = args['team-id'] || (await ask('team_id', 'dev'));
    const repository_id = args['repository-id'] || (await ask('repository_id', require('path').basename(gitRoot)));
    writeProjectYaml(gitRoot, { organization_id, team_id, project_id, repository_id });
    console.log(`Đã ghi .center-ai/project.yaml (project_id=${project_id}).`);
  }

  const wantMarker = autoYes || (await askYesNo('Thêm marker Center AI context vào CLAUDE.md? (chỉ 1 lần cho repo này)', true));
  if (wantMarker) {
    const { changed } = ensureClaudeMdMarker(gitRoot);
    console.log(changed ? 'Đã thêm marker vào CLAUDE.md.' : 'CLAUDE.md đã có marker từ trước, không đổi gì.');
  }

  const wantHook = autoYes || (await askYesNo('Cài git hook tự động checkpoint mỗi lần commit?', true));
  if (wantHook) {
    const hookResult = installPostCommitHook(gitRoot);
    const messages = {
      installed: 'Đã cài git hook post-commit — mỗi lần commit sẽ tự tạo checkpoint (khi có Tool Session đang mở).',
      already_installed: 'Git hook post-commit đã cài từ trước, không đổi gì.',
      skipped_foreign_hook:
        'CẢNH BÁO: đã có hook post-commit khác không phải của Center AI — KHÔNG ghi đè. Tự thêm dòng `company-ai checkpoint --trigger git_commit --quiet` vào hook hiện có nếu muốn.',
      no_hooks_dir: 'Không tìm thấy .git/hooks — bỏ qua cài hook.',
    };
    console.log(messages[hookResult]);
  }
}

module.exports = { run };
