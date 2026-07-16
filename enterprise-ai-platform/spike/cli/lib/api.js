'use strict';

class ControlPlaneError extends Error {
  constructor(status, body) {
    super(body && body.error ? body.error : `http_${status}`);
    this.status = status;
    this.body = body;
  }
}

// 9Router (đứng sau Gateway Adapter, không trực tiếp ở đây, nhưng Control Plane có thể
// đi qua nginx cùng style) đôi khi nối thêm "data: [DONE]" sau JSON — phát hiện thật ở
// Bước 1 (spike/control-plane/README.md). Control Plane tự viết KHÔNG có vấn đề này (JSON
// thuần), nhưng dùng chung 1 hàm parse phòng thủ cho mọi lời gọi HTTP trong CLI là rẻ và an toàn.
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text.split('data: [DONE]')[0].trim());
  } catch {
    return {};
  }
}

class ControlPlaneClient {
  constructor(baseUrl, employeeToken) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.employeeToken = employeeToken;
  }

  async _req(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.employeeToken ? { Authorization: `Bearer ${this.employeeToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await safeJson(res);
    if (res.status >= 400) throw new ControlPlaneError(res.status, json);
    return json;
  }

  login(email, accessCode) {
    return this._req('POST', '/v1/auth/login', { email, access_code: accessCode });
  }
  listProjects() {
    return this._req('GET', '/v1/projects');
  }
  listTasks(projectId) {
    return this._req('GET', `/v1/projects/${encodeURIComponent(projectId)}/tasks`);
  }
  createWorkSession(taskId) {
    return this._req('POST', '/v1/work-sessions', { task_id: taskId });
  }
  endWorkSession(id) {
    return this._req('POST', `/v1/work-sessions/${encodeURIComponent(id)}/end`);
  }
  createToolSession(workSessionId, { tool, machineId }) {
    return this._req('POST', `/v1/work-sessions/${encodeURIComponent(workSessionId)}/tool-sessions`, {
      tool,
      machine_id: machineId,
    });
  }
  listWorkSessionCheckpoints(workSessionId) {
    return this._req('GET', `/v1/work-sessions/${encodeURIComponent(workSessionId)}/checkpoints`);
  }
  createCheckpoint(toolSessionId, body) {
    return this._req('POST', `/v1/tool-sessions/${encodeURIComponent(toolSessionId)}/checkpoints`, body);
  }
  endToolSession(id) {
    return this._req('POST', `/v1/tool-sessions/${encodeURIComponent(id)}/end`);
  }
  createHandoff(body) {
    return this._req('POST', '/v1/handoffs', body);
  }
  getLatestHandoff(taskId) {
    return this._req('GET', `/v1/handoffs/${encodeURIComponent(taskId)}`);
  }
  contextRender(taskId) {
    return this._req('GET', `/v1/context/render?task_id=${encodeURIComponent(taskId)}`);
  }
  draftHandoff(workSessionId, { gitLog, gitDiffStat }) {
    return this._req('POST', `/v1/work-sessions/${encodeURIComponent(workSessionId)}/draft-handoff`, {
      git_log: gitLog,
      git_diff_stat: gitDiffStat,
    });
  }
  claimTask(taskId) {
    return this._req('POST', `/v1/tasks/${encodeURIComponent(taskId)}/claim`);
  }
  getTaskClaim(taskId) {
    return this._req('GET', `/v1/tasks/${encodeURIComponent(taskId)}/claim`);
  }
  overlapCheck(taskId) {
    return this._req('GET', `/v1/tasks/${encodeURIComponent(taskId)}/overlap-check`);
  }
  ingestContext(body) {
    return this._req('POST', '/v1/context/ingest', body);
  }
  listEmployees() {
    return this._req('GET', '/v1/employees');
  }
  createTask(projectId, body) {
    return this._req('POST', `/v1/projects/${encodeURIComponent(projectId)}/tasks`, body);
  }
  updateTask(taskId, body) {
    return this._req('POST', `/v1/tasks/${encodeURIComponent(taskId)}/update`, body);
  }
}

module.exports = { ControlPlaneClient, ControlPlaneError };
