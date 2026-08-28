/* Weekly full backup + document transaction journal + point-in-time restore.
   Local workspace implementation. Remote storage can implement the same repository capabilities later. */
(function initBackupRecovery(){
  if(window.__amoBackupRecoveryLoaded)return;window.__amoBackupRecoveryLoaded=true;

  const FULL_ROOT='backups',DELTA_ROOT='backups/deltas';
  const MUTABLE_FOLDERS=['demand','team','allocations','ideas','config','status-reports'];
  const FULL_RECENT_WEEKS=8,DELTA_RETAIN_WEEKS=2,RESTORE_LOCK='.locks/workspace-restore.lock.json';
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const safeName=v=>String(v||'change').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'change';
  const pad=n=>String(n).padStart(2,'0');
  const pad3=n=>String(n).padStart(3,'0');
  const localDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const txStamp=d=>`${localDay(d)}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad3(d.getMilliseconds())}`;
  const isoWeekStart=(d=new Date())=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x};
  const actorName=()=>{try{const u=typeof localWorkspaceUser==='function'?localWorkspaceUser():null;return u?.name||u?.email||'AMO user'}catch{return'AMO user'}};
  const repo=()=>window.workspaceRepository;

  function parseBackupDate(name){
    let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(name||''));if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?$/.exec(String(name||''));if(!m)return null;
    return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+(m[7]||0))
  }
  if(typeof parseBackupTimestamp==='function')parseBackupTimestamp=parseBackupDate;

  async function listJsonTree(localRepo,basePath){
    const out=new Map();
    async function walk(path){
      let entries=[];try{entries=await localRepo.listEntries(path,{optional:true})}catch{return}
      for(const e of entries){const child=path?`${path}/${e.name}`:e.name;if(e.kind==='directory')await walk(child);else if(e.kind==='file'&&e.name.toLowerCase().endsWith('.json')){try{out.set(child,await localRepo.readJson(child,{required:true}))}catch{}}
    }
    await walk(basePath);return out
  }
  async function currentSnapshot(localRepo){
    const out=new Map();const workspace=await localRepo.readJson('workspace.json');if(workspace)out.set('workspace.json',workspace);
    for(const folder of MUTABLE_FOLDERS){const rows=await listJsonTree(localRepo,folder);for(const [path,value] of rows)out.set(path,value)}
    return out
  }
  async function backupSnapshot(localRepo,name){
    const root=`${FULL_ROOT}/${name}`,out=new Map();const all=await listJsonTree(localRepo,root);
    for(const [path,value] of all){const rel=path.slice(root.length+1);if(rel&&rel!=='backup-manifest.json')out.set(rel,value)}return out
  }
  async function rawApply(localRepo,op){if(op.after==null)await localRepo.deletePath(op.path,{ignoreMissing:true});else await localRepo.writeJson(op.path,op.after)}

  async function commitDocumentTransaction(localRepo,{type='change',reason='Workspace change',operations=[],metadata={}}={}){
    if(localRepo?.mode!=='local')throw new Error('Transaction journaling is currently available for Local workspaces only.');
    if(!await localRepo.ensureWritePermission())throw new Error('Read/write permission is required.');
    const resolved=[];
    for(const input of operations){const path=String(input.path||'');if(!path||path.startsWith('backups/'))continue;let before=input.before;
      if(before===undefined){try{before=await localRepo.readJson(path)}catch(e){if(e?.name==='NotFoundError')before=null;else throw e}}
      const after=input.after===undefined?null:clone(input.after);if(same(before,after))continue;
      resolved.push({path,operation:before==null?'create':after==null?'delete':'update',before:clone(before),after})
    }
    if(!resolved.length)return null;
    const now=new Date(),id=`TX-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,day=localDay(now),file=`${txStamp(now)}--${id}--${safeName(type)}.json`,path=`${DELTA_ROOT}/${day}/${file}`;
    const record={id,type,state:'pending',timestamp:now.toISOString(),actor:actorName(),reason,metadata:clone(metadata),operations:resolved};
    await localRepo.writeJson(path,record);
    try{for(const op of resolved)await rawApply(localRepo,op);record.state='committed';record.committedAt=new Date().toISOString();await localRepo.writeJson(path,record);return record}
    catch(e){record.error=String(e?.message||e);try{await localRepo.writeJson(path,record)}catch{}throw e}
  }

  function installLocalJournal(){
    const C=window.LocalWorkspaceRepository;if(!C||C.prototype.__amoJournalInstalled)return;const p=C.prototype;p.__amoJournalInstalled=true;
    p.commitDocumentTransaction=function(args){return commitDocumentTransaction(this,args)};
    p.listDeltaDays=async function(){return (await this.listEntries(DELTA_ROOT,{optional:true})).filter(e=>e.kind==='directory'&&/^\d{4}-\d{2}-\d{2}$/.test(e.name)).map(e=>e.name).sort()};
    p.listDeltaTransactions=async function(){const out=[];for(const day of await this.listDeltaDays())for(const e of await this.listEntries(`${DELTA_ROOT}/${day}`,{optional:true}))if(e.kind==='file'&&e.name.endsWith('.json')){try{const tx=await this.readJson(`${DELTA_ROOT}/${day}/${e.name}`,{required:true});out.push(tx)}catch{}}return out.sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)))};
    p.pruneDeltas=async function({cutoffDay}){let removed=0;for(const day of await this.listDeltaDays())if(day<cutoffDay){await this.deletePath(`${DELTA_ROOT}/${day}`,{recursive:true});removed++}return removed};
    p.readFullBackupSnapshot=function(name){return backupSnapshot(this,name)};
    p.readCurrentRecoverySnapshot=function(){return currentSnapshot(this)};

    p.createSafetyBackup=async function({name,manifest}){
      if(!await this.ensureWritePermission())throw new Error('Read/write permission is required to create the workspace safety backup.');
      const backups=await this.rootHandle.getDirectoryHandle(FULL_ROOT,{create:true}),snapshot=await backups.getDirectoryHandle(name,{create:true});
      const copyFolder=async folder=>{let src;try{src=await this.rootHandle.getDirectoryHandle(folder)}catch(e){if(e.name==='NotFoundError')return;throw e}const dest=await snapshot.getDirectoryHandle(folder,{create:true});for await(const [file,handle] of src.entries())if(handle.kind==='file'&&file.toLowerCase().endsWith('.json'))await this.copyFile(handle,dest,file)};
      await this.copyFile(await this.rootHandle.getFileHandle('workspace.json'),snapshot,'workspace.json');for(const folder of MUTABLE_FOLDERS)await copyFolder(folder);
      const mh=await snapshot.getFileHandle('backup-manifest.json',{create:true}),w=await mh.createWritable();await w.write(JSON.stringify(manifest,null,2)+'\n');await w.close();return name
    };
    p.listBackups=async function(){const out=[];for(const e of await this.listEntries(FULL_ROOT,{optional:true}))if(e.kind==='directory'&&e.name!=='deltas'&&parseBackupDate(e.name))out.push(e.name);return out.sort()};

    p.saveRecord=async function(type,record){if(!record?.id)throw new Error('Record ID is required.');const folder=this.entityFolder(type);return commitDocumentTransaction(this,{type:`save-${type}`,reason:`Save ${type} ${record.id}`,operations:[{path:`${folder}/${record.id}.json`,after:record}]})};
    p.deleteRecord=async function(type,id){const folder=this.entityFolder(type);return commitDocumentTransaction(this,{type:`delete-${type}`,reason:`Delete ${type} ${id}`,operations:[{path:`${folder}/${id}.json`,after:null}]})};
    p.saveSettings=async function(settings){return commitDocumentTransaction(this,{type:'configuration',reason:'Save Configuration',operations:[{path:'config/settings.json',after:settings}]})};
    p.saveStatusReport=async function(idOrFile,record){const name=String(idOrFile).endsWith('.json')?String(idOrFile):`${idOrFile}.json`;return commitDocumentTransaction(this,{type:'status-report',reason:`Save Status Report ${name}`,operations:[{path:`status-reports/${name}`,after:record}]})};
    p.saveChanges=async function({workspace,settings,collections,dirty,deleted,configDirty=false}){
      const now=new Date().toISOString(),ops=[{path:'workspace.json',after:{...workspace,modifiedAt:now}}];
      for(const type of ['demand','team','allocations','ideas']){const rows=collections[type]||[],folder=this.entityFolder(type);for(const id of dirty[type]||[]){const rec=rows.find(x=>x.id===id);if(rec)ops.push({path:`${folder}/${id}.json`,after:rec})}for(const id of deleted[type]||[])ops.push({path:`${folder}/${id}.json`,after:null})}
      if(configDirty)ops.push({path:'config/settings.json',after:settings});return commitDocumentTransaction(this,{type:'workspace-save',reason:'Workspace save',operations:ops})
    };
    p.archiveRecords=async function(recordsByEntity){
      if(!await this.ensureWritePermission())throw new Error('Read/write permission is required for archive maintenance.');const ops=[];
      for(const [entity,records] of Object.entries(recordsByEntity||{}))for(const record of records||[])ops.push({path:`${this.entityFolder(entity)}/${record.id}.json`,after:null});
      const tx=await commitDocumentTransaction(this,{type:'archive',reason:'Archive stale terminal records',operations:ops});
      for(const [entity,records] of Object.entries(recordsByEntity||{}))for(const record of records||[])await this.writeJson(`archive/${entity}/${record.id}.json`,record);return tx
    }
  }
  installLocalJournal();

  async function createWeeklyBackup(localRepo,now=new Date()){
    const start=isoWeekStart(now),name=localDay(start),existing=await localRepo.listBackups();if(existing.includes(name))return null;
    const manifest={type:'architecture-operations-hub-backup',backupForWeekStarting:name,createdAt:new Date().toISOString(),sourceWorkspace:localRepo.name||db?.workspace?.name||'Workspace',retention:'weekly full snapshots; detailed deltas retained for current and preceding week',statusReports:'all JSON status-report records included',excludedRoots:['archive','backups/deltas','.locks']};
    await localRepo.createSafetyBackup({name,manifest});if(typeof log==='function')log(`Created Start-of-Week workspace backup ${FULL_ROOT}/${name}.`);return name
  }
  async function pruneWeeklyBackups(localRepo,now=new Date()){
    const entries=(await localRepo.listBackups()).map(name=>({name,date:parseBackupDate(name)})).filter(x=>x.date).sort((a,b)=>a.date-b.date),recentCutoff=isoWeekStart(now);recentCutoff.setDate(recentCutoff.getDate()-7*(FULL_RECENT_WEEKS-1));
    const keep=new Set(),monthly=new Set();for(const e of entries){if(e.date>=recentCutoff){keep.add(e.name);continue}const key=`${e.date.getFullYear()}-${pad(e.date.getMonth()+1)}`;if(!monthly.has(key)){monthly.add(key);keep.add(e.name)}}
    await localRepo.pruneBackups({keep,candidates:new Set(entries.map(e=>e.name))});return entries.length-keep.size
  }
  async function pruneJournal(localRepo,now=new Date()){
    const cutoff=isoWeekStart(now);cutoff.setDate(cutoff.getDate()-7*(DELTA_RETAIN_WEEKS-1));return localRepo.pruneDeltas({cutoffDay:localDay(cutoff)})
  }
  if(typeof createWorkspaceBackup==='function')createWorkspaceBackup=async function(value=window.workspaceRepository){const r=value?.mode?value:repo();if(r?.mode!=='local')return null;return createWeeklyBackup(r)};
  if(typeof pruneWorkspaceBackups==='function')pruneWorkspaceBackups=async function(value=window.workspaceRepository,now=new Date()){const r=value?.mode?value:repo();if(r?.mode!=='local')return;const full=await pruneWeeklyBackups(r,now),delta=await pruneJournal(r,now);if(full&&typeof log==='function')log(`Full-backup retention removed ${full} older snapshot${full===1?'':'s'}.`);if(delta&&typeof log==='function')log(`Delta retention removed ${delta} older daily folder${delta===1?'':'s'}.`)};
  if(typeof backupWorkspaceOnOpen==='function')backupWorkspaceOnOpen=async function(value=window.workspaceRepository){if(typeof setAutosaveStatus==='function')setAutosaveStatus(null);const r=value?.mode?value:repo();if(!r||r.mode!=='local')return;if(!await r.ensureWritePermission())throw new Error('Read/write permission is required to maintain workspace recovery data.');const created=await createWeeklyBackup(r);if(created)await pruneWorkspaceBackups(r)};

  async function acquireRestoreLock(localRepo){const token=`restore-${Date.now()}-${Math.random().toString(36).slice(2)}`,now=Date.now(),current=await localRepo.readLock(RESTORE_LOCK);if(current&&now-Date.parse(current.createdAt||0)<60000)throw new Error(`A restore is already in progress${current.actor?` by ${current.actor}`:''}.`);const lock={token,actor:actorName(),createdAt:new Date().toISOString()};await localRepo.writeLock(lock,RESTORE_LOCK);const verify=await localRepo.readLock(RESTORE_LOCK);if(verify?.token!==token)throw new Error('Could not acquire the restore lock.');return token}
  async function releaseRestoreLock(localRepo,token){try{const current=await localRepo.readLock(RESTORE_LOCK);if(current?.token===token)await localRepo.deleteLock(RESTORE_LOCK)}catch{}}
  async function desiredAtTransaction(localRepo,targetTimestamp){const state=await currentSnapshot(localRepo),txs=(await localRepo.listDeltaTransactions()).filter(t=>t.state==='committed'&&String(t.timestamp)>String(targetTimestamp)).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));for(const tx of txs)for(const op of [...(tx.operations||[])].reverse()){if(op.before==null)state.delete(op.path);else state.set(op.path,clone(op.before))}return state}
  async function diffSnapshots(current,target){const paths=new Set([...current.keys(),...target.keys()]),ops=[];for(const path of [...paths].sort()){const before=current.has(path)?current.get(path):null,after=target.has(path)?target.get(path):null;if(!same(before,after))ops.push({path,before,after})}return ops}

  function ensureRestoreUi(){
    const nav=[...document.querySelectorAll('details.nav-group')].find(d=>/Admin/i.test(d.querySelector('summary')?.textContent||''))?.querySelector('.nav-group-items');
    if(nav&&!nav.querySelector('[data-view="restore"]')){const b=document.createElement('button');b.className='nav-btn';b.dataset.view='restore';b.innerHTML='<span class="nav-dot"></span>Restore';b.addEventListener('click',()=>switchView('restore'));const workspace=nav.querySelector('[data-view="data"]');nav.insertBefore(b,workspace||null)}
    const content=document.querySelector('.content');if(content&&!document.getElementById('restore')){const s=document.createElement('section');s.id='restore';s.className='view';s.innerHTML='<div class="hero"><div><h1>Restore</h1><p>Point-in-time recovery from weekly full snapshots and the retained transaction journal.</p></div></div><div id="restoreContent"></div>';content.appendChild(s)}
  }
  async function renderRestore(){
    ensureRestoreUi();const host=document.getElementById('restoreContent');if(!host)return;const r=repo();if(!r){host.innerHTML='<div class="notice">Open a workspace to view recovery points.</div>';return}if(r.mode!=='local'){host.innerHTML='<div class="notice">Point-in-time Restore is currently implemented for Local workspaces. Remote recovery remains a repository/server capability for the roadmap.</div>';return}
    host.innerHTML='<div class="notice">Loading recovery history…</div>';
    try{const [backups,allTx]=await Promise.all([r.listBackups(),r.listDeltaTransactions()]),pending=allTx.filter(t=>t.state!=='committed'),txs=allTx.filter(t=>t.state==='committed').sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
      let html='<div class="card"><h2 style="margin-top:0">Recovery policy</h2><p>A full snapshot is created on the first writable session of each week and named for that week’s Monday. Every Local document commit records complete before/after images under <strong>backups/deltas/YYYY-MM-DD/</strong>. Detailed deltas are retained for the current and preceding week.</p></div>';
      if(pending.length)html+=`<div class="notice bad" style="margin-top:12px"><strong>${pending.length} incomplete transaction${pending.length===1?'':'s'} detected.</strong> Review the delta files before performing a restore.</div>`;
      html+='<div class="card" style="margin-top:16px"><div class="section-title" style="margin-top:0"><h2>Point-in-time recovery</h2><span class="muted">Restore is committed forward as a new auditable transaction.</span></div><div class="table-wrap"><table><thead><tr><th>Point</th><th>Type</th><th>Actor / detail</th><th></th></tr></thead><tbody>';
      for(const tx of txs)html+=`<tr><td>${new Date(tx.timestamp).toLocaleString('en-GB')}</td><td>${escapeHtml?.(tx.type||'Change')||tx.type}</td><td>${escapeHtml?.(tx.actor||'')||tx.actor}${tx.reason?` · ${escapeHtml?.(tx.reason)||tx.reason}`:''}</td><td><button class="btn" data-restore-tx="${tx.id}">Preview Restore</button></td></tr>`;
      for(const name of [...backups].sort().reverse())html+=`<tr><td>${name} · Start of Week</td><td>Full backup</td><td>Weekly recovery point</td><td><button class="btn" data-restore-backup="${name}">Preview Restore</button></td></tr>`;
      html+='</tbody></table></div></div><div id="restorePreview" style="margin-top:16px"></div>';host.innerHTML=html;
      host.querySelectorAll('[data-restore-tx]').forEach(b=>b.onclick=()=>previewRestore({kind:'tx',id:b.dataset.restoreTx,tx:allTx.find(x=>x.id===b.dataset.restoreTx)}));host.querySelectorAll('[data-restore-backup]').forEach(b=>b.onclick=()=>previewRestore({kind:'backup',id:b.dataset.restoreBackup}))
    }catch(e){host.innerHTML=`<div class="notice bad">Could not load recovery history: ${String(e.message||e)}</div>`}
  }
  function htmlEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function previewRestore(point){
    const host=document.getElementById('restorePreview'),r=repo();if(!host||r?.mode!=='local')return;host.innerHTML='<div class="notice">Calculating restore impact…</div>';
    try{if(typeof dirtyCount==='function'&&dirtyCount())throw new Error('Save or discard current unsaved changes before preparing a restore.');const current=await currentSnapshot(r),target=point.kind==='backup'?await backupSnapshot(r,point.id):await desiredAtTransaction(r,point.tx.timestamp),ops=await diffSnapshots(current,target),creates=ops.filter(o=>o.before==null&&o.after!=null).length,deletes=ops.filter(o=>o.before!=null&&o.after==null).length,updates=ops.length-creates-deletes,label=point.kind==='backup'?`${point.id} Start of Week`:new Date(point.tx.timestamp).toLocaleString('en-GB');
      host.innerHTML=`<div class="card"><h2 style="margin-top:0">Restore preview · ${htmlEscape(label)}</h2><p><strong>${ops.length}</strong> document${ops.length===1?'':'s'} will change · ${updates} update${updates===1?'':'s'} · ${creates} create${creates===1?'':'s'} · ${deletes} delete${deletes===1?'':'s'}.</p>${ops.length?`<details><summary>Documents affected</summary><ul>${ops.map(o=>`<li><code>${htmlEscape(o.path)}</code> · ${o.before==null?'create':o.after==null?'delete':'update'}</li>`).join('')}</ul></details><div class="toolbar" style="margin-top:14px"><button class="btn danger" id="applyPointRestore">Restore to this point</button></div>`:'<div class="notice">The workspace already matches this recovery point.</div>'}</div>`;
      const apply=document.getElementById('applyPointRestore');if(apply)apply.onclick=async()=>{if(!confirm(`Restore the workspace to ${label}?\n\nThis will be committed as a new forward restore transaction and can itself be reversed from the journal.`))return;let token=null;try{apply.disabled=true;token=await acquireRestoreLock(r);const fresh=await currentSnapshot(r),freshOps=await diffSnapshots(fresh,target);await commitDocumentTransaction(r,{type:'restore',reason:`Point-in-time restore to ${label}`,metadata:{restorePoint:point.kind,restoreId:point.id,targetTimestamp:point.tx?.timestamp||null},operations:freshOps.map(o=>({path:o.path,before:o.before,after:o.after}))});alert('Restore committed successfully. AMO will reload the workspace now.');location.reload()}catch(e){alert(`Restore failed: ${e.message||e}`);apply.disabled=false}finally{if(token)await releaseRestoreLock(r,token)}}
    }catch(e){host.innerHTML=`<div class="notice bad">${htmlEscape(e.message||e)}</div>`}
  }

  ensureRestoreUi();
  const baseSwitch=window.switchView;if(typeof baseSwitch==='function')window.switchView=function(id){const result=baseSwitch.apply(this,arguments);if(id==='restore')renderRestore();return result};
  window.AmoRecovery={commitDocumentTransaction,renderRestore,currentSnapshot,desiredAtTransaction,backupSnapshot};
})();
