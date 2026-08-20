/* Storage scaling: lazy published-report loading and archive stale terminal Demand. */
const ARCHIVE_ROOT='archive';
const ARCHIVE_AFTER_DAYS=28;
const TERMINAL_DEMAND_RE=/^(complete|completed|closed|cancelled|canceled|rejected|reject|declined|withdrawn|abandoned|superseded)$/i;

function terminalDemandStatus(status){return TERMINAL_DEMAND_RE.test(String(status||'').trim())}
function archiveReferenceDate(d){const raw=d?.modifiedAt||d?.updatedAt||d?.createdAt||'';if(!raw)return null;const date=new Date(raw);return Number.isNaN(date.getTime())?null:date}
function demandReadyForArchive(d,now=new Date()){
  if(!terminalDemandStatus(d?.status))return false;
  const changed=archiveReferenceDate(d);if(!changed)return false;
  return now.getTime()-changed.getTime()>=ARCHIVE_AFTER_DAYS*24*60*60*1000
}
async function overwriteArchivedJson(root,entity,record){
  const archive=await root.getDirectoryHandle(ARCHIVE_ROOT,{create:true});
  const dir=await archive.getDirectoryHandle(entity,{create:true});
  await writeJson(dir,`${record.id}.json`,record)
}
async function removeActiveJson(root,entity,id){
  try{const dir=await root.getDirectoryHandle(entity);await dir.removeEntry(`${id}.json`)}catch(e){if(e.name!=='NotFoundError')throw e}
}
async function archiveStaleTerminalDemand(root=workspaceHandle){
  if(!root||!db?.demand?.length)return{demand:0,allocations:0};
  const candidates=db.demand.filter(d=>demandReadyForArchive(d));
  if(!candidates.length)return{demand:0,allocations:0};
  if(!await ensureRW(root)){log('Archive maintenance skipped because read/write permission is unavailable.');return{demand:0,allocations:0}}
  const ids=new Set(candidates.map(d=>d.id));
  const allocations=db.allocations.filter(a=>ids.has(a.demandId));
  /* Write archive copies first. A failed delete therefore leaves a safe duplicate for retry next load. */
  for(const d of candidates)await overwriteArchivedJson(root,'demand',d);
  for(const a of allocations)await overwriteArchivedJson(root,'allocations',a);
  for(const d of candidates)await removeActiveJson(root,'demand',d.id);
  for(const a of allocations)await removeActiveJson(root,'allocations',a.id);
  db.demand=db.demand.filter(d=>!ids.has(d.id));
  const allocationIds=new Set(allocations.map(a=>a.id));
  db.allocations=db.allocations.filter(a=>!allocationIds.has(a.id));
  /* Draft reporting is working state, so remove entries for Demand that has left the active set. */
  if(typeof statusReportDraft!=='undefined'&&Array.isArray(statusReportDraft.entries)){
    const before=statusReportDraft.entries.length;
    statusReportDraft.entries=statusReportDraft.entries.filter(e=>!ids.has(e.demandId));
    if(statusReportDraft.entries.length!==before){
      const reports=await root.getDirectoryHandle('status-reports',{create:true});
      await writeJson(reports,'draft.json',statusReportDraft)
    }
  }
  log(`Archived ${candidates.length} terminal Demand record${candidates.length===1?'':'s'} and ${allocations.length} related allocation${allocations.length===1?'':'s'} older than ${ARCHIVE_AFTER_DAYS} days.`);
  return{demand:candidates.length,allocations:allocations.length}
}

/* Published report catalogue: enumerate filenames only. Only draft.json is parsed at workspace load. */
function statusReportStubFromFilename(name){
  if(name==='draft.json'||!name.toLowerCase().endsWith('.json'))return null;
  const id=name.slice(0,-5),m=/^SR-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(id);
  const reportingDate=m?`${m[1]}-${m[2]}-${m[3]}`:'';
  const publishedAt=m?`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`:'';
  return{id,status:'Published',reportingDate,publishedAt,entries:null,_lazy:true,_fileName:name}
}
loadStatusReports=async function(root){
  statusReportDraft={id:'DRAFT',status:'Draft',reportingDate:todayIso(),entries:[]};statusReports=[];
  try{
    const dir=await root.getDirectoryHandle('status-reports');
    for await(const [name,h] of dir.entries()){
      if(h.kind!=='file'||!name.toLowerCase().endsWith('.json'))continue;
      if(name==='draft.json'){
        try{statusReportDraft=await readJsonFile(h)}catch(e){log(`Could not read status report draft: ${e.message}`)}
        continue
      }
      const stub=statusReportStubFromFilename(name);if(stub)statusReports.push(stub)
    }
  }catch(e){if(e.name!=='NotFoundError')throw e}
  statusReportDraft.reportingDate=statusReportDraft.reportingDate||todayIso();
  statusReports.sort((a,b)=>String(b.id).localeCompare(String(a.id)))
};
async function loadPublishedStatusReport(id){
  const existing=statusReports.find(r=>r.id===id);if(!existing)return null;if(!existing._lazy)return existing;
  if(!workspaceHandle)return null;
  try{
    const dir=await workspaceHandle.getDirectoryHandle('status-reports'),h=await dir.getFileHandle(existing._fileName||`${id}.json`),record=await readJsonFile(h);
    const idx=statusReports.findIndex(r=>r.id===id);if(idx>=0)statusReports[idx]=record;
    return record
  }catch(e){alert(`Could not load status report ${id}: ${e.message}`);log(`ERROR loading status report ${id}: ${e.message}`);return null}
}
latestReport=function(){return statusReports.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id)))[0]||null};
renderLatestReportCard=function(){
  const el=$('latestStatusReport');if(!el)return;const r=latestReport();
  el.innerHTML=r?`<div class="report-card"><div class="flex" style="justify-content:space-between"><div><strong>Latest published report</strong><div class="muted">${escHtml(r.reportingDate||'')} · ${r._lazy?'loads on View':`${r.entries?.length||0} reported items`}</div></div><button class="btn" id="viewLatestStatus">View</button></div></div>`:'<div class="notice">No status reports have been published yet.</div>';
  $('viewLatestStatus')?.addEventListener('click',async()=>{const report=await loadPublishedStatusReport(r.id);if(report)openStatusReportModal(report)})
};
renderStatusHistory=function(){
  const table=$('statusHistoryTable');if(!table)return;const rows=statusReports.slice().sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  table.innerHTML=`<thead><tr><th>Report ID</th><th>Reporting Date</th><th>Published</th><th>Items</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr data-report-id="${escHtml(r.id)}"><td><strong>${escHtml(r.id)}</strong></td><td>${escHtml(r.reportingDate||'—')}</td><td>${r.publishedAt?escHtml(new Date(r.publishedAt).toLocaleString()):'—'}</td><td>${r._lazy?'<span class="muted">Load on view</span>':(r.entries?.length||0)}</td><td><button class="btn" data-view-report="${escHtml(r.id)}">View</button></td></tr>`).join('')}</tbody>`;
  table.querySelectorAll('[data-view-report]').forEach(b=>b.onclick=async()=>{const report=await loadPublishedStatusReport(b.dataset.viewReport);if(report){renderStatusHistory();openStatusReportModal(report)}});
  $('statusHistoryCount').textContent=`${rows.length} published report${rows.length===1?'':'s'} available.`
};

/* Run archive maintenance after the complete normal workspace-open pipeline. Loaded before workspace-memory so reconnect uses this wrapper too. */
const scalingOpenWorkspace=openWorkspace;
openWorkspace=async function(){
  await scalingOpenWorkspace();if(!workspaceHandle)return;
  try{
    const moved=await archiveStaleTerminalDemand(workspaceHandle);
    if(moved.demand){resetEdits();refreshAll();renderStatusReporting();renderStatusHistory();updateBanner()}
  }catch(e){log(`Archive maintenance failed: ${e.message}`)}
};
const scalingOpenBtn=$('openWorkspaceBtn');if(scalingOpenBtn)scalingOpenBtn.onclick=()=>openWorkspace();
