/* Status Report authoring/viewer host. Report presentation is delegated to AmoReportRenderer. */
(function initStatusReportUi(){
  if(window.__amoStatusReportUiLoaded)return;window.__amoStatusReportUiLoaded=true;
  const ORG='organization',ALL='department',PREVIEW_PREFIX='amo.statusReportPreview.',PREVIEW_TTL_MS=10*60*1000;
  let modalReport=null,modalScope={departmentId:ORG,teamId:ALL};

  function ensureRendererStyles(){
    if(!document.querySelector('link[data-amo-report-viewer-styles]')){const l=document.createElement('link');l.rel='stylesheet';l.href=typeof amoAsset==='function'?amoAsset('reports/report-viewer.css'):'reports/report-viewer.css';l.dataset.amoReportViewerStyles='true';document.head.appendChild(l)}
  }
  function ensureRenderer(){
    if(window.AmoReportRenderer)return Promise.resolve(window.AmoReportRenderer);
    return new Promise((resolve,reject)=>{let s=document.querySelector('script[data-amo-report-renderer]');if(s){s.addEventListener('load',()=>resolve(window.AmoReportRenderer),{once:true});s.addEventListener('error',reject,{once:true});return}s=document.createElement('script');s.src=typeof amoAsset==='function'?amoAsset('app-report-renderer.js'):'app-report-renderer.js';s.dataset.amoReportRenderer='true';s.onload=()=>resolve(window.AmoReportRenderer);s.onerror=()=>reject(new Error('Could not load the Status Report renderer.'));document.head.appendChild(s)})
  }
  function hierarchy(){return window.amoOrganizationHierarchy}
  function departments(){return hierarchy()?.configuredDepartments?.()||[]}
  function teams(){return typeof configuredTeams==='function'?configuredTeams():[]}
  function reportCatalog(){
    const depMap=new Map(),teamMap=new Map();
    for(const e of modalReport?.entries||[]){
      if(e.departmentId&&!depMap.has(e.departmentId))depMap.set(e.departmentId,{id:e.departmentId,name:e.departmentName||e.departmentId});
      if(e.teamId&&!teamMap.has(e.teamId))teamMap.set(e.teamId,{id:e.teamId,name:e.teamName||e.teamId,departmentId:e.departmentId||''})
    }
    for(const d of departments())if(d?.id&&!depMap.has(d.id))depMap.set(d.id,d);
    for(const t of teams())if(t?.id&&!teamMap.has(t.id))teamMap.set(t.id,t);
    return{departments:[...depMap.values()],teams:[...teamMap.values()],teamsById:Object.fromEntries(teamMap)}
  }
  function scopeInfo(catalog=reportCatalog()){
    const dep=modalScope.departmentId,team=modalScope.teamId,depRow=catalog.departments.find(d=>d.id===dep),teamRow=catalog.teams.find(t=>t.id===team);
    return{departmentId:dep,teamId:team,departmentName:depRow?.name||'',teamName:teamRow?.name||'',label:dep===ORG?'Whole organisation':team===ALL?(depRow?.name||'Whole department'):[depRow?.name,teamRow?.name].filter(Boolean).join(' · ')}
  }
  function draftPreview(report){return report?.status==='Draft Preview'}
  function reportSourceMode(){return window.workspaceRepository?.mode||(typeof getLastConnectionPreference==='function'?getLastConnectionPreference()?.mode:null)||'remote'}
  function reportUrl(report,scope=modalScope){
    if(window.AmoReportLinks?.reportUrl)return window.AmoReportLinks.reportUrl(report.id,reportSourceMode(),scope);
    const u=new URL(`/reports/${encodeURIComponent(report.id)}`,location.origin);if(reportSourceMode()==='local')u.searchParams.set('source','local');if(scope?.departmentId&&scope.departmentId!==ORG)u.searchParams.set('department',scope.departmentId);if(scope?.teamId&&scope.teamId!==ALL)u.searchParams.set('team',scope.teamId);return u.href
  }
  function cleanupPreviewSnapshots(){
    try{const now=Date.now();for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(!key?.startsWith(PREVIEW_PREFIX))continue;try{const value=JSON.parse(localStorage.getItem(key)||'null');if(!value?.createdAt||now-value.createdAt>PREVIEW_TTL_MS)localStorage.removeItem(key)}catch(_e){localStorage.removeItem(key)}}}catch(_e){}
  }
  function draftPreviewUrl(report,scope=modalScope){
    cleanupPreviewSnapshots();const token=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try{localStorage.setItem(`${PREVIEW_PREFIX}${token}`,JSON.stringify({createdAt:Date.now(),report:clone(report)}))}catch(_e){throw new Error('This browser could not create a temporary Draft Preview for a new window.')}
    const u=new URL('/reports/preview',location.origin);u.searchParams.set('preview',token);if(scope?.departmentId&&scope.departmentId!==ORG)u.searchParams.set('department',scope.departmentId);if(scope?.teamId&&scope.teamId!==ALL)u.searchParams.set('team',scope.teamId);return u.href
  }
  function openReportWindow(report,scope=modalScope){
    try{const url=draftPreview(report)?draftPreviewUrl(report,scope):reportUrl(report,scope);window.open(url,'_blank','noopener')}catch(e){alert(e.message||'Could not open this Status Report.')}
  }
  function departmentOptions(catalog){return `<option value="${ORG}" ${modalScope.departmentId===ORG?'selected':''}>Organisation-wide</option>${catalog.departments.map(d=>`<option value="${escHtml(d.id)}" ${modalScope.departmentId===d.id?'selected':''}>${escHtml(d.name)}</option>`).join('')}`}
  function teamOptions(catalog){
    if(modalScope.departmentId===ORG)return'<option value="department">All teams</option>';
    const available=catalog.teams.filter(t=>!t.departmentId||t.departmentId===modalScope.departmentId);
    return `<option value="${ALL}" ${modalScope.teamId===ALL?'selected':''}>Whole department</option>${available.map(t=>`<option value="${escHtml(t.id)}" ${modalScope.teamId===t.id?'selected':''}>${escHtml(t.name)}</option>`).join('')}`
  }
  function normalizeModalScope(catalog){
    if(modalScope.departmentId!==ORG&&!catalog.departments.some(d=>d.id===modalScope.departmentId))modalScope={departmentId:ORG,teamId:ALL};
    if(modalScope.teamId!==ALL&&!catalog.teams.some(t=>t.id===modalScope.teamId&&(!t.departmentId||t.departmentId===modalScope.departmentId)))modalScope.teamId=ALL
  }
  function renderScopedReport(catalog=reportCatalog()){
    normalizeModalScope(catalog);const content=$('statusModalReportContent');if(content)content.innerHTML=AmoReportRenderer.renderReport(modalReport,{scope:scopeInfo(catalog),catalog})
  }
  function refreshTeamControl(catalog=reportCatalog()){
    normalizeModalScope(catalog);const team=$('statusModalTeam');if(!team)return;team.disabled=modalScope.departmentId===ORG;team.innerHTML=teamOptions(catalog);team.value=modalScope.teamId
  }
  function close(){modalReport=null;document.querySelector('#recordModalBackdrop .record-modal')?.classList.remove('status-modal');if(typeof closeRecordModal==='function')closeRecordModal();else $('recordModalBackdrop')?.classList.remove('open')}
  async function renderModal(){
    if(!modalReport)return;await ensureRenderer();ensureRendererStyles();const catalog=reportCatalog();normalizeModalScope(catalog);
    const body=$('recordModalBody'),actions=$('recordModalActions'),title=$('recordModalTitle'),subtitle=$('recordModalSubtitle'),modal=document.querySelector('#recordModalBackdrop .record-modal');if(!body||!actions||!modal)return;
    modal.classList.add('status-modal');if(title)title.textContent=draftPreview(modalReport)?'Status Report Preview':'Status Report';if(subtitle)subtitle.textContent=draftPreview(modalReport)?'Preview of the current working draft':`${modalReport.id||''} · ${modalReport.reportingDate||''} · ${modalReport.status||''}`;
    body.innerHTML=`<div class="status-modal-toolbar"><div class="status-scope-controls"><label><span>Department</span><select id="statusModalDepartment">${departmentOptions(catalog)}</select></label><label><span>Team</span><select id="statusModalTeam" ${modalScope.departmentId===ORG?'disabled':''}>${teamOptions(catalog)}</select></label></div><button class="btn" id="statusOpenReport">Open Report ↗</button></div><div id="statusModalReportContent">${AmoReportRenderer.renderReport(modalReport,{scope:scopeInfo(catalog),catalog})}</div>`;
    actions.innerHTML='<button class="btn" id="closeStatusReport">Close</button>';
    $('statusModalDepartment')?.addEventListener('change',e=>{modalScope.departmentId=e.target.value;modalScope.teamId=ALL;const nextCatalog=reportCatalog();refreshTeamControl(nextCatalog);renderScopedReport(nextCatalog)});
    $('statusModalTeam')?.addEventListener('change',e=>{modalScope.teamId=e.target.value;renderScopedReport(reportCatalog())});
    $('statusOpenReport')?.addEventListener('click',()=>openReportWindow(modalReport,modalScope));
    $('closeStatusReport')?.addEventListener('click',close)
  }
  openStatusReportModal=async function(report){
    if(!report)return;let resolved=report;if(report._lazy&&typeof loadPublishedStatusReport==='function')resolved=await loadPublishedStatusReport(report.id);if(!resolved)return;
    modalReport=clone(resolved);modalScope={departmentId:ORG,teamId:ALL};const backdrop=$('recordModalBackdrop');backdrop?.classList.add('open');if(typeof recordModalState!=='undefined'){recordModalState.open=true;recordModalState.mode='view';recordModalState.type='status-report';recordModalState.id=resolved.id}await renderModal()
  };

  function latestPublishedReport(){return(statusReports||[]).filter(r=>['Published','Final'].includes(r?.status||'')).slice().sort((a,b)=>String(b.publishedAt||b.finalizedAt||b.id||'').localeCompare(String(a.publishedAt||a.finalizedAt||a.id||'')))[0]||null}
  function friendlyDate(value){if(!value)return'Publication date unavailable';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString()}
  renderLatestReportCard=function(){
    const el=$('latestStatusReport');if(!el)return;const r=latestPublishedReport();
    if(!r){el.innerHTML='<div class="notice">No published Status Report is available yet.</div>';return}
    const details=r._lazy?'Details load on View':`Revision ${Number(r.revision)||1} · ${r.entries?.length||0} reported item${r.entries?.length===1?'':'s'}`;
    el.innerHTML=`<div class="report-card latest-status-report-card"><div class="flex" style="justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap"><div><strong>Latest published report</strong><div class="muted">Published ${escHtml(friendlyDate(r.publishedAt))} · Reporting date ${escHtml(r.reportingDate||'—')} · ${escHtml(details)}</div></div><div class="toolbar"><button class="btn" id="viewLatestStatus">View</button><button class="btn" id="openLatestStatus">Open Report ↗</button></div></div></div>`;
    $('viewLatestStatus')?.addEventListener('click',()=>openStatusReportModal(r));$('openLatestStatus')?.addEventListener('click',()=>openReportWindow(r,{departmentId:ORG,teamId:ALL}))
  };

  function focusAuthoringPage(){
    const section=$('status-report');if(!section)return;
    $('statusDashboardSnapshot')?.remove();
    [...section.querySelectorAll(':scope > .section-title')].forEach(x=>{const h=x.querySelector('h2')?.textContent.trim();if(h==='Portfolio Snapshot'||h==='Demand highlights'||h==='Capacity outlook'||h==='Portfolio forecast'||h==='Allocation outlook')x.remove()});
    const current=[...section.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Current Draft');if(current)current.textContent='Architecture Status Report';
    const hero=section.querySelector(':scope > .hero p');if(hero)hero.textContent='Prepare and manage the current Architecture Status Report, then publish it for readers.';
    renderLatestReportCard()
  }
  if(typeof renderStatusReporting==='function'){const base=renderStatusReporting;renderStatusReporting=function(){const r=base();focusAuthoringPage();return r}}

  ensureRendererStyles();focusAuthoringPage();
  const css=document.createElement('style');css.id='status-report-ui-styles';css.textContent=`.status-modal{width:min(1180px,96vw)}.status-modal-toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:10px 0 14px;background:var(--panel);border-bottom:1px solid var(--line);margin-bottom:14px}.status-scope-controls{display:flex;gap:10px;flex-wrap:wrap}.status-scope-controls label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:700;color:var(--muted)}.status-scope-controls select{min-width:210px;border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 9px;background:var(--panel);color:var(--ink)}.latest-status-report-card .toolbar{margin:0}@media(max-width:760px){.status-modal-toolbar{align-items:stretch;flex-direction:column}.status-scope-controls{display:grid;grid-template-columns:1fr}.status-scope-controls select{width:100%;min-width:0}}`;document.head.appendChild(css)
})();
