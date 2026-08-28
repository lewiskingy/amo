/* openWorkspace() calls backupWorkspaceOnOpen(handle) before window.workspaceRepository is assigned.
   Preserve that legacy handle->repository resolution while applying the new weekly policy. */
(function initBackupRecoveryOpenCompatibility(){
  const pad=n=>String(n).padStart(2,'0');
  const day=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const weekStart=(d=new Date())=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),offset=(x.getDay()+6)%7;x.setDate(x.getDate()-offset);return x};
  const parse=name=>{let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(name||''));if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?$/.exec(String(name||''));return m?new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+(m[7]||0)):null};
  function resolve(value){if(value?.mode)return value;if(typeof repositoryFrom==='function')return repositoryFrom(value);if(value&&window.workspaceRepositoryForHandle)return workspaceRepositoryForHandle(value);return window.workspaceRepository||null}
  async function retain(r,now=new Date()){
    const entries=(await r.listBackups()).map(name=>({name,date:parse(name)})).filter(x=>x.date).sort((a,b)=>a.date-b.date),cutoff=weekStart(now);cutoff.setDate(cutoff.getDate()-49);const keep=new Set(),months=new Set();
    for(const e of entries){if(e.date>=cutoff){keep.add(e.name);continue}const key=`${e.date.getFullYear()}-${pad(e.date.getMonth()+1)}`;if(!months.has(key)){months.add(key);keep.add(e.name)}}
    await r.pruneBackups({keep,candidates:new Set(entries.map(e=>e.name))});const deltaCutoff=weekStart(now);deltaCutoff.setDate(deltaCutoff.getDate()-7);if(r.pruneDeltas)await r.pruneDeltas({cutoffDay:day(deltaCutoff)})
  }
  async function ensureWeekly(r,now=new Date()){
    if(!r||r.mode!=='local')return null;const name=day(weekStart(now));if((await r.listBackups()).includes(name))return null;
    const manifest={type:'architecture-operations-hub-backup',backupForWeekStarting:name,createdAt:new Date().toISOString(),sourceWorkspace:r.name||'Workspace',retention:'weekly full snapshots; detailed deltas retained for current and preceding week',statusReports:'all JSON status-report records included',excludedRoots:['archive','backups/deltas','.locks']};
    await r.createSafetyBackup({name,manifest});await retain(r,now);if(typeof log==='function')log(`Created Start-of-Week workspace backup backups/${name}.`);return name
  }
  if(typeof createWorkspaceBackup==='function')createWorkspaceBackup=async function(value=window.workspaceRepository){const r=resolve(value);return ensureWeekly(r)};
  if(typeof pruneWorkspaceBackups==='function')pruneWorkspaceBackups=async function(value=window.workspaceRepository,now=new Date()){const r=resolve(value);if(r?.mode==='local')await retain(r,now)};
  if(typeof backupWorkspaceOnOpen==='function')backupWorkspaceOnOpen=async function(value=window.workspaceRepository){if(typeof setAutosaveStatus==='function')setAutosaveStatus(null);const r=resolve(value);if(!r||r.mode!=='local')return;if(!await r.ensureWritePermission())throw new Error('Read/write permission is required to maintain workspace recovery data.');await ensureWeekly(r)};
})();
