/* Step 4 compatibility bridge for older organisation wrappers.
   The canonical Defined Demand model and editor live in app-demand-model.js and app-record-modal.js.
   This bridge only prevents older Department-era wrappers from re-imposing mandatory Team ownership. */
(function initDefinedDemandCompatibility(){
  if(!window.DefinedDemandModel)return;

  /* app-department.js captured the canonical functions before applying its legacy mandatory-Team
     decorators. Restore those originals rather than maintaining a second Demand implementation. */
  if(typeof deptDefaultDemand==='function')defaultDemandRecord=deptDefaultDemand;
  if(typeof deptRenderDemandModal==='function')renderDemandModal=deptRenderDemandModal;
  if(typeof deptSaveDemandModal==='function')saveDemandModal=deptSaveDemandModal;
  if(typeof deptSaveGrid==='function')saveGrid=deptSaveGrid;

  /* Defined Demand may legitimately be visible before an Owning Team is known. People retain the
     existing Home Team migration because People capacity always belongs to a configured Team. */
  if(typeof ensureDepartmentModel==='function')ensureDepartmentModel=function(){
    let changed=false;db.workspace.department=db.workspace.department||clone(DEFAULT_DEPARTMENT);let teams=normalizeTeams(db.settings.teams);
    if(!teams.length){teams=clone(DEFAULT_TEAMS);db.settings.teams=teams;changed=true}
    const fallback=teams[0]?.id||'TEAM-EA';
    for(const p of db.team){if(!teams.some(t=>t.id===p.teamId)){p.teamId=fallback;markDirty('team',p.id,`Assigned ${p.id} to home team ${fallback}.`);changed=true}}
    if(changed){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}
    return changed
  };

  const demandTeamCol=demandCols.find(c=>c.key==='teamId');
  if(demandTeamCol){demandTeamCol.label='Owning Team';demandTeamCol.values=()=>[{value:'',label:'Unassigned'},...configuredTeams().map(t=>({value:t.id,label:t.name}))]}

  /* In a Team-scoped view a newly-created Demand naturally defaults to that Team. Whole-Department
     creation remains deliberately unassigned until ownership is known. */
  const canonicalDefaultDemand=defaultDemandRecord;
  defaultDemandRecord=function(){const r=canonicalDefaultDemand();if(typeof departmentScope!=='undefined'&&departmentScope!=='department')r.teamId=departmentScope;return r};

  /* The older Team-configuration decorator assumes every Demand already has a Team. During its
     validation only, represent genuinely unassigned Demand with a surviving configured Team so they
     do not block unrelated Team-name/configuration changes. Explicit unknown Team references remain
     untouched and therefore still fail validation. No Demand record is mutated. */
  if(typeof saveConfigChanges==='function'){
    const legacyDepartmentSaveConfig=saveConfigChanges;
    saveConfigChanges=function(){
      if(!configState.editing)return legacyDepartmentSaveConfig();
      const configured=normalizeTeams(configState.draft?.teams),fallback=configured[0]?.id||'',original=db.demand;
      if(!fallback)return legacyDepartmentSaveConfig();
      db.demand=original.map(d=>d.teamId?d:{...d,teamId:fallback});
      try{return legacyDepartmentSaveConfig()}finally{db.demand=original}
    }
  }

  window.DefinedDemandUi={compatibilityOnly:true};
})();
