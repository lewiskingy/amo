/* Status Report authoring/viewer host. Report presentation is delegated to AmoReportRenderer. */
(function initStatusReportUi(){
  if(window.__amoStatusReportUiLoaded)return;window.__amoStatusReportUiLoaded=true;
  const ORG='organization',ALL='department';
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
  function teamBy(id){return teams().find(t=>t.id===id)||null}
  function initialScope(){
    const api=hierarchy();if(api)return{departmentId:api.selectedDepartment?.()||ORG,teamId:api.selectedTeam?.()||ALL};
    const legacy=typeof departmentScope!=='undefined'?departmentScope:ALL;return legacy===ALL?{departmentId:ORG,teamId:ALL}:{departmentId:teamBy(legacy)?.departmentId||ORG,teamId:legacy}
  }
  function scopeInfo(){
    const dep=modalScope.departmentId,team=modalScope.teamId,depRow=departments().find(d=>d.id===dep),teamRow=teamBy(team);
    return{departmentId:dep,teamId:team,departmentName:depRow?.name||'',teamName:teamRow?.name||'',label:dep===ORG?'Whole organisation':team===ALL?(depRow?.name||'Whole department'):[depRow?.name,teamRow?.name].filter(Boolean).join(' · ')}
  }
  function catalog(){return{teamsById:Object.fromEntries(teams().map(t=>[t.id,t]))}}
  function persisted(report){return !!report?.id&&/^SR-/.test(report.id)&&['Published','Final'].includes(report.status||'Published')}
  function reportSourceMode(){return window.workspaceRepository?.mode||(typeof getLastConnectionPreference==='function'?getLastConnectionPreference()?.mode:null)||'remote'}
  function reportUrl(report){
    if(window.AmoReportLinks?.reportUrl)return window.AmoReportLinks.reportUrl(report.id,reportSourceMode());
    const u=new URL(`/reports/${encodeURIComponent(report.id)}`,location.origin);if(reportSourceMode()==='local')u.searchParams.set('source','local');return u.href
  }
  function departmentOptions(){return `<option value="${ORG}" ${modalScope.departmentId===ORG?'selected':''}>Organisation-wide</option>${departments().map(d=>`<option value="${escHtml(d.id)}" ${modalScope.departmentId===d.id?'selected':''}>${escHtml(d.name)}</option>`).join('')}`}
  function teamOptions(){
    if(modalScope.departmentId===ORG)return'<option value="department">All teams</option>';
    const available=teams().filter(t=>!t.departmentId||t.departmentId===modalScope.departmentId);
    return `<option value="${ALL}" ${modalScope.teamId===ALL?'selected':''}>Whole department</option>${available.map(t=>`<option value="${escHtml(t.id)}" ${modalScope.teamId===t.id?'selected':''}>${escHtml(t.name)}</option>`).join('')}`
  }
  function close(){modalReport=null;document.querySelector('#recordModalBackdrop .record-modal')?.classList.remove('status-modal');if(typeof closeRecordModal==='function')closeRecordModal();else $('recordModalBackdrop')?.classList.remove('open')}
  async function renderModal(){
    if(!modalReport)return;await ensureRenderer();ensureRendererStyles();
    const body=$('recordModalBody'),actions=$('recordModalActions'),title=$('recordModalTitle'),subtitle=$('recordModalSubtitle'),modal=document.querySelector('#recordModalBackdrop .record-modal');if(!body||!actions||!modal)return;
    modal.classList.add('status-modal');if(title)title.textContent=modalReport.status==='Draft Preview'?'Status Report Preview':'Status Report';if(subtitle)subtitle.textContent=modalReport.status==='Draft Preview'?'Preview of the current working draft':`${modalReport.id||''} · ${modalReport.reportingDate||''} · ${modalReport.status||''}`;
    body.innerHTML=`<div class="status-modal-toolbar"><div class="status-scope-controls"><label><span>Department</span><select id="statusModalDepartment">${departmentOptions()}</select></label><label><span>Team</span><select id="statusModalTeam" ${modalScope.departmentId===ORG?'disabled':''}>${teamOptions()}</select></label></div>${persisted(modalReport)?'<button class="btn" id="statusOpenReport">Open Report ↗</button>':''}</div><div id="statusModalReportContent">${AmoReportRenderer.renderReport(modalReport,{scope:scopeInfo(),catalog:catalog()})}</div>`;
    actions.innerHTML='<button class="btn" id="closeStatusReport">Close</button>';
    $('statusModalDepartment')?.addEventListener('change',e=>{modalScope.departmentId=e.target.value;modalScope.teamId=ALL;renderModal()});
    $('statusModalTeam')?.addEventListener('change',e=>{modalScope.teamId=e.target.value;renderModal()});
    $('statusOpenReport')?.addEventListener('click',()=>window.open(reportUrl(modalReport),'_blank','noopener'));
    $('closeStatusReport')?.addEventListener('click',close)
  }
  openStatusReportModal=async function(report){
    if(!report)return;let resolved=report;if(report._lazy&&typeof loadPublishedStatusReport==='function')resolved=await loadPublishedStatusReport(report.id);if(!resolved)return;
    modalReport=clone(resolved);modalScope=initialScope();const backdrop=$('recordModalBackdrop');backdrop?.classList.add('open');if(typeof recordModalState!=='undefined'){recordModalState.open=true;recordModalState.mode='view';recordModalState.type='status-report';recordModalState.id=resolved.id}await renderModal()
  };

  function focusAuthoringPage(){
    const section=$('status-report');if(!section)return;
    const title=section.querySelector(':scope > .hero h1');if(title)title.textContent='Status Report';
    $('statusDashboardSnapshot')?.remove();
    [...section.querySelectorAll(':scope > .section-title')].forEach(x=>{const h=x.querySelector('h2')?.textContent.trim();if(h==='Portfolio Snapshot'||h==='Demand highlights'||h==='Capacity outlook'||h==='Portfolio forecast'||h==='Allocation outlook')x.remove()});
    const current=[...section.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Current Draft');if(current)current.textContent='Architecture Status Report';
    const hero=section.querySelector(':scope > .hero p');if(hero)hero.textContent='Prepare and manage the current Architecture Status Report, then publish it for readers.'
  }
  if(typeof renderStatusReporting==='function'){const base=renderStatusReporting;renderStatusReporting=function(){const r=base();focusAuthoringPage();return r}}

  ensureRendererStyles();focusAuthoringPage();
  const css=document.createElement('style');css.id='status-report-ui-styles';css.textContent=`.status-modal{width:min(1180px,96vw)}.status-modal-toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:10px 0 14px;background:var(--panel);border-bottom:1px solid var(--line);margin-bottom:14px}.status-scope-controls{display:flex;gap:10px;flex-wrap:wrap}.status-scope-controls label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:700;color:var(--muted)}.status-scope-controls select{min-width:210px;border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 9px;background:var(--panel);color:var(--ink)}@media(max-width:760px){.status-modal-toolbar{align-items:stretch;flex-direction:column}.status-scope-controls{display:grid;grid-template-columns:1fr}.status-scope-controls select{width:100%;min-width:0}}`;document.head.appendChild(css)
})();
