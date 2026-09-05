/* Clarify Team scope semantics for Defined Demand and People. */
function demandTeamRequired(_d){return false}
function demandHasValidOwningTeam(d){return !d?.teamId||!!teamById(d.teamId)}
function owningTeamOptions(){return[{value:'',label:'Unassigned'},...configuredTeams().map(t=>({value:t.id,label:t.name}))]}

/* Defined Demand can exist before an Owning Team is known. People still require a Home Team. */
ensureDepartmentModel=function(){
  let changed=false;
  db.workspace.department=db.workspace.department||clone(DEFAULT_DEPARTMENT);
  let teams=normalizeTeams(db.settings.teams);
  if(!teams.length){teams=clone(DEFAULT_TEAMS);db.settings.teams=teams;changed=true}
  const fallback=teams[0]?.id||'TEAM-EA';
  for(const p of db.team){if(!teams.some(t=>t.id===p.teamId)){p.teamId=fallback;markDirty('team',p.id,`Assigned ${p.id} to home team ${fallback}.`);changed=true}}
  /* Do not manufacture an Owning Team for Defined Demand. An explicit stale Team reference is
     retained for the user to correct rather than silently changing portfolio ownership. */
  if(changed){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}
  return changed
};

const clarityRenderScopeSelector=renderScopeSelector;
renderScopeSelector=function(){clarityRenderScopeSelector();const host=document.getElementById('scopeSelector');if(!host)return;const label=host.querySelector('span');if(label)label.textContent='Team View';host.title='Demand is filtered by Owning Team where one is assigned. People are filtered by Home Team. Allocations and delivery views follow the Demand Owning Team.'};

const demandTeamCol=demandCols.find(c=>c.key==='teamId');if(demandTeamCol){demandTeamCol.label='Owning Team';demandTeamCol.values=owningTeamOptions}
const peopleTeamCol=teamCols.find(c=>c.key==='teamId');if(peopleTeamCol){peopleTeamCol.label='Home Team *';peopleTeamCol.values=()=>configuredTeams().map(t=>({value:t.id,label:t.name}))}

const clarityRenderTeamModal=renderTeamModal;renderTeamModal=function(r){return clarityRenderTeamModal(r).replace('<label>Team *</label>','<label>Home Team *</label>')};
const claritySaveTeamModal=saveTeamModal;saveTeamModal=function(next){if(!teamById(next.teamId)){alert('Home Team is required.');return}return claritySaveTeamModal(next)};

/* The underlying department module predates early/unassigned Defined Demand. Bypass its blanket
   Demand-team validation for list saves while retaining its People validation and downstream save. */
const clarityBaseGridSave=saveGrid;
saveGrid=function(name){
  if(name==='demand'&&gridState.demand.editing){const bad=gridState.demand.draft.find(r=>!gridState.demand.deleted.has(r.id)&&!demandHasValidOwningTeam(r));if(bad){alert(`Demand ${bad.id} references an unknown Owning Team. Clear it or select a configured Team.`);return}
    /* Temporarily supply a valid Team only to the older validation wrapper; restore the real optional
       value before persistence. This compatibility path can disappear when app-department is modularised. */
    const unassigned=gridState.demand.draft.filter(r=>!gridState.demand.deleted.has(r.id)&&!r.teamId),fallback=configuredTeams()[0]?.id||'';if(unassigned.length&&fallback){unassigned.forEach(r=>r.teamId=fallback);try{return clarityBaseGridSave(name)}finally{unassigned.forEach(r=>r.teamId='')}}
  }
  if(name==='team'&&gridState.team.editing){const bad=gridState.team.draft.find(r=>!gridState.team.deleted.has(r.id)&&!teamById(r.teamId));if(bad){alert(`User ${bad.id} must reference a valid Home Team.`);return}}
  return clarityBaseGridSave(name)
};

function applyPeopleTerminology(){const nav=document.querySelector('.nav-btn[data-view="team"]');if(nav){const dot=nav.querySelector('.nav-dot');nav.innerHTML='';if(dot)nav.appendChild(dot);nav.append('People')}const hero=document.querySelector('#team .hero h1');if(hero)hero.textContent='People';const desc=document.querySelector('#team .hero p');if(desc)desc.textContent='Manage people, their Home Team and available capacity. Double-click any row to open its record.'}
const claritySwitchView=switchView;switchView=function(id){claritySwitchView(id);if(id==='team'){const host=document.getElementById('pageTitle'),text=host?.querySelector('.page-title-text');if(text)text.textContent='People';else if(host)host.textContent='People'}applyPeopleTerminology()};
const clarityRefreshAll=refreshAll;refreshAll=function(){clarityRefreshAll();renderScopeSelector();applyPeopleTerminology()};
applyPeopleTerminology();renderScopeSelector();
