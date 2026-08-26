/* Demand lifecycle Phase runtime model. Config editing is owned by app-config-settings.js. */
(function initDemandPhases(){
  if(window.__amoDemandPhasesLoaded)return;window.__amoDemandPhasesLoaded=true;
  const PHASES=['Triage','Mobilisation','Engaged','Governance','Exit'];
  const DEFAULT_VISIBLE_PHASES=['Triage','Mobilisation','Engaged','Governance'];
  const fallbackPhase=status=>{
    const s=String(status||'').toLowerCase();
    if(/complete|closed|cancel|reject|declin|withdraw|abandon|supersed|refer/.test(s))return'Exit';
    if(/approval|governance/.test(s))return'Governance';
    if(/discovery|analysis|design|social|review|finding|remediation|strategy|in progress|on hold/.test(s))return'Engaged';
    if(/triage|assessment|aia|accepted/.test(s))return'Triage';
    return'Mobilisation';
  };
  function workflowSource(settings=db.settings){
    const configured=typeof normalizeServiceWorkflows==='function'?normalizeServiceWorkflows(settings?.serviceWorkflows||{}):(settings?.serviceWorkflows||{});
    return Object.keys(configured||{}).length?configured:(typeof serviceWorkflows==='function'?serviceWorkflows():{});
  }
  function workflowPhaseMap(settings=db.settings){
    const configured=settings?.serviceWorkflowPhases||{},out={};
    for(const [service,statuses] of Object.entries(workflowSource(settings))){out[service]={};for(const status of statuses)out[service][status]=PHASES.includes(configured?.[service]?.[status])?configured[service][status]:fallbackPhase(status)}
    return out
  }
  function workflowDefaults(settings=db.settings){
    const map=workflowPhaseMap(settings),configured=settings?.serviceWorkflowDefaults||{},out={};
    for(const [service,statuses] of Object.entries(workflowSource(settings))){out[service]={};for(const phase of PHASES){const candidates=statuses.filter(s=>map[service]?.[s]===phase);if(candidates.length)out[service][phase]=candidates.includes(configured?.[service]?.[phase])?configured[service][phase]:candidates[0]}}
    return out
  }
  function phaseForStatus(service,status,settings=db.settings){return workflowPhaseMap(settings)?.[service]?.[status]||fallbackPhase(status)}
  function statusesForPhaseLocal(service,phase,settings=db.settings){const workflows=workflowSource(settings),map=workflowPhaseMap(settings);return(workflows[service]||[]).filter(s=>map?.[service]?.[s]===phase)}
  function phasesForService(service,settings=db.settings){const statuses=workflowSource(settings)[service]||[],map=workflowPhaseMap(settings);return PHASES.filter(p=>statuses.some(s=>map?.[service]?.[s]===p))}
  function defaultStatusForPhaseLocal(service,phase,settings=db.settings){return workflowDefaults(settings)?.[service]?.[phase]||statusesForPhaseLocal(service,phase,settings)[0]||(typeof defaultStatusForService==='function'?defaultStatusForService(service):'')}
  function syncDemandPhase(d){const phase=phaseForStatus(d.service,d.status);const changed=d.phase!==phase;d.phase=phase;return changed}
  window.AMO_DEMAND_PHASES=PHASES;
  window.amoPhaseForStatus=phaseForStatus;
  window.amoStatusesForPhase=statusesForPhaseLocal;

  if(typeof baseDemandColumns!=='undefined'&&!baseDemandColumns.some(c=>c.key==='phase')){const statusIndex=baseDemandColumns.findIndex(c=>c.key==='status');baseDemandColumns.splice(statusIndex<0?baseDemandColumns.length:statusIndex,0,{key:'phase',label:'Phase',type:'select',values:()=>PHASES,editable:true})}

  if(typeof integratedDemandCell==='function'){
    const priorCell=integratedDemandCell;
    integratedDemandCell=function(row,col){
      if(gridState.demand.editing&&col.key==='phase'){const opts=phasesForService(row.service);return `<select class="cell-input" data-edit-key="phase" data-row-id="${row.id}">${opts.map(v=>`<option value="${escHtml(v)}" ${v===row.phase?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}
      if(gridState.demand.editing&&col.key==='status'){const opts=statusesForPhaseLocal(row.service,row.phase);return `<select class="cell-input" data-edit-key="status" data-row-id="${row.id}">${opts.map(v=>`<option value="${escHtml(v)}" ${v===row.status?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}
      return priorCell(row,col)
    }
  }

  function selectedFilter(key){const v=gridState.demand.filters[key];if(Array.isArray(v))return v;if(key==='phase'&&v==null)return[...DEFAULT_VISIBLE_PHASES];return null}
  function matchesLifecycleFilters(d){const phases=selectedFilter('phase'),statuses=selectedFilter('status');if(phases&&!phases.includes(d.phase||phaseForStatus(d.service,d.status)))return false;if(statuses&&statuses.length&&!statuses.includes(d.status))return false;return true}
  function multiFilterHtml(key){const choices=key==='phase'?PHASES:(typeof allWorkflowStatuses==='function'?allWorkflowStatuses():[]),selected=selectedFilter(key),effective=selected||[],label=key==='phase'?'Phase':'Status',summary=selected?(effective.length===choices.length?`${label}: All`:`${label}: ${effective.length}`):`${label}: All`;return `<details class="multi-filter-menu"><summary>${escHtml(summary)}</summary><div class="multi-filter-options">${choices.map(v=>`<label><input type="checkbox" data-multi-key="${key}" value="${escHtml(v)}" ${(selected?effective.includes(v):key==='status')?'checked':''}> <span>${escHtml(v)}</span></label>`).join('')}</div></details>`}
  function wireMultiFilters(){document.querySelectorAll('[data-demand-multi-filter]').forEach(host=>{const key=host.dataset.demandMultiFilter;host.innerHTML=multiFilterHtml(key);host.querySelectorAll('input[type="checkbox"]').forEach(box=>box.onchange=()=>{const checked=[...host.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value),all=key==='status'&&typeof allWorkflowStatuses==='function'?allWorkflowStatuses():[];if(key==='status'&&checked.length===all.length)delete gridState.demand.filters.status;else gridState.demand.filters[key]=checked;renderGrid('demand')})})}

  if(typeof integratedDemandFilter==='function'){
    const priorFilter=integratedDemandFilter;
    integratedDemandFilter=function(col){if(col.key==='phase'||col.key==='status')return `<div class="demand-multi-filter" data-demand-multi-filter="${col.key}"></div>`;return priorFilter(col)}
  }
  if(typeof renderIntegratedDemandGrid==='function'){
    const priorGrid=renderIntegratedDemandGrid;
    renderIntegratedDemandGrid=function(){
      const s=gridState.demand,allDemand=db.demand,allDraft=s.draft,phaseFilter=s.filters.phase,statusFilter=s.filters.status,visible=allDemand.filter(matchesLifecycleFilters);
      db.demand=visible;if(s.editing&&Array.isArray(allDraft))s.draft=allDraft.filter(matchesLifecycleFilters);delete s.filters.phase;delete s.filters.status;
      try{priorGrid()}finally{db.demand=allDemand;if(s.editing)s.draft=allDraft;if(phaseFilter!==undefined)s.filters.phase=phaseFilter;if(statusFilter!==undefined)s.filters.status=statusFilter}
      wireMultiFilters();const count=$('demandCount');if(count&&workspaceHandle)count.textContent=`Showing ${visible.length} of ${allDemand.length} records`;
      if(s.editing){
        $('demandTable')?.querySelectorAll('[data-edit-key="service"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.service=e.target.value;const first=typeof defaultStatusForService==='function'?defaultStatusForService(r.service):'';r.phase=phaseForStatus(r.service,first);r.status=defaultStatusForPhaseLocal(r.service,r.phase);renderGrid('demand')});
        $('demandTable')?.querySelectorAll('[data-edit-key="phase"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.phase=e.target.value;r.status=defaultStatusForPhaseLocal(r.service,r.phase);renderGrid('demand')});
        $('demandTable')?.querySelectorAll('[data-edit-key="status"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.status=e.target.value;r.phase=phaseForStatus(r.service,r.status);renderGrid('demand')})
      }
    }
  }

  if(typeof renderRecordModal==='function'){
    const priorModal=renderRecordModal;
    renderRecordModal=function(){
      priorModal();if(recordModalState.type!=='demand'||recordModalState.mode!=='edit')return;
      const body=$('recordModalBody'),statusEl=body?.querySelector('[data-modal-field="status"]'),serviceEl=body?.querySelector('[data-modal-field="service"]');if(!statusEl)return;
      const current=recordModalState.draft||modalRecord();if(!current.phase)current.phase=phaseForStatus(current.service,current.status);
      const statusField=statusEl.closest('.field');if(!statusField||statusField.previousElementSibling?.querySelector?.('[data-modal-field="phase"]'))return;
      const phaseWrap=document.createElement('div');phaseWrap.className='field';phaseWrap.innerHTML=`<label>Phase *</label><select data-modal-field="phase">${phasesForService(current.service).map(v=>`<option value="${escHtml(v)}" ${v===current.phase?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`;statusField.parentNode.insertBefore(phaseWrap,statusField);
      statusEl.innerHTML=modalOptionList(statusesForPhaseLocal(current.service,current.phase),current.status);
      serviceEl?.addEventListener('change',()=>{const next=readModalDraft(),first=typeof defaultStatusForService==='function'?defaultStatusForService(next.service):'';next.phase=phaseForStatus(next.service,first);next.status=defaultStatusForPhaseLocal(next.service,next.phase);recordModalState.draft=next;renderRecordModal()});
      phaseWrap.querySelector('select').addEventListener('change',e=>{const next=readModalDraft();next.phase=e.target.value;next.status=defaultStatusForPhaseLocal(next.service,next.phase);recordModalState.draft=next;renderRecordModal()});
      statusEl.addEventListener('change',e=>{const next=readModalDraft();next.status=e.target.value;next.phase=phaseForStatus(next.service,next.status);recordModalState.draft=next;phaseWrap.querySelector('select').value=next.phase})
    }
  }

  if(typeof saveDemandModal==='function'){const priorSaveDemand=saveDemandModal;saveDemandModal=function(next){next.phase=phaseForStatus(next.service,next.status);return priorSaveDemand(next)}}
  if(typeof saveGrid==='function'){const priorSaveGrid=saveGrid;saveGrid=function(name){if(name==='demand'&&gridState.demand.editing)gridState.demand.draft.forEach(syncDemandPhase);return priorSaveGrid(name)}}
  if(typeof dashboardHeadlineSnapshot==='function'){const priorHeadline=dashboardHeadlineSnapshot;dashboardHeadlineSnapshot=function(){const snap=priorHeadline(),source=typeof scopedDemand==='function'?scopedDemand():db.demand,active=source.filter(d=>(d.phase||phaseForStatus(d.service,d.status))!=='Exit');snap.activeDemand=active.length;snap.inGovernance=active.filter(d=>(d.phase||phaseForStatus(d.service,d.status))==='Governance').length;snap.inSocialisation=active.filter(d=>/(socialisation|socialization)/i.test(d.status||'')).length;return snap}}
  if(typeof demandReadyForArchive==='function')demandReadyForArchive=function(d,now=new Date()){if((d?.phase||phaseForStatus(d?.service,d?.status))!=='Exit')return false;const changed=archiveReferenceDate(d);if(!changed)return false;return now.getTime()-changed.getTime()>=ARCHIVE_AFTER_DAYS*24*60*60*1000};

  if(typeof openWorkspace==='function'){
    const priorOpen=openWorkspace;
    openWorkspace=async function(){await priorOpen();if(!workspaceHandle)return;let configChanged=false;if(!db.settings.serviceWorkflowPhases){db.settings.serviceWorkflowPhases=workflowPhaseMap();configChanged=true}if(!db.settings.serviceWorkflowDefaults){db.settings.serviceWorkflowDefaults=workflowDefaults();configChanged=true}for(const d of db.demand)if(syncDemandPhase(d))markDirty('demand',d.id,`Assigned lifecycle Phase ${d.phase} to ${d.id}.`);if(configChanged){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}if(gridState.demand.filters.phase==null)gridState.demand.filters.phase=[...DEFAULT_VISIBLE_PHASES];refreshAll();if(typeof renderStatusReporting==='function')renderStatusReporting()};
    const openBtn=$('openWorkspaceBtn');if(openBtn)openBtn.onclick=()=>openWorkspace()
  }

  if(!document.getElementById('demand-phase-styles')){const style=document.createElement('style');style.id='demand-phase-styles';style.textContent='.multi-filter-menu{position:relative}.multi-filter-menu summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:6px 7px;background:var(--panel);font-size:.76rem;white-space:nowrap}.multi-filter-menu summary::-webkit-details-marker{display:none}.multi-filter-options{position:absolute;z-index:35;top:calc(100% + 4px);left:0;min-width:190px;max-height:260px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:9px;box-shadow:var(--shadow);padding:7px}.multi-filter-options label{display:flex;gap:7px;align-items:center;padding:5px 4px;white-space:nowrap;font-size:.77rem}';document.head.appendChild(style)}
})();
