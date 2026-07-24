-- Center AI Control Plane — schema MVP1 tối giản (đúng checklist đã chốt ở TEAM-SPLIT.md:
-- employees, projects, tasks, work_sessions, tool_sessions, checkpoints, project_context,
-- handoffs, seats, seat_runtime_registry — KHÔNG thêm bảng nào ngoài danh sách này ở MVP1).
--
-- Cắt gọn có chủ đích so với mục 11 tài liệu chính (ghi rõ để không ai đọc nhầm là quên):
--   - employees: bỏ department_id/manager_id/sso_subject (chưa cần ở pilot vài người, MVP2 mới cần org chart)
--   - seats: bỏ seat_events/seat_assignments/seat_department_link/... (lịch sử đầy đủ là MVP2 — Q1
--     state machine vẫn giữ nguyên ý nghĩa, chỉ chưa cần bảng lịch sử riêng)
--   - checkpoints: gộp git snapshot (git_commit/git_branch) thẳng vào bảng thay vì bảng git_links
--     riêng — đủ cho demo POC mục 15, KHÔNG đủ cho multi-repo/PR-linking (đó là lý do git_links
--     tồn tại ở schema đầy đủ, để MVP2 khi cần)
--   - seat_runtime_registry ở đây KHÔNG có cột endpoint/api_key — đó vẫn là registry.json trên
--     droplet mà Gateway Adapter đọc trực tiếp (KHÔNG đổi ở MVP1, xem TEAM-SPLIT.md Track B).
--     Bảng này chỉ phục vụ Control Plane xác thực seat_id<->employee_id trước khi mint token.

CREATE TABLE employees (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seats (
  id          TEXT PRIMARY KEY,             -- = seat_id, vd 'seat_claude_thanh' (khớp registry.json)
  provider    TEXT NOT NULL,                -- 'anthropic' | 'openai' ...
  pool_type   TEXT NOT NULL DEFAULT 'personal_assigned'
                CHECK (pool_type = 'personal_assigned'), -- MVP1 chỉ hỗ trợ loại này (Q24.9), khoá cứng
  status      TEXT NOT NULL DEFAULT 'assigned'
                CHECK (status IN ('purchased', 'assigned', 'active', 'suspended', 'pending_revoke', 'revoked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seat_runtime_registry (
  seat_id      TEXT PRIMARY KEY REFERENCES seats(id),
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  status       TEXT NOT NULL DEFAULT 'healthy'
                 CHECK (status IN ('healthy', 'unhealthy', 'suspended', 'destroyed')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id),
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'closed')),
  assignee_employee_id  TEXT REFERENCES employees(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ
);

-- Q18 — Session Federation (bản tối giản MVP1, vẫn giữ đúng 4 lớp: Work/Tool/Checkpoint/Request Span,
-- Request Span do Gateway Adapter sở hữu — không có bảng ở đây, xem spike/logs/request-spans.jsonl).
CREATE TABLE work_sessions (
  id          TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  seat_id     TEXT REFERENCES seats(id),
  project_id  TEXT NOT NULL REFERENCES projects(id),
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE TABLE tool_sessions (
  id                TEXT PRIMARY KEY,
  work_session_id   TEXT NOT NULL REFERENCES work_sessions(id),
  tool              TEXT NOT NULL CHECK (tool IN ('claude_code', 'codex', 'other')),
  machine_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ
);

-- /compact tạo checkpoint mới trong CÙNG tool_session đang mở, KHÔNG tạo tool_session mới (Q24.5) —
-- Control Plane không tự biết CLI gọi /compact hay git commit, chỉ ghi đúng `trigger` CLI gửi lên.
CREATE TABLE checkpoints (
  id                TEXT PRIMARY KEY,
  tool_session_id   TEXT NOT NULL REFERENCES tool_sessions(id),
  trigger           TEXT NOT NULL CHECK (trigger IN ('git_commit', 'pre_compact', 'post_compact', 'tool_close', 'manual')),
  completed         JSONB NOT NULL DEFAULT '[]',
  remaining         JSONB NOT NULL DEFAULT '[]',
  files_changed     JSONB NOT NULL DEFAULT '[]',
  git_commit        TEXT,
  git_branch        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_context (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  task_id     TEXT REFERENCES tasks(id),
  type        TEXT NOT NULL CHECK (type IN
                ('requirement', 'decision', 'ba_feedback', 'status', 'known_issue', 'next_step', 'handoff', 'code_context')),
  content     TEXT NOT NULL,
  created_by  TEXT NOT NULL REFERENCES employees(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE handoffs (
  id                 TEXT PRIMARY KEY,
  task_id            TEXT NOT NULL REFERENCES tasks(id),
  from_employee_id   TEXT NOT NULL REFERENCES employees(id),
  to_employee_id     TEXT REFERENCES employees(id),
  work_session_id    TEXT NOT NULL REFERENCES work_sessions(id),
  summary            TEXT NOT NULL,
  open_issues        JSONB NOT NULL DEFAULT '[]',
  next_steps         JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_sessions_lookup ON work_sessions (employee_id, task_id, status);
CREATE INDEX idx_tool_sessions_ws ON tool_sessions (work_session_id);
CREATE INDEX idx_checkpoints_ts ON checkpoints (tool_session_id);
CREATE INDEX idx_handoffs_task ON handoffs (task_id, created_at DESC);
CREATE INDEX idx_tasks_project ON tasks (project_id);
