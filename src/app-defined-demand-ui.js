/* Canonical Step 4 Defined Demand record and list UX.
   Defined Demand owns early portfolio visibility; delivery detail belongs to Work Packages. */
(function initDefinedDemandUi(){
  if(!window.DefinedDemandModel)return;
  const model=window.DefinedDemandModel;
  const trim=v=>String(v??'').trim();
  const teamOptions=()=>typeof configuredTeams==='function'?configuredTeams().map(t=>({value:t.id,label:t.name})):[];
  const currentTeamDefault=()=>typeof departmentScope!=='undefined'&&departmentScope!=='department'?departmentScope:'';
  const sizeOptions=()=>[{value:'',label:'Not sized'},...Object.keys(db.settings.demandSizeDays||model.DEFAULT_SIZE_DAYS).map(size=>({value:size,label:size}))];
  const healthOptions=()=>[{value:'',label:'Not assessed'},...(db.settings.healthStates||[]).map(x=>({value:x,label:x}))];
  const section=(title,description='')=>`<div class="field full view-section"><h3 style="margin-bottom:4px">${escHtml(title)}</h3>${description?`<div class="muted">${escHtml(description)}</div>`:''}</div>`;

  /* Department ownership is optional for Defined Demand at intake. Keep the People migration from the
     department model, but never silently assign Demand to the first Team. */
  if(typeof ensureDepartmentModel==='function')ensureDepartmentModel=function(){let changed=false;db.workspace.department=db.workspace.department||clone(DEFAULT_DEPARTMENT);let teams=normalizeTeams(db.settings.teams);if(!teams.length){teams=clone(DEFAULT_TEAMS);db.settings.teams=teams;changed=true}const fallback=teams[0]?.id||'TEAM-EA';for(const p of db.team){if(!teams.some(t=>t.id===p.teamId)){p.teamId=fallback;markDirty('team',p.id,`Assigned ${p.id} to home team ${fallback}.`);changed=true}}if(changed){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}return changed};

  defaultDemandRecord=function(){
    const rows=gridState.demand.editing?gridState.demand.draft:db.demand,max=Math.max(0,...rows.map(d=>Number((d.id||'').match(/(\d+)$/)?.[1]||0)));
    return{id:`DEM-${CURRENT_YEAR}-${String(max+1).padStart(4,'0')}`,title:'',businessArea:'',initiative:'',teamId:currentTeamDefault(),projectNumber:'',priority:(db.settings.priorities||[])[0]||'',status:(db.settings.statuses||model.DEMAND_STATES)[0]||'Assessing',ownerId:null,initialEstimate:{size:'',estimatedDays:null},health:'',context:'',source:{type:'SharePoint',id:'',url:'',title:''},version:1,demandModelVersion:model.MODEL_VERSION}
  };

  renderDemandModal=function(r){
    model.normalizeDemand(r,db.settings);const initiativeOpts=[{value:'',label:'—'},...initiativesForBusinessArea(r.businessArea).map(i=>({value:i.name,label:i.name}))],ownerOpts=[{value:'',label:'Unallocated'},...db.team.map(t=>({value:t.id,label:t.name}))],size=r.initialEstimate?.size||'',initialDays=r.initialEstimate?.estimatedDays;
    const teams=teamOptions(),teamField=teams.length?modalField('Owning Team','teamId',r.teamId||'','select',[{value:'',label:'Unassigned'},...teams]):'';
    const core=`${section('Defined Demand','Create early visibility with only a title and Business Area; everything else can be refined later.')}${modalField('Demand ID','id',r.id,'text',null,false,false,true)}${modalField('Title','title',r.title,'text',null,true)}${modalField('Business Area','businessArea',r.businessArea,'select',db.settings.businessAreas||[],true)}${modalField('Initiative','initiative',r.initiative,'select',initiativeOpts)}${teamField}${modalField('Priority','priority',r.priority,'select',db.settings.priorities||[])}${modalField('Demand State','status',r.status,'select',db.settings.statuses||model.DEMAND_STATES)}${modalField('Initial Size','initialEstimate.size',size,'select',sizeOptions())}${modalField('Initial ROM (days)','initialEstimate.estimatedDays',initialDays??'','number',null,false,false,true)}`;
    const further=`${section('Further details','Optional portfolio context. Delivery service, detailed scope, dates and refined estimates belong to Work Packages.')}${modalField('Architecture Owner','ownerId',r.ownerId||'','select',ownerOpts)}${modalField('Project Number','projectNumber',r.projectNumber||'','text')}${modalField('Health','health',r.health||'','select',healthOptions())}${modalField('Summary / Context','context',r.context||'','textarea',null,false,true)}${modalLinkField('Demand Source — Front Door','source.url',r.source?.url||'','source.title',r.source?.title||'','source')}`;
    const planning=window.AmoDemandPlanning?.renderSection?.(r)||'';
    return `<div class="record-form">${core}${further}${planning}</div>`
  };

  const baseRenderRecordModal=renderRecordModal;
  renderRecordModal=function(){baseRenderRecordModal();if(recordModalState.type!=='demand')return;const body=$('recordModalBody');if(!body)return;if(recordModalState.mode==='edit'){body.querySelector('[data-modal-field="initialEstimate.size"]')?.addEventListener('change',e=>{const next=readModalDraft(),size=e.target.value;next.initialEstimate=next.initialEstimate||{};next.initialEstimate.size=size;next.initialEstimate.estimatedDays=size?Number(db.settings.demandSizeDays?.[size]??model.DEFAULT_SIZE_DAYS[size]):null;recordModalState.draft=next;renderRecordModal()});window.AmoDemandPlanning?.afterRender?.(body,recordModalState)}};

  const baseReadModalDraft=readModalDraft;
  readModalDraft=function(){const next=baseReadModalDraft();if(recordModalState.type==='demand'){const v=getPath(next,'initialEstimate.estimatedDays');if(v!==undefined)next.initialEstimate.estimatedDays=v===''?null:Number(v)}return next};

  function validateDemand(next,id=recordModalState.id){
    if(!trim(next.title)||!trim(next.businessArea)){alert('Title and Business Area are required.');return false}
    if(next.initiative&&!initiativesForBusinessArea(next.businessArea).some(i=>i.name===next.initiative)){alert(`Initiative ${next.initiative} does not belong to Business Area ${next.businessArea}.`);return false}
    if(next.teamId&&typeof teamById==='function'&&!teamById(next.teamId)){alert('Owning Team must reference a configured Team or be left unassigned.');return false}
    if(!db.settings.statuses?.includes(next.status)){alert(`Demand State ${next.status||'—'} is not configured.`);return false}
    next.projectNumber=trim(next.projectNumber);if(next.projectNumber&&!/^\d+$/.test(next.projectNumber)){alert('Project Number must contain digits only.');return false}
    const demandRows=gridState.demand.editing?gridState.demand.draft:db.demand,duplicateProject=next.projectNumber&&demandRows.find(d=>d.id!==id&&trim(d.projectNumber)===next.projectNumber);if(duplicateProject){alert(`Project Number ${next.projectNumber} is already assigned to ${duplicateProject.id} — ${duplicateProject.title}.`);return false}
    if(!validHttpUrl(next.source?.url||'')){alert('Demand Source must be a valid http(s) URL.');return false}return true
  }
  function finalizeDemand(next,old=null){const size=trim(next.initialEstimate?.size).toUpperCase();next.initialEstimate=next.initialEstimate||{};next.initialEstimate.size=size;if(!size)next.initialEstimate.estimatedDays=null;else if(!old||trim(old.initialEstimate?.size).toUpperCase()!==size||next.initialEstimate.estimatedDays==null)next.initialEstimate.estimatedDays=Number(db.settings.demandSizeDays?.[size]??model.DEFAULT_SIZE_DAYS[size]);next.ownerId=trim(next.ownerId)||null;next.teamId=trim(next.teamId);next.context=trim(next.context);next.status=model.canonicalState(next.status);next=window.AmoDemandPlanning?.beforeSave?.(next,old)||next;next=model.cleanForSave(next,db.settings);delete next.costCentreOrProjectCode;delete next.projectNumbers;delete next.projectCodes;delete next.azureDevOps;return next}

  saveDemandModal=function(next){if(!validateDemand(next))return;const old=recordModalState.isNew?null:demandById(recordModalState.id);next=finalizeDemand(next,old);if(recordModalState.isNew){if(demandById(next.id)){alert('Demand ID already exists.');return}if(gridState.demand.editing)gridState.demand.draft.push(next);else{db.demand.push(next);markDirty('demand',next.id,`Created ${next.id}.`)}}else if(gridState.demand.editing){const row=gridState.demand.draft.find(x=>x.id===recordModalState.id);Object.keys(row).forEach(k=>delete row[k]);Object.assign(row,next)}else{const target=demandById(recordModalState.id);Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,next);target.version=(Number(target.version)||0)+1;target.modifiedAt=new Date().toISOString();markDirty('demand',target.id,`Updated ${target.id}.`)}closeRecordModal();refreshAll()};

  /* Own Demand list persistence so legacy organisation wrappers cannot make Team mandatory. */
  const legacySaveGrid=saveGrid;
  function saveDemandGrid(){const s=gridState.demand,original=db.demand,deleteIds=new Set(s.deleted);for(let i=0;i<s.draft.length;i++){if(deleteIds.has(s.draft[i].id))continue;const old=original.find(x=>x.id===s.draft[i].id)||null;if(!validateDemand(s.draft[i],s.draft[i].id))return;s.draft[i]=finalizeDemand(s.draft[i],old)}if(deleteIds.size){if(!window.WorkPackages||window.WorkPackages.state?.loading||window.WorkPackages.state?.loaded===false){alert('Work Packages are not ready yet. Wait for the workspace to finish loading before deleting Demand.');return}const withChildren=[...deleteIds].map(id=>({id,count:window.WorkPackages.forDemand(id).length})).filter(x=>x.count);if(withChildren.length){alert(`Cannot delete Demand with child Work Packages. Delete the Work Packages first: ${withChildren.map(x=>`${x.id} (${x.count})`).join(', ')}.`);return}}
    for(const next of s.draft){if(deleteIds.has(next.id))continue;const old=original.find(x=>x.id===next.id);if(!old){original.push(clone(next));markDirty('demand',next.id,`Created ${next.id}.`)}else if(JSON.stringify(old)!==JSON.stringify(next)){Object.keys(old).forEach(k=>delete old[k]);Object.assign(old,clone(next));old.version=(Number(old.version)||0)+1;old.modifiedAt=new Date().toISOString();markDirty('demand',next.id,`Updated ${next.id}.`)}}
    if(deleteIds.size){for(const id of deleteIds){deletedDemand.add(id);dirtyRecords.demand.delete(id);const dependent=db.allocations.filter(a=>a.demandId===id);dependent.forEach(a=>{deletedAllocations.add(a.id);dirtyRecords.allocations.delete(a.id)});db.allocations=db.allocations.filter(a=>a.demandId!==id)}db.demand=db.demand.filter(d=>!deleteIds.has(d.id));log(`Deleted ${deleteIds.size} demand record${deleteIds.size===1?'':'s'} and removed dependent allocations where applicable.`)}s.editing=false;s.draft=null;s.deleted=new Set();updateBanner();refreshAll();if(typeof requestAutosave==='function')requestAutosave()
  }
  saveGrid=function(name){return name==='demand'?saveDemandGrid():legacySaveGrid(name)};

  /* Integration renderer keeps the canonical Demand column list but has its own display hook. */
  if(typeof integratedDemandValue==='function'){const baseIntegratedDemandValue=integratedDemandValue;integratedDemandValue=function(row,col){if(col.key==='ownerId')return ownerName(row);return baseIntegratedDemandValue(row,col)}}

  window.DefinedDemandUi={sizeOptions,validateDemand,finalizeDemand};
})();
