#!/usr/bin/env node
'use strict';

// company-ai — CLI wrapper mỏng (Track A, Q24.2). KHÔNG thay thế Claude Code/Codex,
// chỉ quản: identity, project/task, Work/Tool Session, context, Git snapshot, handoff.

function parseArgs(argv) {
  const args = {};
  const extra = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      extra.push(...argv.slice(i + 1));
      break;
    } else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  args._extra = extra;
  return args;
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  try {
    switch (cmd) {
      case 'login':
        await require('../lib/commands/login').run(parseArgs(rest));
        break;
      case 'init':
        await require('../lib/commands/init').run(parseArgs(rest));
        break;
      case 'claude':
        await require('../lib/commands/claude').run(parseArgs(rest), 'claude_code');
        break;
      case 'codex':
        await require('../lib/commands/claude').run(parseArgs(rest), 'codex');
        break;
      case 'status':
        await require('../lib/commands/status').run(parseArgs(rest));
        break;
      case 'checkpoint':
        await require('../lib/commands/checkpoint').run(parseArgs(rest));
        break;
      case 'end':
        await require('../lib/commands/end').run(parseArgs(rest));
        break;
      case 'context': {
        // "context" có subcommand riêng (vd `context add`) — subcommand là positional đầu
        // tiên, không phải cờ `--...`, nên tách ra TRƯỚC khi đưa phần còn lại vào parseArgs
        // (parseArgs chỉ hiểu cờ `--key value`, không tự nhận biết positional).
        const [sub, ...subRest] = rest;
        await require('../lib/commands/context').run(sub, parseArgs(subRest));
        break;
      }
      case 'task': {
        // "task update <task_id> --status x" có 2 positional (subcommand + task_id) trước phần
        // cờ — "task add" chỉ có 1. Tách cả 2 ra trước khi đưa phần còn lại vào parseArgs.
        const [sub, ...subRest] = rest;
        if (sub === 'update') {
          const [taskId, ...flagRest] = subRest;
          const parsed = parseArgs(flagRest);
          parsed['task-id-positional'] = taskId;
          await require('../lib/commands/task').run(sub, parsed);
        } else {
          await require('../lib/commands/task').run(sub, parseArgs(subRest));
        }
        break;
      }
      default:
        console.log('Dùng: company-ai <login|init|claude|codex|status|checkpoint|end|context add|task add|task update>');
        process.exit(cmd ? 1 : 0);
    }
  } catch (err) {
    console.error(`Lỗi: ${err.message}`);
    if (err.body) console.error(JSON.stringify(err.body));
    require('../lib/prompt').closeRl();
    process.exit(1);
  }
  require('../lib/prompt').closeRl();
}

main();
