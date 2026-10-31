'use strict';
// Local read-only status server: no command execution, no remote listening.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const PORT = Number(process.env.YAMOGU_CENTER_PORT || 18766);
const root = path.resolve(__dirname, '../..');
const page = path.join(root, 'docs/agents/command-center.html');
const stateDir = process.env.YAMOGU_AGENT_STATE_DIR || path.join(os.tmpdir(), 'yamogu-agent-monitor');
const store = path.join(stateDir, 'events.jsonl');
const roles = ['developer', 'qa', 'designer', 'security', 'legal', 'analyst', 'coordinator'];
function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function compute() {
  let raw = '';
  try { raw = fs.readFileSync(store, 'utf8'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const events = raw.split(/\r?\n/).filter(Boolean).slice(-2000).flatMap(line => {
    try {
      const ev=JSON.parse(line);
      if (!roles.includes(ev.role) || !/^[A-Z]-\d{2,3}$/.test(ev.task || '')) return [];
      if (!['running','finished','failed','blocked'].includes(ev.state)) return [];
      return [ev];
    } catch { return []; }
  });
  const byId = new Map();
  for (const ev of events) {
    const cur = byId.get(ev.runId) || { id: ev.runId, role: ev.role, task: ev.task, startedAt: null, lastAt: null, state: 'unknown', pid: 0 };
    if (ev.state === 'running') cur.startedAt = ev.at;
    cur.state = ev.state;
    cur.lastAt = ev.at;
    cur.pid = ev.pid;
    byId.set(ev.runId, cur);
  }
  const runs = [...byId.values()].map(run => {
    if (run.state === 'running' && !alive(run.pid)) run.state = 'interrupted';
    const started = Date.parse(run.startedAt || run.lastAt);
    const ended = run.state === 'running' ? Date.now() : Date.parse(run.lastAt);
    run.durationSeconds = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0,Math.floor((ended-started)/1000)) : null;
    delete run.pid;
    return run;
  }).sort((a,b) => String(b.lastAt).localeCompare(String(a.lastAt)));
  const result = Object.fromEntries(roles.map(role => {
    const history = runs.filter(x => x.role === role);
    const running = history.find(x => x.state === 'running');
    const last = history[0] || null;
    return [role, { state: running ? 'running' : last?.state || 'not_started', last, completed: history.filter(x => x.state === 'finished').length, failures: history.filter(x => ['failed','interrupted'].includes(x.state)).length, total: history.length }];
  }));
  let supervisor = {state:'not_started', lastHeartbeat:null};
  try { supervisor = JSON.parse(fs.readFileSync(path.join(stateDir,'supervisor.json'),'utf8')); }
  catch(e) { if(e.code!=='ENOENT') supervisor={state:'unavailable',lastHeartbeat:null}; }
  if (!supervisor.lastHeartbeat || Date.now()-Date.parse(supervisor.lastHeartbeat)>75000) supervisor.state='offline';
  return { serverTime: new Date().toISOString(), source: 'local-process-events', supervisor, roles: result, recent: runs.slice(0,12) };
}
const server=http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {res.writeHead(405);return res.end('Method not allowed');}
  if (url.pathname === '/api/status') {
    try { const body=JSON.stringify(compute());res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(body); }
    catch (e) {res.writeHead(500);return res.end('Status unavailable');}
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return fs.createReadStream(page).pipe(res);
  }
  res.writeHead(404);res.end('Not found');
});
if (require.main === module) {
  startServer();
}
function startServer() {
  return server.listen(PORT, '127.0.0.1', () => console.log('YAMOGU_LIVE_CENTER http://127.0.0.1:' + PORT));
}
module.exports = { compute, startServer };
