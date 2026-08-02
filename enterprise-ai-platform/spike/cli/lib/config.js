'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Config toàn máy (không thuộc riêng repo nào) — email/employee_token/control_plane_url.
// KHÁC với .center-ai/ trong từng repo (project.yaml/session.json/generated/).
const GLOBAL_DIR = path.join(os.homedir(), '.center-ai');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_DIR, 'credentials.json');

function readGlobalConfig() {
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeGlobalConfig(data) {
  fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

function findGitRoot(startDir) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd: startDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
  } catch {
    return null;
  }
}

function centerAiDir(gitRoot) {
  return path.join(gitRoot, '.center-ai');
}

// .center-ai/project.yaml chỉ là key: value phẳng (Q24.4) — parser tối giản, không kéo
// thêm dependency yaml chỉ vì vài dòng flat key-value.
function readProjectYaml(gitRoot) {
  const file = path.join(centerAiDir(gitRoot), 'project.yaml');
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function writeProjectYaml(gitRoot, data) {
  fs.mkdirSync(centerAiDir(gitRoot), { recursive: true });
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  fs.writeFileSync(path.join(centerAiDir(gitRoot), 'project.yaml'), lines.join('\n') + '\n');
}

function readSessionJson(gitRoot) {
  const file = path.join(centerAiDir(gitRoot), 'session.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeSessionJson(gitRoot, data) {
  fs.mkdirSync(centerAiDir(gitRoot), { recursive: true });
  fs.writeFileSync(path.join(centerAiDir(gitRoot), 'session.json'), JSON.stringify(data, null, 2) + '\n');
}

function clearSessionJson(gitRoot) {
  const file = path.join(centerAiDir(gitRoot), 'session.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = {
  GLOBAL_DIR,
  readGlobalConfig,
  writeGlobalConfig,
  findGitRoot,
  centerAiDir,
  readProjectYaml,
  writeProjectYaml,
  readSessionJson,
  writeSessionJson,
  clearSessionJson,
};
