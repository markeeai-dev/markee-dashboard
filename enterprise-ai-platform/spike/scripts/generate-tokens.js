'use strict';
// Sinh token nghiệp vụ giả lập cho Thanh và Hoàng — dùng cho MVP0-SPIKE.md,
// KHÔNG phải cơ chế login thật (đó là MVP1, qua Center AI Control Plane thật).
// Chạy: node generate-tokens.js  -> ghi ra tokens.json cùng thư mục

const fs = require('fs');
const path = require('path');
const { signToken } = require('../shared/token');

const SECRET = process.env.CENTERAI_TOKEN_SECRET || 'spike-dev-secret-change-me';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 giờ — khớp idle timeout Work Session (Q18)

function makeToken(overrides) {
  const expires_at = new Date(Date.now() + TTL_MS).toISOString();
  return signToken(
    {
      team_id: 'team_dev',
      project_id: 'tng',
      task_id: 'TNG-142',
      work_session_id: 'ws_' + Math.random().toString(36).slice(2, 8),
      tool_session_id: 'ts_' + Math.random().toString(36).slice(2, 8),
      allowed_models: ['claude-sonnet'],
      context_bundle_id: 'ctx_28',
      context_hash: 'sha256:mock-hash-for-spike',
      expires_at,
      ...overrides,
    },
    SECRET
  );
}

const tokens = {
  thanh: makeToken({
    employee_id: 'emp_thanh',
    seat_id: 'seat_claude_thanh',
    provider: 'anthropic',
    tool: 'claude_code',
  }),
  hoang: makeToken({
    employee_id: 'emp_hoang',
    seat_id: 'seat_claude_hoang',
    provider: 'anthropic',
    tool: 'claude_code',
  }),
  // Token cố tình sai — Hoàng đội lốt claim seat của Thanh — để test-harness
  // xác nhận Adapter chặn đúng invariant "seat_id phải thuộc employee_id" (Q9).
  hoang_claims_thanh_seat: makeToken({
    employee_id: 'emp_hoang',
    seat_id: 'seat_claude_thanh',
    provider: 'anthropic',
    tool: 'claude_code',
  }),
};

const outPath = path.join(__dirname, 'tokens.json');
fs.writeFileSync(outPath, JSON.stringify(tokens, null, 2));
console.log('Da ghi token vao', outPath);
console.log(Object.keys(tokens).map((k) => `  ${k}: ${tokens[k].slice(0, 24)}...`).join('\n'));
