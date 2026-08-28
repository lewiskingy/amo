/* Status Reporting lifecycle, collaborative draft merge, previous-report context and accessible Health presentation.
   Active cycle: Draft <-> Published; New Draft finalises Published and starts the next cycle.
   Draft saves use baseline/local/latest three-way merge at entry-field granularity. */
(function initStatusReportCollaboration(){
  if(window.__amoStatusReportCollaborationLoaded)return;window.__amoStatusReportCollaborationLoaded=true;

  const DRAFT_FILE='draft.json',LOCK_RESOURCE='status-report--draft',LOCK_STALE_MS=30000;
  const ENTRY_FIELDS=['health','statusUpdate','achievements','issues'];
  const HEALTH_MAP={Green:'On Track',Amber:'At Risk',Red:'Off Track','On Track':'On Track','At Risk':'At Risk','Off Track':'Off Track'};
  const clean=v=>String(v??'');
  const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  const nowIso=()=>new Date().toISOString();
  const actor=()=>{const u=typeof localWorkspaceUser==='function'?localWorkspaceUser():null;return{id:u?.id||'',name:u?.displayName||'Workspace User'}};
  const normalizedHealth=v=>HEALTH_MAP[clean(v).trim()]||clean(v).trim();
  const currentCycleStatus=()=>statusReportDraft?.status==='Published'?'Published':'Draft';
  const reportEntryById=(entries,id)=>(entries||[]).find(e=>e.demandId===id)||null;
  const previousEntry=id=>reportEntryById(statusReportDraft?.previousEntries,id);
  const activePublishedReport=()=>{const id=statusReportDraft?.publishedReportId;return id?statusReports.find(r=>r.id===id)||null:null};

  statusReportState.draftBaseline=statusReportState.draftBaseline||null;
  statusReportState.savingDraft=false;

  function normalizeEntry(entry){
    const e=clone(entry||{});const health=normalizedHealth(e.health||e.rag);if(health)e.health=health;else delete e.health;delete e.rag;delete e.healthChanged;return e
  }
  function normalizeDraft(draft){
    const d=clone(draft||{});d.id='DRAFT';d.status=d.status==='Published'?'Published':'Draft';d.reportingDate=d.reportingDate||todayIso();d.entries=(d.entries||[]).map(normalizeEntry);d.previousEntries=(d.previousEntries||[]).map(normalizeEntry);return d
  }
  function draftEntryMap(draft){return new Map((draft?.entries||[]).map(e=>[e.demandId,normalizeEntry(e)]))}
  function mergeDrafts(baseline,local,latest){
    const base=normalizeDraft(baseline||{}),ours=normalizeDraft(local||{}),theirs=normalizeDraft(latest||{}),out=clone(theirs),conflicts=[];
    const bm=draftEntryMap(base),om=draftEntryMap(ours),tm=draftEntryMap(theirs),ids=new Set([...bm.keys(),...om.keys(),...tm.keys()]);out.entries=[];
    for(const id of ids){
      const b=bm.get(id)||{demandId:id},o=om.get(id)||{demandId:id},t=tm.get(id)||{demandId:id},m={...t,demandId:id};
      for(const field of ENTRY_FIELDS){const bv=b[field]??'',ov=o[field]??'',tv=t[field]??'';if(equal(ov,bv))m[field]=tv;else if(equal(tv,bv)||equal(ov,tv))m[field]=ov;else conflicts.push(`${id} · ${field}`)}
      if(reportHasContent(m)||m.health)out.entries.push(m)
    }
    out.previousReportId=theirs.previousReportId||ours.previousReportId||base.previousReportId||null;
    out.previousEntries=clone(theirs.previousEntries||ours.previousEntries||base.previousEntries||[]);
    out.version=(Number(theirs.version)||0)+1;out.modifiedAt=nowIso();out.modifiedBy=actor().name;
    return{merged:out,conflicts}
  }

  function lockOwner(){const u=actor();return{userId:u.id,userDisplayName:u.name,sessionId:typeof lockSessionId!=='undefined'?lockSessionId:''}}
  async function acquireDraftLock(){
    const repo=window.workspaceRepository;if(!repo)throw new Error('No workspace repository is connected.');
    if(repo.mode==='remote')return repo.request(`/api/commit-locks/${encodeURIComponent(LOCK_RESOURCE)}`,{method:'POST',body:JSON.stringify(lockOwner())});
    if(repo.ensureWritePermission&&!await repo.ensureWritePermission())throw new Error('Read/write permission is required to save the status report.');
    const path=`.locks/${LOCK_RESOURCE}.lock.json`,existing=await repo.readLock(path),age=Date.now()-Date.parse(existing?.createdAt||'');
    if(existing&&Number.isFinite(age)&&age<LOCK_STALE_MS)throw new Error('The status report is currently being committed by another session. Try again.');
    if(existing)await repo.deleteLock(path);
    const token=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,record={type:'amo-commit-lock',resource:LOCK_RESOURCE,token,createdAt:nowIso(),...lockOwner()};
    await repo.writeLock(record,path);await new Promise(r=>setTimeout(r,60+Math.floor(Math.random()*60)));const verify=await repo.readLock(path);if(verify?.token!==token)throw new Error('The status report is currently being committed by another session. Try again.');return record
  }
  async function releaseDraftLock(lock){
    if(!lock)return;const repo=window.workspaceRepository;if(!repo)return;
    if(repo.mode==='remote'){try{await repo.request(`/api/commit-locks/${encodeURIComponent(LOCK_RESOURCE)}`,{method:'DELETE',body:JSON.stringify({token:lock.token})})}catch(e){log?.(`Could not release status-report commit lock: ${e.message}`)}return}
    const path=`.locks/${LOCK_RESOURCE}.lock.json`;try{const current=await repo.readLock(path);if(current?.token===lock.token)await repo.deleteLock(path)}catch(e){log?.(`Could not release status-report commit lock: ${e.message}`)}
  }
  async function readLatestDraft(){try{return normalizeDraft(await window.workspaceRepository.getStatusReport(DRAFT_FILE))}catch(e){return normalizeDraft(statusReportDraft)}}
  async function writeDraft(record){await window.workspaceRepository.saveStatusReport(DRAFT_FILE,record)}
  async function writeReport(record){await window.workspaceRepository.saveStatusReport(record.id,record)}

  function beginDraftEdit(){
    if(currentCycleStatus()!=='Draft')return;statusReportState.editing=true;statusReportState.draftBaseline=normalizeDraft(statusReportDraft);statusReportState.draftBuffer=clone(statusReportState.draftBaseline);renderStatusReporting()
  }
  function cancelDraftEdit(){statusReportState.editing=false;statusReportState.draftBuffer=null;statusReportState.draftBaseline=null;renderStatusReporting()}

  async function saveDraftCollaboratively(){
    if(!statusReportState.editing||!statusReportState.draftBuffer||statusReportState.savingDraft)return false;statusReportState.savingDraft=true;let lock=null;
    try{
      lock=await acquireDraftLock();const latest=await readLatestDraft();if(latest.status==='Published'){alert('This reporting cycle was published while you were editing. Your local changes have not been written. Unpublish the report before editing it again.');return false}
      const local=normalizeDraft(statusReportState.draftBuffer),baseline=normalizeDraft(statusReportState.draftBaseline||statusReportDraft),{merged,conflicts}=mergeDrafts(baseline,local,latest);
      if(conflicts.length){alert(`The draft changed in another session in the same field(s):\n\n${conflicts.join('\n')}\n\nReload/reopen Edit Draft and reconcile those fields before saving.`);return false}
      await writeDraft(merged);statusReportDraft=merged;statusReportState.editing=false;statusReportState.draftBuffer=null;statusReportState.draftBaseline=null;statusReportState.draftDirty=false;log?.('Saved status report draft with optimistic merge.');updateBanner?.();renderStatusReporting();return true
    }catch(e){alert(`Could not save Status Report draft: ${e.message}`);return false}finally{statusReportState.savingDraft=false;await releaseDraftLock(lock)}
  }
  saveStatusDraft=saveDraftCollaboratively;

  function buildReportFromDraft(draft,id,status='Published'){
    const entries=reportingRows(draft).filter(x=>reportHasContent(x.entry)).map(({demand:d,entry:e})=>snapshotStatusEntry(d,normalizeEntry(e)));
    const previous=statusReports.find(r=>r.id===draft.previousReportId)||null;return{id,status,reportingDate:draft.reportingDate||todayIso(),previousReportId:draft.previousReportId||null,entries,revision:1,previousPublishedAt:previous?.publishedAt||null}
  }
  function applyPublishedHealth(draft){
    for(const e of draft.entries||[]){const d=db.demand.find(x=>x.id===e.demandId),health=normalizedHealth(e.health||e.rag);if(!d||!health||health===normalizedHealth(d.health))continue;d.health=health;d.version=(Number(d.version)||0)+1;d.modifiedAt=nowIso();markDirty?.('demand',d.id,`Updated ${d.id} Health to ${health} from published Status Report.`)}
  }
  function replaceReportInMemory(report){const i=statusReports.findIndex(r=>r.id===report.id);if(i>=0)statusReports.splice(i,1,report);else statusReports.unshift(report);statusReports.sort((a,b)=>clean(b.publishedAt||b.finalizedAt).localeCompare(clean(a.publishedAt||a.finalizedAt)))}

  publishStatusReport=async function(){
    if(statusReportState.editing){const ok=await saveDraftCollaboratively();if(!ok)return}
    let lock=null;try{
      lock=await acquireDraftLock();const draft=await readLatestDraft();if(draft.status==='Published'){alert('This reporting cycle is already published.');return}
      const preview=buildReportFromDraft(draft,draft.publishedReportId||statusReportId(),'Published');if(!preview.entries.length){alert('Add at least one Status Update, Achievement, Issue or Health change before publishing.');return}
      if(!confirm(`Publish the latest committed draft with ${preview.entries.length} reported demand item${preview.entries.length===1?'':'s'}? You can Unpublish it for correction until New Draft is chosen.`))return;
      applyPublishedHealth(draft);const existing=draft.publishedReportId?statusReports.find(r=>r.id===draft.publishedReportId):null,u=actor(),publishedAt=nowIso();const report={...preview,id:draft.publishedReportId||preview.id,status:'Published',revision:(Number(existing?.revision)||0)+1,publishedAt,publishedBy:u.name,finalizedAt:null,finalizedBy:null,unpublishedAt:null,unpublishedBy:null};
      const cycle={...draft,status:'Published',publishedReportId:report.id,publishedAt,publishedBy:u.name,revision:report.revision,modifiedAt:publishedAt,modifiedBy:u.name};await writeReport(report);await writeDraft(cycle);replaceReportInMemory(report);statusReportDraft=cycle;statusReportState.draftDirty=false;requestAutosave?.();renderStatusReporting();renderStatusHistory();openStatusReportModal(report)
    }catch(e){alert(`Could not publish Status Report: ${e.message}`)}finally{await releaseDraftLock(lock)}
  };

  async function unpublishStatusReport(){
    if(currentCycleStatus()!=='Published')return;if(!confirm('Unpublish the current report and reopen it as the editable draft?'))return;let lock=null;
    try{lock=await acquireDraftLock();const draft=await readLatestDraft();if(draft.status!=='Published')throw new Error('The current reporting cycle is no longer Published.');const report=statusReports.find(r=>r.id===draft.publishedReportId)||await window.workspaceRepository.getStatusReport(draft.publishedReportId),u=actor(),when=nowIso();const unpublished={...report,status:'Unpublished',unpublishedAt:when,unpublishedBy:u.name},reopened={...draft,status:'Draft',modifiedAt:when,modifiedBy:u.name};await writeReport(unpublished);await writeDraft(reopened);replaceReportInMemory(unpublished);statusReportDraft=reopened;statusReportState.draftDirty=false;renderStatusReporting();renderStatusHistory();log?.(`Unpublished status report ${report.id}.`)}catch(e){alert(`Could not unpublish Status Report: ${e.message}`)}finally{await releaseDraftLock(lock)}
  }

  async function startNewDraft(){
    if(currentCycleStatus()!=='Published')return;if(!confirm('Finalise the current published report and start the next reporting cycle? Once finalised, this report cannot be unpublished.'))return;let lock=null;
    try{lock=await acquireDraftLock();const draft=await readLatestDraft();if(draft.status!=='Published'||!draft.publishedReportId)throw new Error('There is no current Published report to finalise.');const current=statusReports.find(r=>r.id===draft.publishedReportId)||await window.workspaceRepository.getStatusReport(draft.publishedReportId),u=actor(),when=nowIso();const final={...current,status:'Final',finalizedAt:when,finalizedBy:u.name};await writeReport(final);const next={id:'DRAFT',status:'Draft',reportingDate:todayIso(),previousReportId:final.id,previousEntries:clone(final.entries||[]),entries:[],version:1,createdAt:when,createdBy:u.name};await writeDraft(next);replaceReportInMemory(final);statusReportDraft=next;statusReportState.editing=false;statusReportState.draftBuffer=null;statusReportState.draftBaseline=null;statusReportState.draftDirty=false;renderStatusReporting();renderStatusHistory();log?.(`Finalised ${final.id} and created a new Status Report draft.`)}catch(e){alert(`Could not create new Status Report draft: ${e.message}`)}finally{await releaseDraftLock(lock)}
  }

  function statusBadge(status){const tone=status==='Published'?'green':status==='Final'?'blue':status==='Draft'?'amber':'';return`<span class="pill ${tone}">${escHtml(status)}</span>`}
  renderStatusToolbar=function(){
    const el=$('statusReportToolbar');if(!el)return;const source=statusReportState.editing?statusReportState.draftBuffer:statusReportDraft,updated=reportingRows(source).filter(x=>reportHasContent(x.entry)).length,total=db.demand.filter(isOpenDemand).length,status=currentCycleStatus(),published=activePublishedReport();
    if(statusReportState.editing)el.innerHTML='<button class="btn success" id="saveStatusDraft">Save Draft</button><button class="btn" id="cancelStatusDraft">Cancel</button><button class="btn" id="previewStatusDraft">Preview</button>';
    else if(status==='Published')el.innerHTML='<button class="btn" id="viewCurrentPublished">View Published</button><button class="btn" id="unpublishStatusReport">Unpublish</button><button class="btn primary" id="newStatusDraft">New Draft</button>';
    else el.innerHTML=`<button class="btn primary" id="editStatusDraft" ${workspaceHandle?'':'disabled'}>Edit Draft</button><button class="btn" id="previewStatusDraft" ${updated?'':'disabled'}>Preview</button><button class="btn primary" id="publishStatusDraft" ${updated?'':'disabled'}>Publish</button>`;
    const previous=statusReportDraft?.previousReportId?` · Previous: ${escHtml(statusReportDraft.previousReportId)}`:'';$('statusReportProgress').innerHTML=`<span class="status-cycle-summary">${statusBadge(status)} <strong>${escHtml(statusReportDraft.reportingDate||todayIso())}</strong> · ${updated} of ${total} open demand items have reporting updates${previous}${published?.revision>1?` · Revision ${published.revision}`:''}</span>`;
    $('editStatusDraft')?.addEventListener('click',beginDraftEdit);$('cancelStatusDraft')?.addEventListener('click',cancelDraftEdit);$('saveStatusDraft')?.addEventListener('click',saveDraftCollaboratively);$('previewStatusDraft')?.addEventListener('click',()=>openStatusReportModal(buildPreviewReport()));$('publishStatusDraft')?.addEventListener('click',publishStatusReport);$('viewCurrentPublished')?.addEventListener('click',()=>published&&openStatusReportModal(published));$('unpublishStatusReport')?.addEventListener('click',unpublishStatusReport);$('newStatusDraft')?.addEventListener('click',startNewDraft)
  };

  function previousFieldHtml(id,field,current){const prev=previousEntry(id),value=field==='health'?normalizedHealth(prev?.health||prev?.rag):clean(prev?.[field]);if(!value)return'';const changed=clean(current)!==clean(value),label=changed?'Changed':'Unchanged';return `<details class="previous-report-detail"><summary>Previous · ${label}</summary><div class="previous-report-content"><div>${escHtml(value)}</div><button type="button" class="btn previous-copy" data-copy-previous="${field}" data-copy-demand="${escHtml(id)}">Copy previous</button></div></details>`}
  function decoratePreviousContext(){
    if(!statusReportState.editing||!statusReportDraft?.previousEntries?.length)return;document.querySelectorAll('#statusReportTable tr[data-status-demand]').forEach(tr=>{const id=tr.dataset.statusDemand,entry=reportEntryById(statusReportState.draftBuffer?.entries,id)||{},cells=tr.children;if(!cells?.length)return;
      [['health',4],['statusUpdate',5],['achievements',6],['issues',7]].forEach(([field,index])=>{const cell=cells[index];if(!cell||cell.querySelector(`.previous-report-detail[data-prev-field="${field}"]`))return;const current=field==='health'?normalizedHealth(entry.health||entry.rag):clean(entry[field]),html=previousFieldHtml(id,field,current);if(!html)return;const wrap=document.createElement('div');wrap.dataset.prevField=field;wrap.innerHTML=html;const detail=wrap.firstElementChild;if(detail)detail.dataset.prevField=field;cell.appendChild(detail)});
      if(!tr.querySelector('[data-copy-previous-all]')&&previousEntry(id)){const btn=document.createElement('button');btn.type='button';btn.className='btn previous-copy-all';btn.dataset.copyPreviousAll=id;btn.textContent='Copy previous';cells[0]?.appendChild(btn)}
    });
    document.querySelectorAll('[data-copy-previous]').forEach(btn=>btn.onclick=()=>copyPreviousField(btn.dataset.copyDemand,btn.dataset.copyPrevious));document.querySelectorAll('[data-copy-previous-all]').forEach(btn=>btn.onclick=()=>copyPreviousAll(btn.dataset.copyPreviousAll))
  }
  function ensureDraftEntry(id){let e=statusReportState.draftBuffer.entries.find(x=>x.demandId===id);if(!e){e={demandId:id};statusReportState.draftBuffer.entries.push(e)}return e}
  function copyPreviousField(id,field){const prev=previousEntry(id);if(!prev)return;const e=ensureDraftEntry(id);if(field==='health')e.health=normalizedHealth(prev.health||prev.rag);else e[field]=prev[field]||'';renderStatusReporting()}
  function copyPreviousAll(id){const prev=previousEntry(id);if(!prev)return;const e=ensureDraftEntry(id);for(const f of ENTRY_FIELDS)e[f]=f==='health'?normalizedHealth(prev.health||prev.rag):(prev[f]||'');renderStatusReporting()}

  function healthTone(v){const h=normalizedHealth(v);return h==='On Track'?'green':h==='At Risk'?'amber':h==='Off Track'?'red':'unset'}
  function decorateHealth(){
    document.querySelectorAll('#statusReportTable tr[data-status-demand]').forEach(tr=>{const cell=tr.children?.[4];if(!cell)return;const select=cell.querySelector('[data-status-field="rag"]'),text=select?.value||cell.textContent,tone=healthTone(text);cell.classList.remove('health-cell-green','health-cell-amber','health-cell-red','health-cell-unset');cell.classList.add(`health-cell-${tone}`);if(select&&!select.dataset.healthToneBound){select.dataset.healthToneBound='true';select.addEventListener('change',()=>decorateHealth())}});
    document.querySelectorAll('#recordModalBody .report-entry').forEach(entry=>{const dot=entry.querySelector('.rag-dot,.health-green,.health-amber,.health-red,.health-unset');let tone='unset';for(const t of ['green','amber','red'])if(dot?.classList.contains(`health-${t}`)||dot?.classList.contains(`rag-${t[0].toUpperCase()+t.slice(1)}`))tone=t;entry.classList.remove('report-health-green','report-health-amber','report-health-red','report-health-unset');entry.classList.add(`report-health-${tone}`);entry.querySelector('.report-entry-head > div:last-child')?.classList.add('report-health-label')})
  }

  const baseRenderStatusCollab=renderStatusReporting;
  renderStatusReporting=function(){const r=baseRenderStatusCollab();renderStatusToolbar();decoratePreviousContext();decorateHealth();return r};

  latestReport=function(){return statusReports.filter(r=>r.status==='Published'||r.status==='Final').sort((a,b)=>clean(b.publishedAt||b.finalizedAt).localeCompare(clean(a.publishedAt||a.finalizedAt)))[0]||null};
  renderLatestReportCard=function(){const el=$('latestStatusReport');if(!el)return;const current=activePublishedReport(),r=current||latestReport();if(!r){el.innerHTML='<div class="notice">No status reports have been published yet.</div>';return}const label=current?'Current published report':'Latest final report';el.innerHTML=`<div class="report-card"><div class="flex" style="justify-content:space-between"><div><strong>${label}</strong><div class="muted">${escHtml(r.reportingDate||'')} · ${r.entries?.length||0} reported items · ${escHtml(r.status)}</div></div><button class="btn" id="viewLatestStatus">View</button></div></div>`;$('viewLatestStatus')?.addEventListener('click',()=>openStatusReportModal(r))};
  renderStatusHistory=function(){const table=$('statusHistoryTable');if(!table)return;const rows=statusReports.filter(r=>r.status!=='Unpublished').slice().sort((a,b)=>clean(b.publishedAt||b.finalizedAt).localeCompare(clean(a.publishedAt||a.finalizedAt)));table.innerHTML=`<thead><tr><th>Report ID</th><th>State</th><th>Reporting Date</th><th>Published</th><th>Published By</th><th>Items</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr data-report-id="${r.id}"><td><strong>${escHtml(r.id)}</strong></td><td>${statusBadge(r.status||'Final')}</td><td>${escHtml(r.reportingDate||'—')}</td><td>${r.publishedAt?new Date(r.publishedAt).toLocaleString():'—'}</td><td>${escHtml(r.publishedBy||'—')}</td><td>${r.entries?.length||0}</td><td><button class="btn" data-view-report="${r.id}">View</button></td></tr>`).join('')}</tbody>`;table.querySelectorAll('[data-view-report]').forEach(b=>b.onclick=()=>openStatusReportModal(statusReports.find(r=>r.id===b.dataset.viewReport)));$('statusHistoryCount').textContent=`${rows.length} published/final report${rows.length===1?'':'s'}.`};

  const baseNarrativeLifecycle=reportNarrativeHtml;
  reportNarrativeHtml=function(report){let html=baseNarrativeLifecycle(report);if(report?.status==='Final')html=html.replace('<span class="pill amber">Final</span>','<span class="pill blue">Final</span>');return html};

  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const backdrop=$('recordModalBackdrop');if(!backdrop?.classList.contains('open'))return;if(typeof recordModalState!=='undefined'&&recordModalState.type==='status-report'){e.preventDefault();const close=$('closeStatusReport');if(close)close.click();else if(typeof closeRecordModal==='function')closeRecordModal()}});
  const modalObserver=new MutationObserver(()=>decorateHealth());const modalBody=$('recordModalBody');if(modalBody)modalObserver.observe(modalBody,{childList:true,subtree:true});

  const style=document.createElement('style');style.id='status-report-collaboration-styles';style.textContent=`
    .status-cycle-summary{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}.previous-report-detail{margin-top:7px;border-top:1px solid var(--line);padding-top:6px;font-size:.73rem}.previous-report-detail summary{cursor:pointer;font-weight:700;color:var(--muted)}.previous-report-content{display:grid;gap:7px;margin-top:6px;padding:8px;border-radius:8px;background:var(--soft);white-space:pre-wrap}.previous-copy{justify-self:start;padding:4px 7px;font-size:.7rem}.previous-copy-all{margin-top:7px;padding:4px 7px;font-size:.7rem}.health-cell-green{box-shadow:inset 5px 0 0 #1b7f5a;background:rgba(27,127,90,.08)}.health-cell-amber{box-shadow:inset 5px 0 0 #d88a00;background:rgba(216,138,0,.09)}.health-cell-red{box-shadow:inset 5px 0 0 #b42318;background:rgba(180,35,24,.08)}.health-cell-unset{box-shadow:inset 5px 0 0 #98a2b3}.report-entry{border-left-width:6px}.report-health-green{border-left-color:#1b7f5a}.report-health-amber{border-left-color:#d88a00}.report-health-red{border-left-color:#b42318}.report-health-unset{border-left-color:#98a2b3}.report-health-green .report-entry-head{background:rgba(27,127,90,.08)}.report-health-amber .report-entry-head{background:rgba(216,138,0,.09)}.report-health-red .report-entry-head{background:rgba(180,35,24,.08)}.report-health-label{font-weight:800}.status-modal{width:min(1500px,96vw)!important;max-width:none!important;max-height:92vh}.status-modal #recordModalBody{overflow:auto;min-height:0}.status-modal .report-card{max-width:none}.status-modal .report-narrative p{max-width:70ch}.status-modal-maximized .report-narrative p{max-width:78ch}@media(max-width:800px){.status-modal{width:97vw!important;max-height:96vh}.previous-report-content{font-size:.78rem}}
  `;document.head.appendChild(style);

  renderStatusReporting();renderStatusHistory();
})();
