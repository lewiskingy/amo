/* Demand lifecycle Phase model: Phase groups detailed service-specific Status values. */
(function initDemandPhases(){
  const PHASES=['Mobilisation','Engaged','Governance','Exit'];
  const DEFAULT_VISIBLE_PHASES=['Mobilisation','Engaged','Governance'];
  const fallbackPhase=status=>{
    const s=String(status||'').toLowerCase();
    if(/complete|closed|cancel|reject|declin|withdraw|abandon|supersed/.test(s))return'Exit';
    if(/approval|governance/.test(s))return'Governance';
    if(/discovery|analysis|design|social|review|finding|remediation|strategy|in progress|on hold/.test(s))return'Engaged';
    return'Mobilisation';
  };
  function workflowPhaseMap(settings=db.settings){
    const configured=settings?.serviceWorkflowPhases||{},out={};
    for(const [service,statuses] of Object.entries(serviceWorkflows())){
      out[service]={};
      for(const status of statuses)out[service][status]=PHASES.includes(configured?.[service]?.[status])?configured[service][status]:fallbackPhase(status);
    }
    return out
  }
  function workflowDefaults(settings=db.settings){
    const map=workflowPhaseMap(settings),configured=settings?.serviceWorkflowDefaults||{},out={};
    for(const [service,statuses] of Object.entries(serviceWorkflows())){
      out[service]={};
      for(const phase of PHASES){const candidates=statuses.filter(s=>map[service]?.[s]===phase);if(candidates.length)out[service][phase]=candidates.includes(configured?.[service]?.[phase])?configured[service][phase]:candidates[0]}
    }
    return out
  }
  function phaseForStatus(service,status,settings=db.settings){return workflowPhaseMap(settings)?.[service]?.[status]||fallbackPhase(status)}
  function phasesForService(service,settings=db.settings){const map=workflowPhaseMap(settings),statuses=statusesForService(service);return PHASES.filter(p=>statuses.some(s=>map?.[service]?.[s]===p))}
  function statusesForPhase(service,phase,settings=db.settings){const map=workflowPhaseMap(settings);return statusesForService(service).filter(s=>map?.[service]?.[s]===phase)}
  function defaultStatusForPhase(service,phase,settings=db.settings){return workflowDefaults(settings)?.[service]?.[phase]||statusesForPhase(service,phase,settings)[0]||defaultStatusForService(service)}
  function syncDemandPhase(d){const phase=phaseForStatus(d.service,d.status);const changed=d.phase!==phase;d.phase=phase;return changed}
  window.AMO_DEMAND_PHASES=PHASES;
  window.amoPhaseForStatus=phaseForStatus;
  window.amoStatusesForPhase=statusesForPhase;

  /* Add Phase beside Status in the Demand Register. Status remains the authoritative detailed lifecycle state. */
  if(typeof baseDemandColumns!=='undefined'&&!baseDemandColumns.some(c=>c.key==='phase')){
    const statusIndex=baseDemandColumns.findIndex(c=>c.key==='status');
    baseDemandColumns.splice(statusIndex<0?baseDemandColumns.length:statusIndex,0,{key:'phase',label:'Phase',type:'select',values:()=>PHASES,editable:true});
  }

  const priorCell=integratedDemandCell;
  integratedDemandCell=function(row,col){
    if(gridState.demand.editing&&col.key==='phase'){
      const opts=phasesForService(row.service);return `<select class="cell-input" data-edit-key="phase" data-row-id="${row.id}">${opts.map(v=>`<option value="${escHtml(v)}" ${v===row.phase?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`
    }
    if(gridState.demand.editing&&col.key==='status'){
      const opts=statusesForPhase(row.service,row.phase);return `<select class="cell-input" data-edit-key="status" data-row-id="${row.id}">${opts.map(v=>`<option value="${escHtml(v)}" ${v===row.status?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`
    }
    return priorCell(row,col)
  };

  const priorFilter=integratedDemandFilter;
  integratedDemandFilter=function(col){
    if(col.key==='phase'||col.key==='status')return `<div class="demand-multi-filter" data-demand-multi-filter="${col.key}"></div>`;
    return priorFilter(col)
  };

  function selectedFilter(key){
    const v=gridState.demand.filters[key];
    if(Array.isArray(v))return v;
    if(key==='phase'&&v==null)return [...DEFAULT_VISIBLE_PHASES];
    return null
  }
  function matchesLifecycleFilters(d){
    const phases=selectedFilter('phase'),statuses=selectedFilter('status');
    if(phases&&!phases.includes(d.phase||phaseForStatus(d.service,d.status)))return false;
    if(statuses&&statuses.length&&!statuses.includes(d.status))return false;
    return true
  }
  function multiFilterHtml(key){
    const choices=key==='phase'?PHASES:allWorkflowStatuses(),selected=selectedFilter(key),effective=selected||[];
    const label=key==='phase'?'Phase':'Status';
    const summary=selected?(effective.length===choices.length?`${label}: All`:`${label}: ${effective.length}`):`${label}: All`;
    return `<details class="multi-filter-menu"><summary>${escHtml(summary)}</summary><div class="multi-filter-options">${choices.map(v=>`<label><input type="checkbox" data-multi-key="${key}" value="${escHtml(v)}" ${(selected?effective.includes(v):key==='status')?'checked':''}> <span>${escHtml(v)}</span></label>`).join('')}</div></details>`
  }
  function wireMultiFilters(){
    document.querySelectorAll('[data-demand-multi-filter]').forEach(host=>{const key=host.dataset.demandMultiFilter;host.innerHTML=multiFilterHtml(key);host.querySelectorAll('input[type="checkbox"]').forEach(box=>box.onchange=()=>{
      const checked=[...host.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
      if(key==='status'&&checked.length===allWorkflowStatuses().length)delete gridState.demand.filters.status;else gridState.demand.filters[key]=checked;
      renderGrid('demand')
    })})
  }

  const priorDemandGrid=renderIntegratedDemandGrid;
  renderIntegratedDemandGrid=function(){
    const s=gridState.demand,allDemand=db.demand,allDraft=s.draft,phaseFilter=s.filters.phase,statusFilter=s.filters.status;
    const visible=allDemand.filter(matchesLifecycleFilters),visibleIds=new Set(visible.map(d=>d.id));
    db.demand=visible;if(s.editing&&Array.isArray(allDraft))s.draft=allDraft.filter(d=>matchesLifecycleFilters(d));
    delete s.filters.phase;delete s.filters.status;
    try{priorDemandGrid()}finally{db.demand=allDemand;if(s.editing)s.draft=allDraft;if(phaseFilter!==undefined)s.filters.phase=phaseFilter;if(statusFilter!==undefined)s.filters.status=statusFilter}
    wireMultiFilters();
    const count=$('demandCount');if(count&&workspaceHandle)count.textContent=`Showing ${visible.length} of ${allDemand.length} records`;
    if(s.editing){
      $('demandTable')?.querySelectorAll('[data-edit-key="service"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.service=e.target.value;const defaultStatus=defaultStatusForService(r.service);r.phase=phaseForStatus(r.service,defaultStatus);r.status=defaultStatusForPhase(r.service,r.phase);renderGrid('demand')});
      $('demandTable')?.querySelectorAll('[data-edit-key="phase"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.phase=e.target.value;r.status=defaultStatusForPhase(r.service,r.phase);renderGrid('demand')});
      $('demandTable')?.querySelectorAll('[data-edit-key="status"]').forEach(el=>el.onchange=e=>{const r=s.draft.find(x=>x.id===e.target.dataset.rowId);if(!r)return;r.status=e.target.value;r.phase=phaseForStatus(r.service,r.status);renderGrid('demand')})
    }
  };

  /* Demand modal: Service -> Phase -> Status. Changing Phase selects that phase's default Status. */
  const priorRecordModal=renderRecordModal;
  renderRecordModal=function(){
    priorRecordModal();if(recordModalState.type!=='demand'||recordModalState.mode!=='edit')return;
    const body=$('recordModalBody'),statusEl=body?.querySelector('[data-modal-field="status"]'),serviceEl=body?.querySelector('[data-modal-field="service"]');if(!statusEl)return;
    const current=recordModalState.draft||modalRecord();if(!current.phase)current.phase=phaseForStatus(current.service,current.status);
    const statusField=statusEl.closest('.field'),phaseWrap=document.createElement('div');phaseWrap.className='field';phaseWrap.innerHTML=`<label>Phase *</label><select data-modal-field="phase">${phasesForService(current.service).map(v=>`<option value="${escHtml(v)}" ${v===current.phase?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`;statusField.parentNode.insertBefore(phaseWrap,statusField);
    const validStatuses=statusesForPhase(current.service,current.phase);statusEl.innerHTML=modalOptionList(validStatuses,current.status);
    serviceEl?.addEventListener('change',()=>{const next=readModalDraft(),first=defaultStatusForService(next.service);next.phase=phaseForStatus(next.service,first);next.status=defaultStatusForPhase(next.service,next.phase);recordModalState.draft=next;renderRecordModal()});
    phaseWrap.querySelector('select').addEventListener('change',e=>{const next=readModalDraft();next.phase=e.target.value;next.status=defaultStatusForPhase(next.service,next.phase);recordModalState.draft=next;renderRecordModal()});
    statusEl.addEventListener('change',e=>{const next=readModalDraft();next.status=e.target.value;next.phase=phaseForStatus(next.service,next.status);recordModalState.draft=next;phaseWrap.querySelector('select').value=next.phase})
  };

  /* Ensure saves can never leave Phase and Status inconsistent. */
  const priorSaveDemand=saveDemandModal;
  saveDemandModal=function(next){next.phase=phaseForStatus(next.service,next.status);return priorSaveDemand(next)};
  const priorSaveGrid=saveGrid;
  saveGrid=function(name){if(name==='demand'&&gridState.demand.editing)gridState.demand.draft.forEach(syncDemandPhase);return priorSaveGrid(name)};

  /* Phase-aware headline semantics. */
  const priorHeadline=dashboardHeadlineSnapshot;
  dashboardHeadlineSnapshot=function(){const snap=priorHeadline(),active=scopedDemand?scopedDemand().filter(d=>(d.phase||phaseForStatus(d.service,d.status))!=='Exit'):db.demand.filter(d=>(d.phase||phaseForStatus(d.service,d.status))!=='Exit');snap.activeDemand=active.length;snap.inGovernance=active.filter(d=>(d.phase||phaseForStatus(d.service,d.status))==='Governance').length;snap.inSocialisation=active.filter(d=>/(socialisation|socialization)/i.test(d.status||'')).length;return snap};

  /* Archive eligibility now uses the canonical Exit phase rather than a growing list of terminal strings. */
  if(typeof demandReadyForArchive==='function')demandReadyForArchive=function(d,now=new Date()){
    if((d?.phase||phaseForStatus(d?.service,d?.status))!=='Exit')return false;const changed=archiveReferenceDate(d);if(!changed)return false;return now.getTime()-changed.getTime()>=ARCHIVE_AFTER_DAYS*24*60*60*1000
  };

  /* Config: map every detailed status to a Phase and choose the phase default Status. */
  function ensurePhaseDraft(){if(!configState.editing||!configState.draft)return;configState.draft.serviceWorkflowPhases=clone(configState.draft.serviceWorkflowPhases||workflowPhaseMap());configState.draft.serviceWorkflowDefaults=clone(configState.draft.serviceWorkflowDefaults||workflowDefaults())}
  function phaseConfigCard(){ensurePhaseDraft();const maps=configState.editing?configState.draft.serviceWorkflowPhases:workflowPhaseMap(),defs=configState.editing?configState.draft.serviceWorkflowDefaults:workflowDefaults();return `<div class="card config-card" style="grid-column:1/-1"><div class="section-title" style="margin-top:0"><div><h2>Lifecycle Phases</h2><p class="muted config-description">Phase is the broad management lifecycle. Detailed Status remains service-specific. Status determines Phase; changing Phase on Demand selects the configured default Status.</p></div></div><div class="table-wrap"><table class="phase-config-table"><thead><tr><th>Service</th><th>Status</th><th>Phase</th><th>Default for Phase</th></tr></thead><tbody>${Object.entries(serviceWorkflows()).flatMap(([service,statuses])=>statuses.map(status=>{const phase=maps?.[service]?.[status]||fallbackPhase(status),def=defs?.[service]?.[phase]||'';return `<tr><td>${escHtml(service)}</td><td><strong>${escHtml(status)}</strong></td><td>${configState.editing?`<select data-phase-service="${escHtml(service)}" data-phase-status="${escHtml(status)}">${PHASES.map(p=>`<option ${p===phase?'selected':''}>${p}</option>`).join('')}</select>`:escHtml(phase)}</td><td>${configState.editing?`<input type="radio" name="phase-default-${escHtml(service)}-${escHtml(phase)}" data-default-service="${escHtml(service)}" data-default-phase="${escHtml(phase)}" data-default-status="${escHtml(status)}" ${def===status?'checked':''}>`:def===status?'Default':''}</td></tr>`}).join('')).join('')}</tbody></table></div></div>`}
  const priorRenderConfigPhases=renderConfig;
  renderConfig=function(){priorRenderConfigPhases();if(!workspaceHandle)return;const grid=$('configContent')?.querySelector('.config-grid');if(!grid)return;grid.querySelector('.phase-config-card')?.remove();const wrap=document.createElement('div');wrap.className='phase-config-card';wrap.style.display='contents';wrap.innerHTML=phaseConfigCard();grid.append(...wrap.childNodes);if(configState.editing){grid.querySelectorAll('[data-phase-service]').forEach(el=>el.onchange=e=>{ensurePhaseDraft();const service=e.target.dataset.phaseService,status=e.target.dataset.phaseStatus,phase=e.target.value;configState.draft.serviceWorkflowPhases[service]=configState.draft.serviceWorkflowPhases[service]||{};configState.draft.serviceWorkflowPhases[service][status]=phase;const defs=configState.draft.serviceWorkflowDefaults[service]=configState.draft.serviceWorkflowDefaults[service]||{};if(!statusesForPhase(service,phase,{...db.settings,serviceWorkflowPhases:configState.draft.serviceWorkflowPhases}).includes(defs[phase]))defs[phase]=status;renderConfig()});grid.querySelectorAll('[data-default-service]').forEach(el=>el.onchange=e=>{if(!e.target.checked)return;ensurePhaseDraft();const {defaultService:service,defaultPhase:phase,defaultStatus:status}=e.target.dataset;configState.draft.serviceWorkflowDefaults[service]=configState.draft.serviceWorkflowDefaults[service]||{};configState.draft.serviceWorkflowDefaults[service][phase]=status})}}
  };
  const priorSaveConfigPhases=saveConfigChanges;
  saveConfigChanges=function(){
    ensurePhaseDraft();const phaseMaps=clone(configState.draft?.serviceWorkflowPhases||workflowPhaseMap()),defs=clone(configState.draft?.serviceWorkflowDefaults||workflowDefaults());
    for(const [service,statuses] of Object.entries(serviceWorkflows()))for(const status of statuses)if(!PHASES.includes(phaseMaps?.[service]?.[status])){alert(`Status ${status} in ${service} must have a lifecycle Phase.`);return}
    const result=priorSaveConfigPhases();if(!configState.editing){db.settings.serviceWorkflowPhases=phaseMaps;db.settings.serviceWorkflowDefaults=defs;db.configFiles['settings.json']=clone(db.settings);configDirty=true;db.demand.forEach(d=>{if(syncDemandPhase(d))markDirty('demand',d.id,`Aligned ${d.id} Phase to ${d.phase}.`)});requestAutosave();refreshAll()}return result
  };

  /* Workspace migration: persist mappings and Phase on existing Demand. */
  const priorOpenPhases=openWorkspace;
  openWorkspace=async function(){await priorOpenPhases();if(!workspaceHandle)return;let configChanged=false;if(!db.settings.serviceWorkflowPhases){db.settings.serviceWorkflowPhases=workflowPhaseMap();configChanged=true}if(!db.settings.serviceWorkflowDefaults){db.settings.serviceWorkflowDefaults=workflowDefaults();configChanged=true}for(const d of db.demand)if(syncDemandPhase(d))markDirty('demand',d.id,`Assigned lifecycle Phase ${d.phase} to ${d.id}.`);if(configChanged){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}if(gridState.demand.filters.phase==null)gridState.demand.filters.phase=[...DEFAULT_VISIBLE_PHASES];refreshAll();renderStatusReporting?.()};
  const openBtn=$('openWorkspaceBtn');if(openBtn)openBtn.onclick=()=>openWorkspace();

  const style=document.createElement('style');style.id='demand-phase-styles';style.textContent=`
    .multi-filter-menu{position:relative}.multi-filter-menu summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:6px 7px;background:var(--panel);font-size:.76rem;white-space:nowrap}.multi-filter-menu summary::-webkit-details-marker{display:none}.multi-filter-options{position:absolute;z-index:35;top:calc(100% + 4px);left:0;min-width:190px;max-height:260px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:9px;box-shadow:var(--shadow);padding:7px}.multi-filter-options label{display:flex;gap:7px;align-items:center;padding:5px 4px;white-space:nowrap;font-size:.77rem}.phase-config-table{min-width:800px}.phase-config-table select{min-width:130px}`;document.head.appendChild(style);
})();