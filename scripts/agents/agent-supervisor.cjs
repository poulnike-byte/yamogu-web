'use strict';
/* Persistent, local, low-risk job dispatcher for Yamogu.
   Only two allowlisted, read-only jobs: QA tests and photo security inspection.
   No Git writes, Codex model calls, network uploads, deployment or secrets. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const {startServer}=require('./live-center.cjs');
const root=path.resolve(__dirname,'../..');
const stateDir=path.join(os.tmpdir(),'yamogu-agent-monitor');
const configFile=path.join(root,'docs/agents/AUTO_QUEUE.json');
const journal=path.join(stateDir,'events.jsonl');
const cacheFile=path.join(stateDir,'scheduler.json');
const heartbeatFile=path.join(stateDir,'supervisor.json');
const photos=process.env.YAMOGU_PHOTO_PILOT ||
  path.join(os.homedir(),'Desktop','ПРОЕКТ ДЕТИ','yamogu-photo-pilot');
const jobs={ qa:{ task:'A-04', cadenceMs:6*3600e3 }, security:{ task:'A-05', cadenceMs:6*3600e3 } };
fs.mkdirSync(stateDir,{recursive:true});
function readJSON(file,fallback) { try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){return fallback;} }
function save(file,obj){ const temp=file+'.writing-'+process.pid; fs.writeFileSync(temp,JSON.stringify(obj,null,2),'utf8'); fs.renameSync(temp,file); }
const history=readJSON(cacheFile,{});
let active=null, stopping=false;
function event(role,task,state,runId,pid){
  fs.appendFileSync(journal,JSON.stringify({role,task,state,runId,pid,at:new Date().toISOString()})+'\n');
}
function stamp(message){
  save(heartbeatFile,{state:stopping?'stopping':'online',lastHeartbeat:new Date().toISOString(),
    running:active?{role:active.role,task:active.task,startedAt:active.startedAt}:null,
    lastAction:message||null,queue:'read-only checks; no autonomous publishing'});
}
function fingerprint(role){
  try{
    const hasher=crypto.createHash('sha256');
    const files=role==='security'
      ? ['server/photos.py','js/photos.js'].map(f=>path.join(photos,...f.split('/')))
      : [path.join(root,'package.json'),path.join(root,'tests/app.test.mjs')];
    for(const f of files){hasher.update(fs.readFileSync(f));}
    if(role==='qa')hasher.update(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}));
    return hasher.digest('hex');
  }catch{return 'missing-source';}
}
function jobEnabled(role){
  const cfg=readJSON(configFile,{});
  return cfg.version===1 && cfg.jobs && cfg.jobs[role]?.enabled===true &&
    cfg.jobs[role]?.taskId===jobs[role].task && cfg.jobs[role]?.mode==='read-only';
}
function run(role,hash){
  const task=jobs[role].task, runId=crypto.randomUUID().replace(/-/g,'');
  const args=role==='qa' ?
    ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'run-qa.ps1'),'-TaskId',task] :
    [path.join(__dirname,'security-audit.cjs'),photos];
  const exe=role==='qa'?'powershell.exe':process.execPath;
  const startedAt=new Date().toISOString();
  const child=spawn(exe,args,{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env}});
  active={role,task,startedAt,pid:child.pid,runId};
  event(role,task,'running',runId,child.pid||process.pid);
  history[role]={lastStart:Date.now(),hash}; save(cacheFile,history);
  stamp('Started '+role);
  child.once('error',err=>{ if(active?.runId!==runId)return; complete('failed','spawn error '+err.code); });
  child.once('close',code=>{
    if(active?.runId!==runId)return;
    const state=(role==='security'&&code===3)?'blocked':code===0?'finished':'failed';
    complete(state,'Job '+role+' exit '+code);
  });
  function complete(state,note){
    event(role,task,state,runId,child.pid||process.pid);
    active=null;history[role].lastEnd=Date.now();history[role].lastState=state;
    save(cacheFile,history);stamp(note);
  }
}
function tick(){
  stamp('Polling approved queue');
  if(active||stopping)return;
  for(const role of ['security','qa']){
    if(!jobEnabled(role))continue;
    const hash=fingerprint(role),last=history[role]||{};
    if(hash==='missing-source')continue;
    const interrupted = last.lastStart && !last.lastEnd && Date.now()-last.lastStart>120000;
    const due=hash!==last.hash || !last.lastStart || interrupted || Date.now()-last.lastStart>=jobs[role].cadenceMs;
    if(due){run(role,hash);break;}
  }
}
let poll=null,heart=null;
const server=startServer();
server.once('listening',()=>{
  stamp('Supervisor started');
  tick();
  poll=setInterval(tick,30000);
  heart=setInterval(()=>stamp('Supervisor heartbeat'),10000);
});
server.once('error',err=>{
  console.error('YAMOGU_DISPATCHER_LISTEN_ERROR '+err.code);
  process.exitCode=1;
});
function stop(){
  if(stopping)return;stopping=true;clearInterval(poll);clearInterval(heart);
  // No forced interruption of running tests. Status becomes stale if process exits unexpectedly.
  stamp('Supervisor stopping');
  if(!active)process.exit(0);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
