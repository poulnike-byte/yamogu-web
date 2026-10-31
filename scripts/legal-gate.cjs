'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'..');
const arg=process.argv.find(x=>x.startsWith('--base='));const base=arg?.slice(7);
function git(args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()}
let changed;
try{changed=(base?git(['diff','--name-only',base+'...HEAD']):git(['status','--porcelain','--untracked-files=all']).split('\n').filter(Boolean).map(x=>x.slice(3))).filter(Boolean)}catch(e){console.error('BLOCK: cannot determine changed files:',e.message);process.exit(2)}
const files=[...new Set(changed.map(x=>x.replace(/\\/g,'/')))];
const source=files.filter(f=>/^(js\/|server\/|css\/|index\.html|sw\.js|manifest\.|img\/|icons\/)/.test(f));
const sensitive=source.filter(f=>/^(server\/|js\/(photos|app|parent|storage|wishes|backup|onboarding)\.js|index\.html|sw\.js)/.test(f));
const problems=[];
const requireFile=(f)=>{if(!fs.existsSync(path.join(root,f)))problems.push('Missing '+f)};
requireFile('docs/REGULATIONS_INDEX.md');requireFile('docs/LEGAL_AGENT.md');requireFile('docs/LEGAL_REVIEW_GATE.md');
if(source.length){requireFile('docs/changes/CURRENT_CHANGE.md');}
if(sensitive.length){requireFile('docs/legal-reviews/CURRENT_REVIEW.md');}
const report=(f)=>fs.existsSync(path.join(root,f))?fs.readFileSync(path.join(root,f),'utf8'):'';
const change=report('docs/changes/CURRENT_CHANGE.md');
const review=report('docs/legal-reviews/CURRENT_REVIEW.md');
if(source.length && (!/Function-ID:\s*F-\d+/i.test(change)||!/Tests:\s*\S+/i.test(change)))problems.push('Change record needs Function-ID and Tests');
if(sensitive.length && (!/Decision:\s*(BLOCK|NEEDS_COUNSEL|CONDITIONAL|NO_ISSUES_FOUND)/i.test(review)||!/Evidence:\s*\S+/i.test(review)))problems.push('Legal review needs Decision and Evidence');
const release=process.argv.includes('--release');
if(release && source.length){
 const approval=report('docs/legal-reviews/HUMAN_APPROVAL.md');
 if(!/Status:\s*LEGAL_APPROVED\b/.test(approval)||!/Counsel:\s*\S+/.test(approval)||!/Scope:\s*\S+/.test(approval)||!/Approved-on:\s*\d{4}-\d\d-\d\d/.test(approval))problems.push('BLOCK release: documented human legal approval absent');
 if(/Decision:\s*(BLOCK|NEEDS_COUNSEL)/i.test(review))problems.push('BLOCK release: outstanding legal risks');
}
console.log(JSON.stringify({mode:release?'release':'development',source,sensitive,problems},null,2));
if(problems.length)process.exitCode=1;
