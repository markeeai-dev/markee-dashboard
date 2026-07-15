'use strict';
// Seat Runtime Registry (Q9, v16) — Control Plane sở hữu vòng đời thật (create/
// health check/suspend/revoke/destroy container), Gateway Adapter CHỈ ĐỌC để route.
// Ở spike: file JSON tĩnh, đọc lại mỗi request để test-harness có thể mô phỏng
// revoke/suspend giữa chừng bằng cách sửa file trực tiếp — không cần API quản trị riêng.

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'registry.json');

// seat_id -> { employee_id, endpoint, status }
function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw);
}

// Trả về entry nếu seat_id tồn tại VÀ đúng employee_id được gán, ngược lại null.
function resolveSeat(seatId, employeeId) {
  const registry = loadRegistry();
  const entry = registry[seatId];
  if (!entry) return null;
  if (entry.employee_id !== employeeId) return null; // seat không thuộc về employee này
  return entry;
}

module.exports = { loadRegistry, resolveSeat, REGISTRY_PATH };
