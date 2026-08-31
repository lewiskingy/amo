/* First-class Organisation -> Department -> Team hierarchy and dependent page scope. */
(function initOrganizationHierarchy(){
  if(window.__amoOrganizationHierarchyLoaded)return;window.__amoOrganizationHierarchyLoaded=true;

  const ORG_SCOPE='organization';
  const DEPARTMENT_ALL='department';
  const clean=v=>String(v??'').trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>typeof escHtml==='function'?escHtml(v):clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cloneValue=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const settings=()=>{try{return db?.settings||{}}catch{return{}}};
  let selectedDepartmentId=ORG_SCOPE;
  let scopeInitialised=false;
  let structureEditing=false;
  let structureDraft=null;
  let configDecorating=false;

  function legacyDepartment(){
    try{return db?.workspace?.department||window.DEFAULT_DEPARTMENT||{id:'DEPT-ARCH',name:'Architecture'}}catch{return{id:'DEPT-ARCH',name:'Architecture'}}
  }
  function normalizeDepartments(value){
    const source=Array.isArray(value)?value:[];
    const rows=source.map((x,i)=>typeof x==='string'?{id:`DEPT-${String(i+1).padStart(2,'0')}`,name:clean(x)}:{id:clean(x?.id),name:clean(x?.name)}).filter(x=>x.id&&x.name);
    if(rows.length)return rows;
    const legacy=legacyDepartment();return[{id:clean(legacy.id)||'DEPT-ARCH',name:clean(legacy.name)||'Architecture'}]
  }
  function configuredDepartments(){return normalizeDepartments(settings().departments)}
  function departmentById(id){return configuredDepartments().find(d=>d.id===id)||null}

  normalizeTeams=function(value){
    const departments=configuredDepartments(),fallback=departments[0]?.id||'DEPT-ARCH';
    const source=Array.isArray(value)?value:[];
    return source.map((x,i)=>{
      if(typeof x==='string')return{id:`TEAM-${String(i+1).padStart(2,'0')}`,name:clean(x),departmentId:fallback};
      return{id:clean(x?.id),name:clean(x?.name),departmentId:clean(x?.departmentId)||fallback}
    }).filter(x=>x.id&&x.name)
  };
  configuredTeams=function(){
    const rows=normalizeTeams(settings().teams);
    if(rows.length)return rows;
    const fallback=window.DEFAULT_TEAMS||[];return normalizeTeams(fallback)
  };
  teamById=function(id){return configuredTeams().find(t=>t.id===id)||null};
  function teamsForDepartment(id){return id===ORG_SCOPE?configuredTeams():configuredTeams().filter(t=>t.departmentId===id)}
  function departmentForTeam(teamId){const t=teamById(teamId);return t?departmentById(t.departmentId):null}
  configuredDepartment=function(){return selectedDepartmentId===ORG_SCOPE?{id:ORG_SCOPE,name:'Organisation'}:(departmentById(selectedDepartmentId)||configuredDepartments()[0])};

  function teamOptionLabel(team){const dep=departmentById(team?.departmentId);return dep?`${dep.name} · ${team.name}`:team?.name||team?.id||''}
  function allTeamOptions({unassigned=false}={}){return[...(unassigned?[{value:'',label:'Unassigned'}]:[]),...configuredTeams().map(t=>({value:t.id,label:teamOptionLabel(t)}))]}
  owningTeamOptions=function(){return allTeamOptions({unassigned:true})};

  function validSelectedTeam(){const t=departmentScope===DEPARTMENT_ALL?null:teamById(departmentScope);if(!t)return null;if(selectedDepartmentId!==ORG_SCOPE&&t.departmentId!==selectedDepartmentId)return null;return t}
  function normalizeScope(){
    if(selectedDepartmentId!==ORG_SCOPE&&!departmentById(selectedDepartmentId))selectedDepartmentId=ORG_SCOPE;
    if(departmentScope!==DEPARTMENT_ALL&&!validSelectedTeam())departmentScope=DEPARTMENT_ALL
  }
  function recordDepartmentId(record){return teamById(record?.teamId)?.departmentId||''}
  demandInScope=function(d){
    normalizeScope();const team=teamById(d?.teamId);if(!team)return false;
    if(selectedDepartmentId!==ORG_SCOPE&&team.departmentId!==selectedDepartmentId)return false;
    return departmentScope===DEPARTMENT_ALL||team.id===departmentScope
  };
  personInScope=function(p){
    normalizeScope();const team=teamById(p?.teamId);if(!team)return false;
    if(selectedDepartmentId!==ORG_SCOPE&&team.departmentId!==selectedDepartmentId)return false;
    return departmentScope===DEPARTMENT_ALL||team.id===departmentScope
  };
  scopedDemand=function(){return Array.isArray(db?.demand)?db.demand.filter(demandInScope):[]};
  scopedPeople=function(){return Array.isArray(db?.team)?db.team.filter(personInScope):[]};
  scopedAllocations=function(){const ids=new Set(scopedDemand().map(d=>d.id));return(Array.isArray(db?.allocations)?db.allocations:[]).filter(a=>ids.has(a.demandId))};
  scopeLabel=function(){
    normalizeScope();const dep=selectedDepartmentId===ORG_SCOPE?'Whole Org':(departmentById(selectedDepartmentId)?.name||'Whole Org');
    const team=departmentScope===DEPARTMENT_ALL?(selectedDepartmentId===ORG_SCOPE?'All Teams':'Whole Department'):(teamById(departmentScope)?.name||'Whole Department');
    return departmentScope===DEPARTMENT_ALL?dep:`${dep} · ${team}`
  };

  function hierarchyStyles(){
    if(document.getElementById('amo-organization-hierarchy-styles'))return;
    const style=document.createElement('style');style.id='amo-organization-hierarchy-styles';style.textContent=`
      #scopeSelector.amo-hierarchy-scope{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #scopeSelector.amo-hierarchy-scope .amo-scope-field{display:flex;align-items:center;gap:5px}
      #scopeSelector.amo-hierarchy-scope select{max-width:210px}
      .amo-structure-row{display:grid;grid-template-columns:150px minmax(180px,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
      .amo-team-structure-row{grid-template-columns:150px minmax(160px,.8fr) minmax(180px,1fr) auto}
      .amo-structure-row:last-child{border-bottom:0}.amo-structure-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      @media(max-width:760px){#scopeSelector.amo-hierarchy-scope{width:100%;order:4}#scopeSelector.amo-hierarchy-scope .amo-scope-field{flex:1 1 160px}#scopeSelector.amo-hierarchy-scope select{width:100%;max-width:none}.amo-structure-row,.amo-team-structure-row{grid-template-columns:1fr}}
    `;document.head.appendChild(style)
  }

  function refreshScopedViews(){
    try{refreshAll?.()}catch(e){console.error('AMO scope refresh failed.',e)}
    try{renderStatusReporting?.()}catch(_e){}
    try{renderStatusHistory?.()}catch(_e){}
    renderScopeSelector();
  }
  renderScopeSelector=function(){
    hierarchyStyles();normalizeScope();
    let host=document.getElementById('scopeSelector');
    if(!host){host=document.createElement('div');host.id='scopeSelector';document.querySelector('.top-actions')?.prepend(host)}
    host.className='scope-selector amo-hierarchy-scope';host.title='Department limits the organisational boundary. Team then limits the selected Department to one Home/Owning Team.';
    const deps=configuredDepartments(),teams=teamsForDepartment(selectedDepartmentId);
    host.innerHTML=`<label class="amo-scope-field"><span>Department</span><select id="departmentScopeSelect"><option value="${ORG_SCOPE}">Whole Org</option>${deps.map(d=>`<option value="${esc(d.id)}" ${selectedDepartmentId===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><label class="amo-scope-field"><span>Team</span><select id="teamScopeSelect" ${selectedDepartmentId===ORG_SCOPE?'disabled':''}><option value="${DEPARTMENT_ALL}">${selectedDepartmentId===ORG_SCOPE?'All Teams':'Whole Department'}</option>${teams.map(t=>`<option value="${esc(t.id)}" ${departmentScope===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`;
    host.querySelector('#departmentScopeSelect')?.addEventListener('change',e=>{selectedDepartmentId=e.target.value||ORG_SCOPE;departmentScope=DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews();log?.(`Department view changed to ${scopeLabel()}.`)});
    host.querySelector('#teamScopeSelect')?.addEventListener('change',e=>{departmentScope=e.target.value||DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews();log?.(`Team view changed to ${scopeLabel()}.`)})
  };

  function linkedPersonForCurrentUser(){
    const principal=window.amoAccess?.currentPrincipal?.();if(!principal?.mapped||!principal.user?.id)return null;
    return(Array.isArray(db?.team)?db.team:[]).find(p=>clean(p?.userId)===clean(principal.user.id))||null
  }
  function applyUserDefaultScope(){
    if(scopeInitialised)return;
    const principal=window.amoAccess?.currentPrincipal?.();
    if(!principal?.authenticated){selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL;renderScopeSelector();return}
    const person=linkedPersonForCurrentUser(),team=person?teamById(person.teamId):null;
    if(team){selectedDepartmentId=team.departmentId;departmentScope=team.id}else{selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL}
    scopeInitialised=true;refreshScopedViews()
  }

  function migrateHierarchy(){
    if(!window.workspaceRepository||!db?.settings)return false;
    let changed=false;const departments=normalizeDepartments(db.settings.departments);
    if(!Array.isArray(db.settings.departments)||JSON.stringify(db.settings.departments)!==JSON.stringify(departments)){db.settings.departments=departments;changed=true}
    const teams=normalizeTeams(db.settings.teams),fallback=departments[0]?.id||'DEPT-ARCH';
    for(const t of teams)if(!departmentById(t.departmentId)){t.departmentId=fallback;changed=true}
    if(JSON.stringify(db.settings.teams||[])!==JSON.stringify(teams)){db.settings.teams=teams;changed=true}
    const fallbackTeam=teams[0]?.id||'';
    for(const p of db.team||[]){if(!teamById(p.teamId)&&fallbackTeam){p.teamId=fallbackTeam;markDirty?.('team',p.id,`Assigned ${p.id} to Home Team ${fallbackTeam}.`);changed=true}}
    for(const d of db.demand||[]){if(!d.teamId&&typeof demandIsTriage==='function'&&demandIsTriage(d))continue;if(!teamById(d.teamId)&&fallbackTeam){d.teamId=fallbackTeam;markDirty?.('demand',d.id,`Assigned ${d.id} to Owning Team ${fallbackTeam}.`);changed=true}}
    if(changed){db.configFiles=db.configFiles||{};db.configFiles['settings.json']=cloneValue(db.settings);configDirty=true;requestAutosave?.()}
    return changed
  }
  ensureDepartmentModel=function(){return migrateHierarchy()};

  function defaultTeamForScope(){
    const selected=validSelectedTeam();if(selected)return selected.id;
    const current=linkedPersonForCurrentUser(),home=current?teamById(current.teamId):null;
    if(home&&(selectedDepartmentId===ORG_SCOPE||home.departmentId===selectedDepartmentId))return home.id;
    return teamsForDepartment(selectedDepartmentId)[0]?.id||configuredTeams()[0]?.id||''
  }
  if(typeof defaultDemandRecord==='function'){
    const base=defaultDemandRecord;defaultDemandRecord=function(){const row=base();row.teamId=defaultTeamForScope();return row}
  }
  if(typeof defaultTeamRecord==='function'){
    const base=defaultTeamRecord;defaultTeamRecord=function(){const row=base();row.teamId=defaultTeamForScope();return row}
  }

  function addDerivedDepartmentColumn(columns,teamKey){
    if(!Array.isArray(columns)||columns.some(c=>c.key==='departmentId'))return;
    const index=Math.max(0,columns.findIndex(c=>c.key===teamKey));columns.splice(index<0?1:index,0,{key:'departmentId',label:'Department',editable:false})
  }
  addDerivedDepartmentColumn(typeof demandCols!=='undefined'?demandCols:null,'teamId');
  addDerivedDepartmentColumn(typeof teamCols!=='undefined'?teamCols:null,'teamId');
  if(typeof displayVal==='function'){
    const base=displayVal;displayVal=function(row,col){
      if(col?.key==='departmentId'){const dep=departmentForTeam(row?.teamId);return dep?.name||'Unassigned'}
      return base(row,col)
    }
  }
  const demandTeamCol=typeof demandCols!=='undefined'?demandCols.find(c=>c.key==='teamId'):null;if(demandTeamCol)demandTeamCol.values=()=>allTeamOptions({unassigned:true});
  const peopleTeamCol=typeof teamCols!=='undefined'?teamCols.find(c=>c.key==='teamId'):null;if(peopleTeamCol)peopleTeamCol.values=()=>allTeamOptions();

  if(typeof renderAllocations==='function'){
    const base=renderAllocations;renderAllocations=function(){
      const allDemand=db.demand,allAlloc=db.allocations,demand=scopedDemand(),ids=new Set(demand.map(d=>d.id));
      db.demand=demand;db.allocations=allAlloc.filter(a=>ids.has(a.demandId));
      try{return base.apply(this,arguments)}finally{db.demand=allDemand;db.allocations=allAlloc}
    }
  }

  function validateStructure(departments,teams){
    if(!departments.length)throw new Error('At least one Department is required.');
    if(new Set(departments.map(d=>lower(d.id))).size!==departments.length)throw new Error('Department IDs must be unique.');
    if(new Set(departments.map(d=>lower(d.name))).size!==departments.length)throw new Error('Department names must be unique.');
    if(!teams.length)throw new Error('At least one Team is required.');
    if(new Set(teams.map(t=>lower(t.id))).size!==teams.length)throw new Error('Team IDs must be unique.');
    if(new Set(teams.map(t=>lower(t.name))).size!==teams.length)throw new Error('Team names must be unique.');
    for(const t of teams)if(!departments.some(d=>d.id===t.departmentId))throw new Error(`Team ${t.name||t.id} must belong to a valid Department.`);
    for(const p of db.team||[])if(!teams.some(t=>t.id===p.teamId))throw new Error(`Cannot remove Team ${p.teamId}; Person ${p.name||p.id} still belongs to it.`);
    for(const d of db.demand||[])if(d.teamId&&!teams.some(t=>t.id===d.teamId))throw new Error(`Cannot remove Team ${d.teamId}; Demand ${d.id} still references it.`)
  }
  async function saveStructure(){
    window.amoAccess?.require?.('system.configure');
    const departments=normalizeDepartments(structureDraft?.departments),teams=normalizeTeams(structureDraft?.teams);validateStructure(departments,teams);
    const repo=window.workspaceRepository;if(!repo)throw new Error('Open a workspace first.');
    const latest=await repo.getSettings();latest.departments=departments;latest.teams=teams;await repo.saveSettings(latest);
    db.settings={...db.settings,...cloneValue(latest)};db.configFiles=db.configFiles||{};db.configFiles['settings.json']=cloneValue(latest);
    structureEditing=false;structureDraft=null;normalizeScope();renderConfig?.();refreshScopedViews();log?.('Organization structure updated.')
  }
  function beginStructureEdit(){window.amoAccess?.require?.('system.configure');structureEditing=true;structureDraft={departments:cloneValue(configuredDepartments()),teams:cloneValue(configuredTeams())};decorateConfig()}
  function structureCard(){
    const deps=structureEditing?structureDraft.departments:configuredDepartments(),teams=structureEditing?structureDraft.teams:configuredTeams();
    const canEdit=window.amoAccess?.can?.('system.configure')===true;
    return `<div class="card settings-card-wide" id="amoOrganizationStructureCard"><div class="section-title" style="margin-top:0"><div><h2>Organization Structure</h2><p class="muted config-description">Departments are organisational boundaries within the tenant. Every Team belongs to one Department; People and Demand inherit Department through their Home/Owning Team.</p></div>${!structureEditing&&canEdit?'<button class="btn primary" id="amoEditStructure">Edit Structure</button>':''}</div><h3>Departments</h3><div>${deps.map((d,i)=>`<div class="amo-structure-row">${structureEditing?`<input class="cell-input" data-department-id="${i}" value="${esc(d.id)}" ${configuredDepartments().some(x=>x.id===d.id)?'disabled':''}><input class="cell-input" data-department-name="${i}" value="${esc(d.name)}"><button class="btn danger" data-department-delete="${i}">Delete</button>`:`<strong>${esc(d.id)}</strong><span>${esc(d.name)}</span><span></span>`}</div>`).join('')}</div>${structureEditing?'<button class="btn settings-add" id="amoAddDepartment">+ Add Department</button>':''}<h3 style="margin-top:18px">Teams</h3><div>${teams.map((t,i)=>`<div class="amo-structure-row amo-team-structure-row">${structureEditing?`<input class="cell-input" data-structure-team-id="${i}" value="${esc(t.id)}" ${configuredTeams().some(x=>x.id===t.id)?'disabled':''}><select class="cell-input" data-structure-team-department="${i}">${deps.map(d=>`<option value="${esc(d.id)}" ${d.id===t.departmentId?'selected':''}>${esc(d.name)}</option>`).join('')}</select><input class="cell-input" data-structure-team-name="${i}" value="${esc(t.name)}"><button class="btn danger" data-structure-team-delete="${i}">Delete</button>`:`<strong>${esc(t.id)}</strong><span>${esc(departmentById(t.departmentId)?.name||t.departmentId)}</span><span>${esc(t.name)}</span><span></span>`}</div>`).join('')}</div>${structureEditing?'<div class="amo-structure-actions"><button class="btn" id="amoAddTeam">+ Add Team</button><button class="btn success" id="amoSaveStructure">Save Structure</button><button class="btn" id="amoCancelStructure">Discard changes</button></div>':''}</div>`
  }
  function bindStructureCard(card){
    if(!card)return;
    card.querySelector('#amoEditStructure')?.addEventListener('click',()=>{try{beginStructureEdit()}catch(e){alert(e.message)}});
    if(!structureEditing)return;
    card.querySelectorAll('[data-department-name]').forEach(el=>el.oninput=e=>{structureDraft.departments[Number(e.target.dataset.departmentName)].name=e.target.value});
    card.querySelectorAll('[data-department-id]').forEach(el=>el.oninput=e=>{structureDraft.departments[Number(e.target.dataset.departmentId)].id=e.target.value});
    card.querySelectorAll('[data-department-delete]').forEach(el=>el.onclick=e=>{const i=Number(e.currentTarget.dataset.departmentDelete),id=structureDraft.departments[i]?.id;if(structureDraft.teams.some(t=>t.departmentId===id)){alert('Move or remove Teams from this Department first.');return}structureDraft.departments.splice(i,1);decorateConfig(true)});
    card.querySelectorAll('[data-structure-team-name]').forEach(el=>el.oninput=e=>{structureDraft.teams[Number(e.target.dataset.structureTeamName)].name=e.target.value});
    card.querySelectorAll('[data-structure-team-id]').forEach(el=>el.oninput=e=>{structureDraft.teams[Number(e.target.dataset.structureTeamId)].id=e.target.value});
    card.querySelectorAll('[data-structure-team-department]').forEach(el=>el.onchange=e=>{structureDraft.teams[Number(e.target.dataset.structureTeamDepartment)].departmentId=e.target.value});
    card.querySelectorAll('[data-structure-team-delete]').forEach(el=>el.onclick=e=>{const i=Number(e.currentTarget.dataset.structureTeamDelete),id=structureDraft.teams[i]?.id;if((db.team||[]).some(p=>p.teamId===id)||(db.demand||[]).some(d=>d.teamId===id)){alert('This Team is still referenced by People or Demand.');return}structureDraft.teams.splice(i,1);decorateConfig(true)});
    card.querySelector('#amoAddDepartment')?.addEventListener('click',()=>{const n=structureDraft.departments.length+1;structureDraft.departments.push({id:`DEPT-${String(n).padStart(2,'0')}`,name:'New Department'});decorateConfig(true)});
    card.querySelector('#amoAddTeam')?.addEventListener('click',()=>{const n=structureDraft.teams.length+1;structureDraft.teams.push({id:`TEAM-${String(n).padStart(2,'0')}`,name:'New Team',departmentId:structureDraft.departments[0]?.id||''});decorateConfig(true)});
    card.querySelector('#amoCancelStructure')?.addEventListener('click',()=>{structureEditing=false;structureDraft=null;decorateConfig(true)});
    card.querySelector('#amoSaveStructure')?.addEventListener('click',async e=>{const button=e.currentTarget;try{button.disabled=true;await saveStructure()}catch(err){alert(`Could not save Organization Structure: ${err.message}`)}finally{button.disabled=false}})
  }

  function tenantSystemCard(){
    const api=window.amoTenantDomain;if(!api)return'';const domain=api.tenantDomain?.()||'',canEdit=window.amoAccess?.can?.('system.configure')===true;
    return `<div class="card" id="amoTenantDomainSystemCard"><div class="section-title" style="margin-top:0"><div><h2>Tenant Domain</h2><p class="muted config-description">System-wide canonical Company / Entra domain for this AMO tenant.</p></div></div><div class="settings-field"><label>Domain</label>${canEdit?`<div class="flex" style="gap:8px;align-items:center"><input class="cell-input" id="amoTenantDomainSystemInput" value="${esc(domain)}" placeholder="company.com"><button class="btn success" id="amoTenantDomainSystemSave">Save</button></div>`:`<strong>${domain?esc(domain):'Not configured'}</strong>`}</div></div>`
  }
  function decorateConfig(force=false){
    if(configDecorating)return;const content=document.getElementById('configContent');if(!content)return;
    const active=content.querySelector('.settings-tab.active')?.dataset.settingsTab;if(!active)return;
    configDecorating=true;
    try{
      if(active==='organization'){
        const cards=[...content.querySelectorAll('.settings-grid > .card')];
        for(const card of cards){const title=clean(card.querySelector('h2')?.textContent);if(title==='Department'||title==='Teams')card.style.display='none'}
        const legacyTenant=document.getElementById('amoTenantDomainCard');if(legacyTenant)legacyTenant.style.display='none';
        let card=document.getElementById('amoOrganizationStructureCard');if(force&&card){card.remove();card=null}if(!card){const grid=content.querySelector('.settings-grid');grid?.insertAdjacentHTML('afterbegin',structureCard());card=document.getElementById('amoOrganizationStructureCard');bindStructureCard(card)}
      }else if(active==='system'){
        const grid=content.querySelector('.settings-grid');if(grid&&!document.getElementById('amoTenantDomainSystemCard')){grid.insertAdjacentHTML('afterbegin',tenantSystemCard());const save=document.getElementById('amoTenantDomainSystemSave');save?.addEventListener('click',async()=>{try{save.disabled=true;await window.amoTenantDomain.saveTenantDomain(document.getElementById('amoTenantDomainSystemInput')?.value||'')}catch(e){alert(`Could not save Tenant Domain: ${e.message}`)}finally{save.disabled=false}})}
      }
    }finally{configDecorating=false}
  }
  function bindConfigDecoration(){
    const content=document.getElementById('configContent');if(!content)return false;
    const observer=new MutationObserver(()=>{if(!configDecorating)queueMicrotask(()=>decorateConfig())});observer.observe(content,{childList:true,subtree:true});decorateConfig();return true
  }

  function initialize(){
    hierarchyStyles();migrateHierarchy();normalizeScope();renderScopeSelector();decorateConfig();applyUserDefaultScope();
    try{renderGrid?.('team');renderGrid?.('demand')}catch(_e){}
  }
  if(!bindConfigDecoration()){let attempts=0;const timer=setInterval(()=>{if(bindConfigDecoration()||++attempts>50)clearInterval(timer)},100)}
  window.addEventListener('amo-workspace-connected',()=>{scopeInitialised=false;selectedDepartmentId=ORG_SCOPE;departmentScope=DEPARTMENT_ALL;setTimeout(initialize,0)});
  window.addEventListener('amo-access-changed',()=>{if(!scopeInitialised)setTimeout(applyUserDefaultScope,0)});
  setTimeout(initialize,0);

  window.amoOrganizationHierarchy={configuredDepartments,departmentById,departmentForTeam,teamsForDepartment,selectedDepartment:()=>selectedDepartmentId,selectedTeam:()=>departmentScope,setScope:(departmentId,teamId=DEPARTMENT_ALL)=>{selectedDepartmentId=departmentId||ORG_SCOPE;departmentScope=teamId||DEPARTMENT_ALL;scopeInitialised=true;refreshScopedViews()}}
})();
