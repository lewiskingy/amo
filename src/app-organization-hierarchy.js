/* First-class Organisation -> Department -> Team hierarchy and dependent page scope.
   Organization Structure editing is owned by the canonical Organization Settings transaction. */
(function initOrganizationHierarchy(){
  if(window.__amoOrganizationHierarchyLoaded)return;window.__amoOrganizationHierarchyLoaded=true;

  const ORG_SCOPE='organization',DEPARTMENT_ALL='department';
  const clean=v=>String(v??'').trim(),lower=v=>clean(v).toLowerCase();
  const esc=v=>typeof escHtml==='function'?escHtml(v):clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cloneValue=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const settings=()=>{try{return db?.settings||{}}catch{return{}}};
  let selectedDepartmentId=ORG_SCOPE,scopeInitialised=false;

  function legacyDepartment(){try{return db?.workspace?.department||window.DEFAULT_DEPARTMENT||{id:'DEPT-ARCH',name:'Architecture'}}catch{return{id:'DEPT-ARCH',name:'Architecture'}}}
  function normalizeDepartments(value){
    const source=Array.isArray(value)?value:[];
    const rows=source.map((x,i)=>{if(typeof x==='string')return{id:`DEPT-${String(i+1).padStart(2,'0')}`,name:clean(x)};return{...cloneValue(x||{}),id:clean(x?.id),name:clean(x?.name)}}).filter(x=>x.id&&x.name);
    if(rows.length)return rows;const legacy=legacyDepartment();return[{id:clean(legacy.id)||'DEPT-ARCH',name:clean(legacy.name)||'Architecture'}]
  }
  function configuredDepartments(){return normalizeDepartments(settings().departments)}
  function departmentById(id){return configuredDepartments().find(d=>d.id===id)||null}

  normalizeTeams=function(value){
    const departments=configuredDepartments(),fallback=departments[0]?.id||'DEPT-ARCH',source=Array.isArray(value)?value:[];
    return source.map((x,i)=>{if(typeof x==='string')return{id:`TEAM-${String(i+1).padStart(2,'0')}`,name:clean(x),departmentId:fallback};return{...cloneValue(x||{}),id:clean(x?.id),name:clean(x?.name),departmentId:clean(x?.departmentId)||fallback}}).filter(x=>x.id&&x.name)
  };
  configuredTeams=function(){const rows=normalizeTeams(settings().teams);if(rows.length)return rows;return normalizeTeams(window.DEFAULT_TEAMS||[])};
  teamById=function(id){return configuredTeams().find(t=>t.id===id)||null};
  function teamsForDepartment(id){return id===ORG_SCOPE?configuredTeams():configuredTeams().filter(t=>t.departmentId===id)}
  function departmentForTeam(teamId){const t=teamById(teamId);return t?departmentById(t.departmentId):null}
  configuredDepartment=function(){return selectedDepartmentId===ORG_SCOPE?{id:ORG_SCOPE,name:'Organisation'}:(departmentById(selectedDepartmentId)||configuredDepartments()[0])};

  function teamOptionLabel(team){const dep=departmentById(team?.departmentId);return dep?`${dep.name} · ${team.name}`:team?.name||team?.id||''}
  function allTeamOptions({unassigned=false}={}){return[...(unassigned?[{value:'',label:'Unassigned'}]:[]),...configuredTeams().map(t=>({value:t.id,label:teamOptionLabel(t)}))]}
  owningTeamOptions=function(){return allTeamOptions({unassigned:true})};

  function validSelectedTeam(){const t=departmentScope===DEPARTMENT_ALL?null:teamById(departmentScope);if(!t)return null;if(selectedDepartmentId!==ORG_SCOPE&&t.departmentId!==selectedDepartmentId)return null;return t}
  function normalizeScope(){if(selectedDepartmentId!==ORG_SCOPE&&!departmentById(selectedDepartmentId))selectedDepartmentId=ORG_SCOPE;if(departmentScope!==DEPARTMENT_ALL&&!validSelectedTeam())departmentScope=DEPARTMENT_ALL}
  demandInScope=function(d){normalizeScope();const team=teamById(d?.teamId);if(!team)return false;if(selectedDepartmentId!==ORG_SCOPE&&team.departmentId!==selectedDepartmentId)return false;return departmentScope===DEPARTMENT_ALL||team.id===departmentScope};
  personInScope=function(p){normalizeScope();const team=teamById(p?.teamId);if(!team)return false;if(selectedDepartmentId!==ORG_SCOPE&&team.departmentId!==selectedDepartmentId)return false;return departmentScope===DEPARTMENT_ALL||team.id===departmentScope};
  scopedDemand=function(){return Array.isArray(db?.demand)?db.demand.filter(demandInScope):[]};
  scopedPeople=function(){return Array.isArray(db?.team)?db.team.filter(personInScope):[]};
  scopedAllocations=function(){const ids=new Set(scopedDemand().map(d=>d.id));return(Array.isArray(db?.allocations)?db.allocations:[]).filter(a=>ids.has(a.demandId))};
  scopeLabel=function(){normalizeScope();const dep=selectedDepartmentId===ORG_SCOPE?'Whole Org':(departmentById(selectedDepartmentId)?.name||'Whole Org'),team=departmentScope===DEPARTMENT_ALL?(selectedDepartmentId===ORG_SCOPE?'All Teams':'Whole Department'):(teamById(departmentScope)?.name||'Whole Department');return departmentScope===DEPARTMENT_ALL?dep:`${dep} · ${team}`};

  function hierarchyStyles(){if(document.getElementById('amo-organization-hierarchy-styles'))return;const style=document.createElement('style');style.id='amo-organization-hierarchy-styles';style.textContent=`#scopeSelector.amo-hierarchy-scope{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#scopeSelector.amo-hierarchy-scope .amo-scope-field{display:flex;align-items:center;gap:5px}#scopeSelector.amo-hierarchy-scope select{max-width:210px}@media(max-width:760px){#scopeSelector.amo-hierarchy-scope{width:100%;order:4}#scopeSelector.amo-hierarchy-scope .amo-scope-field{flex:1 1 160px}#scopeSelector.amo-hierarchy-scope select{width:100%;max-width:none}}`;document.head.appendChild(style)}
  function refreshScopedViews(){try{refreshAll?.()}catch(e){console.error('AMO scope refresh failed.',e)}try{renderStatusReporting?.()}catch(_e){}try{renderStatusHistory?.()}catch(_e){}renderScopeSelector()}
  renderScopeSelector=function(){
    hierarchyStyles();normalizeScope();let host=document.getElementById('scopeSelector');if(!host){host=document.createElement('div');host.id='scopeSelector';document.querySelector('.top-actions')?.prepend(host)}
    host.className='scope-selector amo-hierarchy-scope';host.title='Department limits the organisational boundary. Team then limits the selected Department to one Home/Owning Team.';const deps=configuredDepartments(),teams=teamsForDepartment(selectedDepartmentId);
    host.innerHTML=`<label class="amo-scope-field"><span>Department</span><select id="departmentScopeSelect"><option value="${ORG_SCOPE}">Whole Org</option>${deps.map(d=>`<option value="${esc(d.id)}" ${selectedDepartmentId===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><label class="amo-scope-field"><span>Team</span><select id="teamScopeSelect" ${selectedDepartmentId===ORG_SCOPE?'disabled':''}><option value="${DEPARTMENT_ALL}">${selectedDepartmentId===ORG_SCOPE?'All Teams':'Whole Department'}</option>${teams.map(t=>`<option value="${esc(t.id)}" ${departmentScope===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`;
    host.querySelector('#departmentScopeSelect')?.addEventListener('change',e=>{selectedDepartmentId=e.target.value||ORG_SCOPE;departmentScope=DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews();log?.(`Department view changed to ${scopeLabel()}.`)});host.querySelector('#teamScopeSelect')?.addEventListener('change',e=>{departmentScope=e.target.value||DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews();log?.(`Team view changed to ${scopeLabel()}.`)})
  };

  function linkedPersonForCurrentUser(){const principal=window.amoAccess?.currentPrincipal?.();if(!principal?.mapped||!principal.user?.id)return null;return(Array.isArray(db?.team)?db.team:[]).find(p=>clean(p?.userId)===clean(principal.user.id))||null}
  function applyUserDefaultScope(){if(scopeInitialised)return;const principal=window.amoAccess?.currentPrincipal?.();if(!principal?.authenticated){selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL;renderScopeSelector();return}const person=linkedPersonForCurrentUser(),team=person?teamById(person.teamId):null;if(team){selectedDepartmentId=team.departmentId;departmentScope=team.id}else{selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL}scopeInitialised=true;refreshScopedViews()}

  function validateStructure(departments,teams){
    if(!departments.length)throw new Error('At least one Department is required.');if(new Set(departments.map(d=>lower(d.id))).size!==departments.length)throw new Error('Department IDs must be unique.');if(new Set(departments.map(d=>lower(d.name))).size!==departments.length)throw new Error('Department names must be unique.');if(!teams.length)throw new Error('At least one Team is required.');if(new Set(teams.map(t=>lower(t.id))).size!==teams.length)throw new Error('Team IDs must be unique.');if(new Set(teams.map(t=>lower(t.name))).size!==teams.length)throw new Error('Team names must be unique.');for(const t of teams)if(!departments.some(d=>d.id===t.departmentId))throw new Error(`Team ${t.name||t.id} must belong to a valid Department.`);for(const p of db.team||[])if(!teams.some(t=>t.id===p.teamId))throw new Error(`Cannot remove Team ${p.teamId}; Person ${p.name||p.id} still belongs to it.`);for(const d of db.demand||[])if(d.teamId&&!teams.some(t=>t.id===d.teamId))throw new Error(`Cannot remove Team ${d.teamId}; Demand ${d.id} still references it.`);return true
  }
  function migrateHierarchy(){
    if(!window.workspaceRepository||!db?.settings)return false;let changed=false;const departments=normalizeDepartments(db.settings.departments);if(!Array.isArray(db.settings.departments)||JSON.stringify(db.settings.departments)!==JSON.stringify(departments)){db.settings.departments=departments;changed=true}const teams=normalizeTeams(db.settings.teams),fallback=departments[0]?.id||'DEPT-ARCH';for(const t of teams)if(!departments.some(d=>d.id===t.departmentId)){t.departmentId=fallback;changed=true}if(JSON.stringify(db.settings.teams||[])!==JSON.stringify(teams)){db.settings.teams=teams;changed=true}const fallbackTeam=teams[0]?.id||'';for(const p of db.team||[]){if(!teamById(p.teamId)&&fallbackTeam){p.teamId=fallbackTeam;markDirty?.('team',p.id,`Assigned ${p.id} to Home Team ${fallbackTeam}.`);changed=true}}for(const d of db.demand||[]){if(!d.teamId&&typeof demandIsTriage==='function'&&demandIsTriage(d))continue;if(!teamById(d.teamId)&&fallbackTeam){d.teamId=fallbackTeam;markDirty?.('demand',d.id,`Assigned ${d.id} to Owning Team ${fallbackTeam}.`);changed=true}}if(changed){db.configFiles=db.configFiles||{};db.configFiles['settings.json']=cloneValue(db.settings);configDirty=true;requestAutosave?.()}return changed
  }
  ensureDepartmentModel=function(){return migrateHierarchy()};

  function defaultTeamForScope(){const selected=validSelectedTeam();if(selected)return selected.id;const current=linkedPersonForCurrentUser(),home=current?teamById(current.teamId):null;if(home&&(selectedDepartmentId===ORG_SCOPE||home.departmentId===selectedDepartmentId))return home.id;return teamsForDepartment(selectedDepartmentId)[0]?.id||configuredTeams()[0]?.id||''}
  if(typeof defaultDemandRecord==='function'){const base=defaultDemandRecord;defaultDemandRecord=function(){const row=base();row.teamId=defaultTeamForScope();return row}}
  if(typeof defaultTeamRecord==='function'){const base=defaultTeamRecord;defaultTeamRecord=function(){const row=base();row.teamId=defaultTeamForScope();return row}}

  function addDerivedDepartmentColumn(columns,teamKey){if(!Array.isArray(columns)||columns.some(c=>c.key==='departmentId'))return;const index=Math.max(0,columns.findIndex(c=>c.key===teamKey));columns.splice(index<0?1:index,0,{key:'departmentId',label:'Department',editable:false})}
  addDerivedDepartmentColumn(typeof demandCols!=='undefined'?demandCols:null,'teamId');addDerivedDepartmentColumn(typeof teamCols!=='undefined'?teamCols:null,'teamId');
  if(typeof displayVal==='function'){const base=displayVal;displayVal=function(row,col){if(col?.key==='departmentId'){const dep=departmentForTeam(row?.teamId);return dep?.name||'Unassigned'}return base(row,col)}}
  const demandTeamCol=typeof demandCols!=='undefined'?demandCols.find(c=>c.key==='teamId'):null;if(demandTeamCol)demandTeamCol.values=()=>allTeamOptions({unassigned:true});const peopleTeamCol=typeof teamCols!=='undefined'?teamCols.find(c=>c.key==='teamId'):null;if(peopleTeamCol)peopleTeamCol.values=()=>allTeamOptions();
  if(typeof renderAllocations==='function'){const base=renderAllocations;renderAllocations=function(){const allDemand=db.demand,allAlloc=db.allocations,demand=scopedDemand(),ids=new Set(demand.map(d=>d.id));db.demand=demand;db.allocations=allAlloc.filter(a=>ids.has(a.demandId));try{return base.apply(this,arguments)}finally{db.demand=allDemand;db.allocations=allAlloc}}}

  function initialize(){hierarchyStyles();migrateHierarchy();normalizeScope();renderScopeSelector();applyUserDefaultScope();try{renderGrid?.('team');renderGrid?.('demand')}catch(_e){}}
  window.addEventListener('amo-workspace-connected',()=>{scopeInitialised=false;selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL;setTimeout(initialize,0)});window.addEventListener('amo-access-changed',()=>{if(!scopeInitialised)setTimeout(applyUserDefaultScope,0)});window.addEventListener('amo-settings-updated',event=>{if(event.detail?.keys?.some(key=>key==='departments'||key==='teams')){normalizeScope();renderScopeSelector()}});setTimeout(initialize,0);

  window.amoOrganizationHierarchy={configuredDepartments,departmentById,departmentForTeam,teamsForDepartment,normalizeDepartments,normalizeTeams,validateStructure,selectedDepartment:()=>selectedDepartmentId,selectedTeam:()=>departmentScope,setScope:(departmentId,teamId=DEPARTMENT_ALL)=>{selectedDepartmentId=departmentId||ORG_SCOPE;departmentScope=teamId||DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews()}}
})();
