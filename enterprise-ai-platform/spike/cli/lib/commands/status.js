'use strict';
const { readGlobalConfig, findGitRoot, readSessionJson } = require('../config');
const { ControlPlaneClient } = require('../api');

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

  if (globalConfig) {
    try {
      const client = new ControlPlaneClient(globalConfig.control_plane_url, globalConfig.employee_token);
      const [claim, overlap] = await Promise.all([
        client.getTaskClaim(session.task_id),
        client.overlapCheck(session.task_id),
      ]);
      console.log(
        claim.claimed_by_employee_id
          ? `Claim: ${claim.claimed_by_name} đang giữ (lease đến ${new Date(claim.lease_until).toLocaleString('vi-VN')})`
          : 'Claim: chưa ai giữ'
      );
      if (overlap.overlaps.length) {
        console.log('⚠ Va chạm file:');
        for (const o of overlap.overlaps) console.log(`  - ${o.file}: ${o.employees.map((e) => e.full_name).join(', ')}`);
      }
    } catch {
      // status không nên lỗi vì Control Plane tạm không tới được — chỉ bỏ qua phần online
    }
  }
}

module.exports = { run };
