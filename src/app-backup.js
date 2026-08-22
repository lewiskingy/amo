const BACKUP_ROOT='backups';
const AUTOSAVE_DELAY_MS=500;
const AUTOSAVE_SAFETY_INTERVAL_MS=60000;
let autosaveTimer=null,autosaveRunning=false,autosaveQueued=false,workspaceChangeSerial=0,lastAutosavedAt=null;
function pad2(n){return String(n).padStart(2,'0')}
function pad3(n){return String(n).padStart(3,'0')}
function localBackupTimestamp(d=new Date()){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}-${pad3(d.getMilliseconds())}`}
function parseBackupTimestamp(name){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?$/.exec(name);if(!m)return null;const [,y,mo,d,h,mi,s,ms='0']=m,date=new Date(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi),Number(s),Number(ms));return Number.isNaN(date.getTime())?null:date}
function dayKey(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}
function monthKey(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`}
function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function setAutosaveStatus(date=null){lastAutosavedAt=date;const el=document.getElementById('autoSaveStatus');if(!el)return;el.textContent=date?`· Auto-saved ${date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`:''}
function repositoryFrom(value=null){if(value?.createSafetyBackup)return value;if(value&&window.workspaceRepositoryForHandle)return workspaceRepositoryForHandle(value);return window.workspaceRepository||null}
async function createWorkspaceBackup(value=window.workspaceRepository){
  const repo=repositoryFrom(value);if(!repo)throw new Error('No workspace repository is connected.');
  const name=localBackupTimestamp(),manifest={type:'architecture-operations-hub-backup',createdAt:new Date().toISOString(),sourceWorkspace:repo.name||db.workspace?.name||'Workspace',retention:'all today; first per day within 7 days; first per month thereafter',statusReports:'draft only; published reports are immutable history',excludedRoots:['archive']};
  await repo.createSafetyBackup({name,manifest});log(`Created workspace backup ${BACKUP_ROOT}/${name}.`);return name
}
async function pruneWorkspaceBackups(value=window.workspaceRepository,now=new Date()){
  const repo=repositoryFrom(value);if(!repo)return;const entries=(await repo.listBackups()).map(name=>({name,date:parseBackupTimestamp(name)})).filter(x=>x.date).sort((a,b)=>a.date-b.date),today=startOfDay(now),weekStart=new Date(today);weekStart.setDate(weekStart.getDate()-6);
  const keep=new Set(),daily=new Map(),monthly=new Map();for(const entry of entries){const d=startOfDay(entry.date);if(d.getTime()===today.getTime()){keep.add(entry.name);continue}if(d>=weekStart&&d<today){const key=dayKey(entry.date);if(!daily.has(key)){daily.set(key,entry.name);keep.add(entry.name)}continue}const key=monthKey(entry.date);if(!monthly.has(key)){monthly.set(key,entry.name);keep.add(entry.name)}}
  const before=entries.length,candidates=new Set(entries.map(e=>e.name));await repo.pruneBackups({keep,candidates});const removed=before-keep.size;if(removed>0)log(`Backup retention removed ${removed} superseded backup${removed===1?'':'s'}.`)
}
async function backupWorkspaceOnOpen(value=window.workspaceRepository){setAutosaveStatus(null);const repo=repositoryFrom(value);if(!repo)throw new Error('No workspace repository is connected.');if(!await repo.ensureWritePermission())throw new Error('Read/write permission is required to create the workspace safety backup.');await createWorkspaceBackup(repo);await pruneWorkspaceBackups(repo)}
function requestAutosave(delay=AUTOSAVE_DELAY_MS){if(!workspaceHandle||!dirtyCount())return;workspaceChangeSerial++;clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>flushAutosave(),delay)}
async function flushAutosave(){if(!workspaceHandle||!dirtyCount())return;if(autosaveRunning){autosaveQueued=true;return}autosaveRunning=true;try{const saved=await saveWorkspace({silent:true,reason:'Autosave'});if(saved)setAutosaveStatus(new Date())}finally{autosaveRunning=false;if(autosaveQueued||dirtyCount()){autosaveQueued=false;clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>flushAutosave(),250)}}}
setInterval(()=>{if(workspaceHandle&&dirtyCount())flushAutosave()},AUTOSAVE_SAFETY_INTERVAL_MS);
