'use strict';
// Seed dữ liệu pilot tối thiểu — khớp đúng seat_id/employee_id đã dùng thật ở MVP0
// (registry.json trên droplet: seat_claude_thanh -> emp_thanh, seat_claude_hoang -> emp_hoang).
// Idempotent — chạy lại nhiều lần không lỗi (ON CONFLICT DO NOTHING/UPDATE).

const { query, pool } = require('./db');

async function seed() {
  await query(
    `INSERT INTO employees (id, email, full_name, status) VALUES
       ('emp_thanh', 'thanh@company.local', 'Thanh', 'active'),
       ('emp_hoang', 'hoang@company.local', 'Hoang', 'active')
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO seats (id, provider, pool_type, status) VALUES
       ('seat_claude_thanh', 'anthropic', 'personal_assigned', 'active'),
       ('seat_claude_hoang', 'anthropic', 'personal_assigned', 'active')
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO seat_runtime_registry (seat_id, employee_id, status) VALUES
       ('seat_claude_thanh', 'emp_thanh', 'healthy'),
       ('seat_claude_hoang', 'emp_hoang', 'healthy')
     ON CONFLICT (seat_id) DO UPDATE SET employee_id = EXCLUDED.employee_id, status = EXCLUDED.status, updated_at = now()`
  );

  await query(
    `INSERT INTO projects (id, name, status) VALUES ('proj_trungnguyen', 'Trung Nguyen', 'active')
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO tasks (id, project_id, title, status) VALUES
       ('task_tng142', 'proj_trungnguyen', 'TNG-142 - Facebook Comment Collector', 'open')
     ON CONFLICT (id) DO NOTHING`
  );

  // MVP3 tiếp theo (Q15) — dữ liệu mẫu để test Context Confidence + ADR. Ghi chú thật: TOÀN
  // BỘ sản phẩm từ trước tới giờ CHƯA có endpoint tạo mới project_context (`/v1/context/ingest`
  // theo mục 12 tài liệu chính chưa xây ở bất kỳ MVP nào) — đây là seed test-only, không phải
  // giả vờ có luồng nhập liệu thật. Ghi rõ trong MVP3-PROGRESS.md là việc còn thiếu thật.
  await query(
    `INSERT INTO project_context (id, project_id, task_id, type, content, created_by, approved_by, valid_from) VALUES
       ('ctx_decision_1', 'proj_trungnguyen', 'task_tng142', 'decision',
        'Chon dung retry voi backoff thay vi queue rieng cho viec goi API Facebook',
        'emp_thanh', 'emp_thanh', now()),
       ('ctx_status_1', 'proj_trungnguyen', 'task_tng142', 'status',
        'Da hoan thanh phan fetch comment co ban, dang lam pagination',
        'emp_thanh', NULL, now() - interval '20 days')
     ON CONFLICT (id) DO NOTHING`
  );

  console.log('[seed] done: emp_thanh, emp_hoang, 2 seats, proj_trungnguyen, task_tng142, 2 project_context (Q15 test data)');
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
