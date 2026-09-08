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

  function previousEntryFor(demandId){return(statusReportDraft?.previousEntries||[]).find(e=>e.demandId===demandId)||null}
  function previousReportLabel(){
    const id=statusReportDraft?.previousReportId;if(!id)return'Previous report';const report=(statusReports||[]).find(r=>r.id===id),date=report?.reportingDate;return date?`Previous report · ${date}`:`Previous report · ${id}`
  }
  function liveActiveWorkPackages(demandId){const rows=window.WorkPackages?.forDemand?.(demandId)||window.WorkPackages?.state?.rows?.filter(w=>w.demandId===demandId)||[];return rows.filter(w=>!['Complete','Cancelled'].includes(String(w.status||'')))}
  async function copyPreviousText(button,text){
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{const helper=document.createElement('textarea');helper.value=text;helper.setAttribute('readonly','');helper.style.position='fixed';helper.style.opacity='0';document.body.appendChild(helper);helper.select();document.execCommand('copy');helper.remove()}
      const prior=button.getAttribute('aria-label')||'Copy previous text';button.classList.add('copied');button.setAttribute('aria-label','Copied');button.title='Copied';setTimeout(()=>{button.classList.remove('copied');button.setAttribute('aria-label',prior);button.title=prior},1200)
    }catch(_e){alert('Could not copy the previous report text to the clipboard.')}
  }
  function decorateAuthoringContext(){
    if(!statusReportState?.editing)return;
    const previousLabel=previousReportLabel();
    document.querySelectorAll('#statusReportTable tr[data-status-demand]').forEach(tr=>{
      const demandId=tr.dataset.statusDemand,previous=previousEntryFor(demandId),first=tr.children?.[0];
      if(first&&!first.querySelector('.status-work-package-context')){
        const rows=liveActiveWorkPackages(demandId),box=document.createElement('div');box.className='status-work-package-context';
        box.innerHTML=`<div class="status-context-label">Active Work Packages</div>${rows.length?rows.map(w=>`<div class="status-work-package-row"><strong>${escHtml(w.id||'')}</strong><span>${escHtml(w.title||'')}</span><span class="pill blue">${escHtml(w.status||'')}</span>${w.targetEnd?`<span class="muted">to ${escHtml(w.targetEnd)}</span>`:''}</div>`).join(''):'<div class="muted">No active Work Packages.</div>'}`;first.appendChild(box)
      }
      tr.querySelectorAll('textarea[data-status-field]').forEach(textarea=>{
        const field=textarea.dataset.statusField;if(!['statusUpdate','achievements','issues'].includes(field))return;const cell=textarea.closest('td');if(!cell)return;cell.classList.add('status-commentary-cell');
        const value=previous?.[field]||'';if(!value||cell.querySelector(`.status-previous-context[data-field="${field}"]`))return;
        const box=document.createElement('div');box.className='status-previous-context';box.dataset.field=field;
        box.innerHTML=`<div class="status-previous-head"><div class="status-context-label">${escHtml(previousLabel)}</div><button type="button" class="status-copy-previous" aria-label="Copy previous text" title="Copy previous text"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg></button></div><div class="status-previous-text">${escHtml(value)}</div>`;
        box.querySelector('.status-copy-previous')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();copyPreviousText(e.currentTarget,value)});cell.insertBefore(box,textarea)
      })
    })
  }
  function focusAuthoringPage(){
    const section=$('status-report');if(!section)return;
    $('statusDashboardSnapshot')?.remove();
    [...section.querySelectorAll(':scope > .section-title')].forEach(x=>{const h=x.querySelector('h2')?.textContent.trim();if(h==='Portfolio Snapshot'||h==='Demand highlights'||h==='Capacity outlook'||h==='Portfolio forecast'||h==='Allocation outlook')x.remove()});
    const current=[...section.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Current Draft');if(current)current.textContent='Architecture Status Report';
    const hero=section.querySelector(':scope > .hero p');if(hero)hero.textContent='Prepare and manage the current Architecture Status Report, then publish it for readers.';
    decorateAuthoringContext();renderLatestReportCard()
  }
  if(typeof renderStatusReporting==='function'){const base=renderStatusReporting;renderStatusReporting=function(){const r=base();focusAuthoringPage();return r}}

  ensureRendererStyles();focusAuthoringPage();
  const css=document.createElement('style');css.id='status-report-ui-styles';css.textContent=`.status-modal{width:min(1180px,96vw)}.status-modal-toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:10px 0 14px;background:var(--panel);border-bottom:1px solid var(--line);margin-bottom:14px}.status-scope-controls{display:flex;gap:10px;flex-wrap:wrap}.status-scope-controls label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:700;color:var(--muted)}.status-scope-controls select{min-width:210px;border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 9px;background:var(--panel);color:var(--ink)}.latest-status-report-card .toolbar{margin:0}.status-context-label{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.status-commentary-cell{vertical-align:top!important;display:flex;flex-direction:column;gap:8px;height:100%}.status-commentary-cell>textarea[data-status-field]{margin-top:auto;min-height:76px;flex:0 0 auto}.status-previous-context{margin:0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--soft)}.status-previous-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:5px}.status-previous-text{white-space:pre-wrap;font-size:.78rem;line-height:1.4;color:var(--ink)}.status-copy-previous{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--muted);cursor:pointer;padding:4px}.status-copy-previous:hover{color:var(--ink);border-color:var(--accent)}.status-copy-previous.copied{color:var(--success)}.status-copy-previous svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}.status-work-package-context{margin-top:9px;padding-top:8px;border-top:1px solid var(--line);display:grid;gap:5px}.status-work-package-row{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;gap:6px;align-items:center;font-size:.72rem}.status-work-package-row .muted{grid-column:2/-1}.status-report-table .previous-report-detail,.status-report-table .previous-copy-all{display:none!important}@media(max-width:760px){.status-modal-toolbar{align-items:stretch;flex-direction:column}.status-scope-controls{display:grid;grid-template-columns:1fr}.status-scope-controls select{width:100%;min-width:0}.status-work-package-row{grid-template-columns:1fr}}`;document.head.appendChild(css)
})();
