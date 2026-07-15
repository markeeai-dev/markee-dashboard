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

  console.log('[seed] done: emp_thanh, emp_hoang, 2 seats, proj_trungnguyen, task_tng142');
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
