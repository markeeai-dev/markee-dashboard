'use strict';
const { execSync } = require('child_process');

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch {
    return '';
  }
}

function getBranch(cwd) {
  return run('git rev-parse --abbrev-ref HEAD', cwd);
}
function getHeadCommit(cwd) {
  return run('git rev-parse HEAD', cwd);
}
function getShortLog(fromRef, toRef, cwd) {
  if (!fromRef) return '';
  return run(`git log --oneline ${fromRef}..${toRef || 'HEAD'}`, cwd);
}
function getDiffStat(fromRef, toRef, cwd) {
  if (!fromRef) return '';
  return run(`git diff --stat ${fromRef}..${toRef || 'HEAD'}`, cwd);
}
function getChangedFiles(fromRef, toRef, cwd) {
  if (!fromRef) return [];
  const out = run(`git diff --name-only ${fromRef}..${toRef || 'HEAD'}`, cwd);
  return out ? out.split('\n').filter(Boolean) : [];
}

module.exports = { getBranch, getHeadCommit, getShortLog, getDiffStat, getChangedFiles };
