'use strict';
// A-05. Read-only inspection of two small source files. No photos/DB/keys read.
const fs = require('node:fs');
const path = require('node:path');
function audit(root) {
  const files = ['server/photos.py', 'js/photos.js'];
  const sources = {};
  for (const f of files) {
    const file = path.join(root, ...f.split('/'));
    const info = fs.statSync(file);
    if (!info.isFile() || info.size > 500000) throw Error('Invalid source file: ' + f);
    sources[f] = fs.readFileSync(file, 'utf8');
  }
  const py = sources['server/photos.py'], js = sources['js/photos.js'];
  const checks = [];
  function add(id, severity, ok, finding, file) {
    checks.push({id, severity, status: ok ? 'PASS' : 'RISK', finding, file});
  }
  add('SEC-01', 'critical', /SELECT \* FROM tasks WHERE family=\? AND kid=\? AND id=\?/.test(py), 'Task lookup is scoped to family and child.', files[0]);
  add('SEC-02', 'high', /if op==['"]photo['"] and role==['"]parent['"]/.test(py), 'Only parent can request photo via photo operation.', files[0]);
  add('SEC-03', 'high', /digest\(token\)/.test(py) && /secrets\.token_urlsafe/.test(py), 'Random device tokens stored by hash.', files[0]);
  add('SEC-04', 'high', /expires>\?/.test(py) && /DELETE FROM invites WHERE code=\?/.test(py), 'Invite expiry and single-use redemption.', files[0]);
  add('SEC-05', 'high', /len\(raw\)>950000/.test(py) && /Content-Length/.test(py), 'Byte-count constraints on uploads.', files[0]);
  add('SEC-06', 'critical', /op==['"]revoke['"]|op==['"]revoke_device['"]/.test(py), 'Device revocation API missing.', files[0]);
  add('SEC-07', 'critical', /op==['"]delete_family['"]|op==['"]delete_account['"]/.test(py), 'Family-wide deletion API missing.', files[0]);
  add('SEC-08', 'high', !/localStorage\.setItem\(key\(role\)/.test(js), 'Family authorization token saved in localStorage (accessible to JS).', files[1]);
  add('SEC-09', 'high', /rate.?limit|throttle|retry_after/i.test(py), 'No explicit brute-force rate limiting in Python service.', files[0]);
  add('SEC-10', 'high', /Image\.open|imghdr|PIL/.test(py), 'JPEG magic header checked, but image decoding not validated.', files[0]);
  add('SEC-11', 'critical', /purge_backup|erase_backup|secure_delete_backup/i.test(py), 'No verified backup-deletion operation.', files[0]);
  add('SEC-12', 'medium', /WHERE family=\? AND kid=\? AND id=\?/.test(py.split('UPDATE tasks SET state=')[1]||''), 'Final task UPDATE scoped only by ID; prior SELECT was scoped.', files[0]);
  return {
    task: 'A-05',
    type: 'static read-only source audit',
    codeReviewed: files,
    status: checks.some(x=>x.status==='RISK') ? 'PUBLIC_RELEASE_BLOCKED' : 'REVIEWED',
    checkedAt: new Date().toISOString(),
    checks,
    totals: {passed:checks.filter(x=>x.status==='PASS').length, risks:checks.filter(x=>x.status==='RISK').length},
    caveat: 'Heuristic static inspection, not pen testing, deployment verification, or legal approval.'
  };
}
if (require.main === module) {
  const root = process.argv[2];
  if (!root) { console.error('Usage: node security-audit.cjs <local-source-folder>'); process.exit(2); }
  try {
    const out = audit(path.resolve(root));
    console.log(JSON.stringify(out,null,2));
    if (out.totals.risks) process.exitCode = 3;
  } catch(e) { console.error('AUDIT_ERROR '+e.message); process.exitCode=2; }
}
module.exports={audit};
