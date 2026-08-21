/* Operating-model alignment: Triage -> Mobilisation -> Engaged -> Governance -> Exit. */
(function alignArchitectureLifecycle(){
  const MODEL_VERSION=2;
  const OLD_DEFAULTS={
    Triage:['Triage','Prioritisation','Accepted','Rejected','Closed'],
    Consultancy:['Assessment','Prioritisation','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled'],
    Assurance:['Assessment','Prioritisation','Mobilisation','Assurance Review','Findings / Remediation','Governance / Approval','Complete','On Hold','Cancelled'],
    Design:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled'],
    Strategy:['Assessment','Prioritisation','Mobilisation','Discovery','Analysis','Strategy Development','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled']
  };
  const REVISED_DEFAULTS={
    Triage:['Triage','Assessment','Accepted','Rejected','Closed'],
    Consultancy:['Prioritisation','Mobilisation','In Progress','Review','Complete','On Hold','Cancelled'],
    Assurance:['Prioritisation','Mobilisation','Assurance Review','Findings / Remediation','Governance / Approval','Complete','On Hold','Cancelled'],
    Design:['Prioritisation','Mobilisation','Discovery','Analysis / Design','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled'],
    Strategy:['Prioritisation','Mobilisation','Discovery','Analysis','Strategy Development','Socialisation / Review','Approval','Governance','Complete','On Hold','Cancelled']
  };
  const same=(a,b)=>JSON.stringify(a||[])===JSON.stringify(b||[]);

  /* DEFAULT_SERVICE_WORKFLOWS is a const object, but its service arrays are intentionally mutable here. */
  if(typeof DEFAULT_SERVICE_WORKFLOWS==='object')for(const [service,statuses] of Object.entries(REVISED_DEFAULTS))DEFAULT_SERVICE_WORKFLOWS[service]=[...statuses];

  function canonicalPhase(service,status){
    const s=String(status||'').toLowerCase();
    if(/complete|closed|cancel|reject|declin|withdraw|abandon|supersed|refer/.test(s))return'Exit';
    if(service==='Triage')return' Triage'.trim();
    if(/approval|governance/.test(s))return'Governance';
    if(/discovery|analysis|design|social|review|finding|remediation|strategy|in progress|on hold/.test(s))return'Engaged';
    if(/assessment|triage|aia|accepted/.test(s))return'Triage';
    return'Mobilisation';
  }
  function rebuildPhaseMetadata(){
    const workflows=serviceWorkflows(),maps=db.settings.serviceWorkflowPhases=db.settings.serviceWorkflowPhases||{},defs=db.settings.serviceWorkflowDefaults=db.settings.serviceWorkflowDefaults||{};
    for(const [service,statuses] of Object.entries(workflows)){
      maps[service]=maps[service]||{};defs[service]=defs[service]||{};
      for(const status of statuses)maps[service][status]=canonicalPhase(service,status);
      for(const phase of window.AMO_DEMAND_PHASES||['Triage','Mobilisation','Engaged','Governance','Exit']){
        const candidates=statuses.filter(s=>maps[service][s]===phase);
        if(candidates.length)defs[service][phase]=candidates[0];else delete defs[service][phase]
      }
    }
  }
  function migrateDefaultWorkflows(){
    const workflows=normalizeServiceWorkflows(db.settings.serviceWorkflows||{});let changed=false;
    for(const [service,revised] of Object.entries(REVISED_DEFAULTS)){
      if(same(workflows[service],OLD_DEFAULTS[service])){workflows[service]=[...revised];changed=true}
    }
    if(changed){
      for(const d of db.demand){
        if(d.service==='Triage'&&d.status==='Prioritisation')d.status='Accepted';
        else if(d.service!=='Triage'&&d.status==='Assessment')d.status='Prioritisation';
      }
      db.settings.serviceWorkflows=workflows;
      db.settings.statuses=allWorkflowStatuses(workflows);
    }
    return changed
  }

  const priorOpen=openWorkspace;
  openWorkspace=async function(){
    await priorOpen();if(!workspaceHandle)return;
    if(Number(db.settings.lifecyclePhaseModelVersion||0)>=MODEL_VERSION)return;
    const workflowChanged=migrateDefaultWorkflows();
    rebuildPhaseMetadata();
    db.settings.lifecyclePhaseModelVersion=MODEL_VERSION;
    db.configFiles['settings.json']=clone(db.settings);configDirty=true;
    for(const d of db.demand){
      const next=window.amoPhaseForStatus?window.amoPhaseForStatus(d.service,d.status):canonicalPhase(d.service,d.status);
      if(d.phase!==next){d.phase=next;markDirty('demand',d.id,`Aligned ${d.id} to lifecycle Phase ${next}.`)}
    }
    requestAutosave();refreshAll();renderStatusReporting?.();renderConfig?.();
    log(workflowChanged?'Aligned default service workflows to the Architecture operating model.':'Aligned lifecycle Phase metadata to the Architecture operating model.');
  };
  const btn=document.getElementById('openWorkspaceBtn');if(btn)btn.onclick=()=>openWorkspace();
})();
