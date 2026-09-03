/* Configured Role reference model and legacy People-role migration.
   Role is canonical configuration; People reference roles by roleId. The legacy Person.role text is
   maintained only as a compatibility display alias for older rendering code. */
(function initRoleModel(){
  if(window.__amoRoleModelLoaded)return;window.__amoRoleModelLoaded=true;

  const clean=v=>String(v??'').trim();
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function normalizeRoles(values){return(values||[]).map(r=>({id:clean(r?.id),name:clean(r?.name),dayRate:Math.max(0,Number(r?.dayRate)||0)})).filter(r=>r.id&&r.name)}
  function configuredRoles(settings=db.settings){return normalizeRoles(settings?.roles||[])}
  function roleById(id,settings=db.settings){return configuredRoles(settings).find(r=>r.id===id)||null}
  function personRole(p,settings=db.settings){return roleById(p?.roleId,settings)}
  function personRoleName(p,settings=db.settings){return personRole(p,settings)?.name||clean(p?.role)||'Unassigned'}
  function personRoleDayRate(p,settings=db.settings){return Number(personRole(p,settings)?.dayRate)||0}
  function nextRoleId(name,roles){const stem=`ROLE-${clean(name).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'ROLE'}`;let id=stem,n=2;while(roles.some(r=>r.id===id))id=`${stem}-${n++}`;return id}
  function legacyRateFor(name,settings){const fp=settings?.financialPlanning||{},mapped=fp.roleDayRates&&Object.prototype.hasOwnProperty.call(fp.roleDayRates,name)?Number(fp.roleDayRates[name]):null,flat=Number(fp.defaultDayRate);if(Number.isFinite(mapped)&&mapped>=0)return mapped;if(Number.isFinite(flat)&&flat>=0)return flat;return 0}
  function removeLegacyFinancialRates(settings){if(!settings?.financialPlanning)return false;let changed=false;if(Object.prototype.hasOwnProperty.call(settings.financialPlanning,'roleDayRates')){delete settings.financialPlanning.roleDayRates;changed=true}if(Object.prototype.hasOwnProperty.call(settings.financialPlanning,'defaultDayRate')){delete settings.financialPlanning.defaultDayRate;changed=true}if(!Object.keys(settings.financialPlanning).length){delete settings.financialPlanning;changed=true}return changed}

  const basePrepareRoles=prepareLoadedWorkspace;
  prepareLoadedWorkspace=function(rawBundle){
    const prepared=basePrepareRoles(rawBundle),settings=prepared.loadedSettings,persisted=prepared.configFiles?.['settings.json']||{},team=prepared.team||[];
    let roles=normalizeRoles(settings.roles||[]),settingsChanged=!eq(settings.roles||[],roles);const dirtyTeam=[];
    const byName=()=>new Map(roles.map(r=>[r.name.toLowerCase(),r]));
    for(const p of team){
      let role=roles.find(r=>r.id===p.roleId)||null;const legacyName=clean(p.role);
      if(!role&&legacyName)role=byName().get(legacyName.toLowerCase())||null;
      if(!role&&legacyName){role={id:nextRoleId(legacyName,roles),name:legacyName,dayRate:legacyRateFor(legacyName,settings)};roles.push(role);settingsChanged=true}
      const nextId=role?.id||'',nextAlias=role?.name||'';
      if(clean(p.roleId)!==nextId||clean(p.role)!==nextAlias){p.roleId=nextId;p.role=nextAlias;dirtyTeam.push(p.id)}
    }
    roles=normalizeRoles(roles);if(!eq(settings.roles||[],roles)){settings.roles=clone(roles);settingsChanged=true}
    persisted.roles=clone(roles);
    if(removeLegacyFinancialRates(settings))settingsChanged=true;removeLegacyFinancialRates(persisted);
    if(settingsChanged)prepared.configFiles['settings.json']=persisted;
    prepared.roleModelSettingsChanged=settingsChanged;prepared.roleModelDirtyTeamIds=dirtyTeam;
    return prepared
  };
  const baseApplyRoleMigration=applyMigrationDirtyState;
  applyMigrationDirtyState=function(prepared){
    baseApplyRoleMigration(prepared);
    if(!prepared?.roleModelSettingsChanged&&!prepared?.roleModelDirtyTeamIds?.length)return;
    if(prepared.roleModelSettingsChanged)configDirty=true;
    for(const id of prepared.roleModelDirtyTeamIds||[])dirtyRecords.team.add(id);
    updateBanner?.();log?.(`Materialized ${configuredRoles().length} configured Role${configuredRoles().length===1?'':'s'} and People role references.`);requestAutosave?.()
  };

  /* People grid: Role becomes a reference lookup. */
  if(typeof teamCols!=='undefined'){
    const idx=teamCols.findIndex(c=>c.key==='role'||c.key==='roleId');
    const col={key:'roleId',label:'Role',type:'select',filter:{type:'lookup'},values:()=>[{value:'',label:'Unassigned'},...configuredRoles().map(r=>({value:r.id,label:r.name}))],editable:true};
    if(idx>=0)teamCols.splice(idx,1,col);else teamCols.splice(Math.min(2,teamCols.length),0,col)
  }
  if(typeof displayVal==='function'){
    const baseRoleDisplay=displayVal;displayVal=function(row,col){if(col?.key==='roleId')return personRoleName(row);return baseRoleDisplay(row,col)}
  }
  if(typeof defaultTeamRecord==='function'){
    const baseDefaultTeamRole=defaultTeamRecord;defaultTeamRecord=function(){const r=baseDefaultTeamRole(),first=configuredRoles()[0];delete r.role;r.roleId=first?.id||'';r.role=first?.name||'';return r}
  }
  /* The Person/User module and the canonical record modal own the People form layout. Role only
     contributes role semantics. Preserve an existing roleId-aware modal (for example the Staff
     Number + Linked User form) instead of replacing it wholesale. If no richer renderer is loaded,
     fall back to the baseline People fields while still presenting Role as a configured lookup. */
  if(typeof renderTeamModal==='function'){
    const baseRenderTeamRole=renderTeamModal;
    renderTeamModal=function(r){
      const existing=baseRenderTeamRole(r);
      if(existing.includes('data-modal-field="roleId"'))return existing;
      const roles=[{value:'',label:'Unassigned'},...configuredRoles().map(x=>({value:x.id,label:x.name}))];
      return`<div class="record-form">${modalField('Team ID','id',r.id,'text',null,false,false,true)}${modalField('Staff Number','staffNumber',r.staffNumber||'','text',null,true)}${modalField('Name','name',r.name,'text',null,true)}${modalField('Role','roleId',r.roleId||'','select',roles)}${modalField('FTE','fte',r.fte,'number')}${modalField('Active','active',String(r.active),'select',[{value:'true',label:'Yes'},{value:'false',label:'No'}])}</div>`
    }
  }
  if(typeof saveTeamModal==='function'){
    const baseSaveTeamRole=saveTeamModal;saveTeamModal=function(next){const role=roleById(next.roleId);if(next.roleId&&!role){alert('Select a configured Role.');return}next.role=role?.name||'';return baseSaveTeamRole(next)}
  }
  if(typeof saveGrid==='function'){
    const baseSaveGridRole=saveGrid;saveGrid=function(name){if(name==='team'&&gridState.team?.draft)for(const p of gridState.team.draft){const role=roleById(p.roleId);p.role=role?.name||''}return baseSaveGridRole(name)}
  }

  window.normalizeRoles=normalizeRoles;window.configuredRoles=configuredRoles;window.roleById=roleById;window.personRole=personRole;window.personRoleName=personRoleName;window.personRoleDayRate=personRoleDayRate;
})();
