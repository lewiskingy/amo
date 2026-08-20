/* Clarify Team scope semantics without changing the underlying Department model. */
function demandIsTriage(d){return String(d?.service||'').trim().toLowerCase()==='triage'}
function demandTeamRequired(d){return !demandIsTriage(d)}
function demandHasValidOwningTeam(d){return !d?.teamId?demandIsTriage(d):!!teamById(d.teamId)}
function owningTeamOptions(){return[{value:'',label:'Unassigned'},...configuredTeams().map(t=>({value:t.id,label:t.name}))]}

/* Keep migration compatible with unassigned Triage demand. */
ensureDepartmentModel=function(){
  let changed=false;
  db.workspace.department=db.workspace.department||clone(DEFAULT_DEPARTMENT);
  let teams=normalizeTeams(db.settings.teams);
  if(!teams.length){teams=clone(DEFAULT_TEAMS);db.settings.teams=teams;changed=true}
  const fallback=teams[0]?.id||'TEAM-EA';
  for(const p of db.team){
    if(!teams.some(t=>t.id===p.teamId)){
      p.teamId=fallback;
      markDirty('team',p.id,`Assigned ${p.id} to home team ${fallback}.`);
      changed=true
    }
  }
  for(const d of db.demand){
    if(!d.teamId&&demandIsTriage(d))continue;
    if(!teams.some(t=>t.id===d.teamId)){
      d.teamId=fallback;
      markDirty('demand',d.id,`Assigned ${d.id} to owning team ${fallback}.`);
      changed=true
    }
  }
  if(changed){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}
  return changed
};

/* Make the page-level selector explicit about what it means. */
const clarityRenderScopeSelector=renderScopeSelector;
renderScopeSelector=function(){
  clarityRenderScopeSelector();
  const host=document.getElementById('scopeSelector');
  if(!host)return;
  const label=host.querySelector('span');if(label)label.textContent='Team View';
  host.title='Demand is filtered by Owning Team. People are filtered by Home Team. Allocations and delivery views follow the Demand Owning Team.'
};

/* Explicit field language in list views. */
const demandTeamCol=demandCols.find(c=>c.key==='teamId');
if(demandTeamCol){demandTeamCol.label='Owning Team';demandTeamCol.values=owningTeamOptions}
const peopleTeamCol=teamCols.find(c=>c.key==='teamId');
if(peopleTeamCol){peopleTeamCol.label='Home Team *';peopleTeamCol.values=()=>configuredTeams().map(t=>({value:t.id,label:t.name}))}

/* Demand modal: Triage may remain unassigned; all accepted service engagements require ownership. */
const clarityRenderDemandModal=renderDemandModal;
renderDemandModal=function(r){
  let html=clarityRenderDemandModal(r);
  const label=demandIsTriage(r)?'Owning Team (optional during Triage)':'Owning Team *';
  html=html.replace(/<label>Owning Team \*<\/label><select data-modal-field="teamId"([^>]*)>/,
    `<label>${label}</label><select data-modal-field="teamId"$1><option value="" ${r.teamId?'':'selected'}>Unassigned</option>`);
  return html
};
const clarityRenderTeamModal=renderTeamModal;
renderTeamModal=function(r){return clarityRenderTeamModal(r).replace('<label>Team *</label>','<label>Home Team *</label>')};

/* Refresh the requirement hint immediately if Service changes in the single-record modal. */
const clarityRenderRecordModal=renderRecordModal;
renderRecordModal=function(){
  clarityRenderRecordModal();
  if(recordModalState.type!=='demand'||recordModalState.mode!=='edit')return;
  const service=document.querySelector('#recordModalBody [data-modal-field="service"]');
  service?.addEventListener('change',()=>{
    recordModalState.draft=readModalDraft();
    renderRecordModal()
  },{once:true})
};

/* Bypass the older blanket "team required" wrapper and apply the service-aware rule. */
saveDemandModal=function(next){
  if(demandTeamRequired(next)&&!teamById(next.teamId)){
    alert('Owning Team is required once Demand moves beyond Triage.');return
  }
  if(next.teamId&&!teamById(next.teamId)){
    alert('Owning Team must reference a configured Team.');return
  }
  return deptSaveDemandModal(next)
};
const claritySaveTeamModal=saveTeamModal;
saveTeamModal=function(next){
  if(!teamById(next.teamId)){alert('Home Team is required.');return}
  return claritySaveTeamModal(next)
};

/* Apply the same service-aware rule to bulk list editing. */
saveGrid=function(name){
  if(name==='demand'&&gridState.demand.editing){
    const bad=gridState.demand.draft.find(r=>!gridState.demand.deleted.has(r.id)&&!demandHasValidOwningTeam(r));
    if(bad){alert(`Demand ${bad.id} requires a valid Owning Team once it moves beyond Triage.`);return}
  }
  if(name==='team'&&gridState.team.editing){
    const bad=gridState.team.draft.find(r=>!gridState.team.deleted.has(r.id)&&!teamById(r.teamId));
    if(bad){alert(`User ${bad.id} must reference a valid Home Team.`);return}
  }
  return deptSaveGrid(name)
};

/* Rename the People view so Teams remain the organisational grouping and people are the records. */
function applyPeopleTerminology(){
  const nav=document.querySelector('.nav-btn[data-view="team"]');
  if(nav){const dot=nav.querySelector('.nav-dot');nav.innerHTML='';if(dot)nav.appendChild(dot);nav.append('People')}
  const hero=document.querySelector('#team .hero h1');if(hero)hero.textContent='People';
  const desc=document.querySelector('#team .hero p');if(desc)desc.textContent='Manage people, their Home Team and available capacity. Double-click any row to open its record.'
}
const claritySwitchView=switchView;
switchView=function(id){
  claritySwitchView(id);
  if(id==='team'){
    const host=document.getElementById('pageTitle');
    const text=host?.querySelector('.page-title-text');
    if(text)text.textContent='People';else if(host)host.textContent='People'
  }
  applyPeopleTerminology()
};
const clarityRefreshAll=refreshAll;
refreshAll=function(){clarityRefreshAll();renderScopeSelector();applyPeopleTerminology()};

applyPeopleTerminology();
renderScopeSelector();
