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
  const args = parseArgs(rest);

  try {
    switch (cmd) {
      case 'login':
        await require('../lib/commands/login').run(args);
        break;
      case 'init':
        await require('../lib/commands/init').run(args);
        break;
      case 'claude':
        await require('../lib/commands/claude').run(args, 'claude_code');
        break;
      case 'codex':
        await require('../lib/commands/claude').run(args, 'codex');
        break;
      case 'status':
        await require('../lib/commands/status').run(args);
        break;
      case 'checkpoint':
        await require('../lib/commands/checkpoint').run(args);
        break;
      case 'end':
        await require('../lib/commands/end').run(args);
        break;
      default:
        console.log('Dùng: company-ai <login|init|claude|codex|status|checkpoint|end>');
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
