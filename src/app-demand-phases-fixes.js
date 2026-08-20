/* Cross-view fixes for Demand lifecycle phases. Loaded after app-demand-phases.js. */
(function applyDemandPhaseSemantics(){
  const phaseFor=d=>d?.phase||(window.amoPhaseForStatus?window.amoPhaseForStatus(d?.service,d?.status):'Mobilisation');
  const activeDemand=d=>phaseFor(d)!=='Exit';

  /* Central operational helpers that were originally based on terminal status strings. */
  unresolvedWithoutAllocation=function(){return db.demand.filter(activeDemand).filter(d=>!db.allocations.some(a=>a.demandId===d.id&&a.teamMemberId))};
  const priorAllocationRows=allocationRows;allocationRows=function(){const all=db.demand;db.demand=all.filter(activeDemand);try{return priorAllocationRows()}finally{db.demand=all}};
  const priorOwnerDraft=ensureOwnerDraftRows;ensureOwnerDraftRows=function(){const all=db.demand;db.demand=all.filter(activeDemand);try{return priorOwnerDraft()}finally{db.demand=all}};
  const priorAllocationModal=renderAllocationModal;renderAllocationModal=function(r){const all=db.demand;db.demand=all.filter(activeDemand);try{return priorAllocationModal(r)}finally{db.demand=all}};

  /* Reporting and planning views should all treat Exit as no longer active. */
  function withActiveDemand(fn,args,ctx){const all=db.demand;db.demand=all.filter(activeDemand);try{return fn.apply(ctx,args)}finally{db.demand=all}}
  const priorDashboard=renderDashboard;renderDashboard=function(...args){return withActiveDemand(priorDashboard,args,this)};
  const priorResource=renderResource;renderResource=function(...args){return withActiveDemand(priorResource,args,this)};
  const priorRoadmap=renderRoadmap;renderRoadmap=function(...args){return withActiveDemand(priorRoadmap,args,this)};
  const priorStatusReporting=renderStatusReporting;renderStatusReporting=function(...args){return withActiveDemand(priorStatusReporting,args,this)};
  const priorReportingRows=reportingRows;reportingRows=function(source=statusReportDraft){const all=db.demand;db.demand=all.filter(activeDemand);try{return priorReportingRows(source)}finally{db.demand=all}};
  const priorSaveStatusDraft=saveStatusDraft;saveStatusDraft=function(){const all=db.demand;db.demand=all.filter(activeDemand);try{return priorSaveStatusDraft()}finally{db.demand=all}};

  /* Correct Status Report progress after the older toolbar has counted status strings. */
  const priorStatusToolbar=renderStatusToolbar;renderStatusToolbar=function(){priorStatusToolbar();const source=statusReportState.editing?statusReportState.draftBuffer:statusReportDraft,updated=reportingRows(source).filter(x=>reportHasContent(x.entry)).length,total=db.demand.filter(activeDemand).length;const progress=$('statusReportProgress');if(progress)progress.textContent=`${updated} of ${total} active demand items have reporting updates.`};

  /* Make Config phase metadata follow the workflow draft while workflows are being edited. */
  const oldRenderConfig=renderConfig;
  renderConfig=function(){
    if(configState.editing&&configState.draft){
      const workflows=normalizeServiceWorkflows(configState.draft.serviceWorkflows||db.settings.serviceWorkflows||{}),maps=configState.draft.serviceWorkflowPhases||clone(db.settings.serviceWorkflowPhases||{}),defs=configState.draft.serviceWorkflowDefaults||clone(db.settings.serviceWorkflowDefaults||{});
      for(const [service,statuses] of Object.entries(workflows)){
        maps[service]=maps[service]||{};defs[service]=defs[service]||{};
        for(const status of statuses){if(!maps[service][status])maps[service][status]=window.amoPhaseForStatus(service,status)}
        for(const phase of window.AMO_DEMAND_PHASES||[]){const candidates=statuses.filter(s=>maps[service][s]===phase);if(candidates.length&&!candidates.includes(defs[service][phase]))defs[service][phase]=candidates[0]}
      }
      configState.draft.serviceWorkflowPhases=maps;configState.draft.serviceWorkflowDefaults=defs;
    }
    return oldRenderConfig()
  };

  /* A small visible Phase cue on Status Report keeps the reporting vocabulary aligned. */
  const oldSnapshotEntry=snapshotStatusEntry;snapshotStatusEntry=function(d,e){return{...oldSnapshotEntry(d,e),phase:phaseFor(d)}};
})();