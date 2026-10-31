'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const validRoles = ['developer', 'qa', 'security', 'coordinator', 'designer', 'legal', 'analyst'];
const validStates = ['running', 'finished', 'failed', 'blocked'];
const [role, task, state, pidArg, runId] = process.argv.slice(2);
if (!validRoles.includes(role) || !/^[A-Z]-\d{2,3}$/.test(task || '') ||
    !validStates.includes(state) || !/^\d{1,10}$/.test(pidArg || '') ||
    !/^[a-f0-9-]{16,40}$/i.test(runId || '')) {
  console.error('Invalid agent event arguments');
  process.exit(2);
}
const event = { role, task, state, pid: Number(pidArg), runId, at: new Date().toISOString() };
const dir = path.join(os.tmpdir(), 'yamogu-agent-monitor');
fs.mkdirSync(dir, { recursive: true });
fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify(event) + '\n', { encoding: 'utf8', flag: 'a' });
console.log('MONITOR_EVENT ' + role + ' ' + task + ' ' + state);
