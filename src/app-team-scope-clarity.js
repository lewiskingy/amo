/* Clarify Team scope semantics for Defined Demand and People. */
function demandTeamRequired(_d){return false}
function demandHasValidOwningTeam(d){return !d?.teamId||!!teamById(d.teamId)}
function owningTeamOptions(){return[{value:'',label:'Unassigned'},...configuredTeams().map(t=>({value:t.id,label:t.name}))]}

/* Defined Demand can exist before an Owning Team is known. People still require a Home Team. */
ensureDepartmentModel=function(){
  let changed=false;db.workspace.department=db.workspace.department||clone(DEFAULT_DEPARTMENT);let teams=normalizeTeams(db.settings.teams);
  if(!teams.length){teams=clone(DEFAULT_TEAMS);db.settings.teams=teams;changed=true}const fallback=teams[0]?.id||'TEAM-EA';
  for(const p of db.team){if(!teams.some(t=>t.id===p.teamId)){p.teamId=fallback;markDirty('team',p.id,`Assigned ${p.id} to home team ${fallback}.`);changed=true}}
  /* Never manufacture a Demand owner. Empty ownership is a valid early state; an explicit unknown
     Team reference is left visible for correction rather than silently reassigned. */
  if(changed){db.configFiles['settings.json']=clone(db.settings);configDirty=true;requestAutosave()}return changed
};

const clarityRenderScopeSelector=renderScopeSelector;
renderScopeSelector=function(){clarityRenderScopeSelector();const host=document.getElementById('scopeSelector');if(!host)return;const label=host.querySelector('span');if(label)label.textContent='Team View';host.title='Demand is filtered by Owning Team where one is assigned. People are filtered by Home Team. Allocations and delivery views follow the Demand Owning Team.'};
const demandTeamCol=demandCols.find(c=>c.key==='teamId');if(demandTeamCol){demandTeamCol.label='Owning Team';demandTeamCol.values=owningTeamOptions}
const peopleTeamCol=teamCols.find(c=>c.key==='teamId');if(peopleTeamCol){peopleTeamCol.label='Home Team *';peopleTeamCol.values=()=>configuredTeams().map(t=>({value:t.id,label:t.name}))}

const clarityRenderTeamModal=renderTeamModal;renderTeamModal=function(r){return clarityRenderTeamModal(r).replace('<label>Team *</label>','<label>Home Team *</label>')};
const claritySaveTeamModal=saveTeamModal;saveTeamModal=function(next){if(!teamById(next.teamId)){alert('Home Team is required.');return}return claritySaveTeamModal(next)};

/* Demand list persistence is owned here so the older department module cannot reimpose mandatory
   ownership. The implementation deliberately preserves the canonical app-2 validations. */
const clarityLegacyGridSave=saveGrid;
function saveDefinedDemandGrid(){
  const s=gridState.demand,original=db.demand,deleteIds=new Set(s.deleted);
  const invalid=s.draft.filter(d=>!deleteIds.has(d.id)&&(!String(d.title||'').trim()||!String(d.businessArea||'').trim()));if(invalid.length){alert('Business Area and Title are required for every Demand. Missing values: '+invalid.map(d=>d.id).join(', '));return}
  const badTeam=s.draft.find(d=>!deleteIds.has(d.id)&&!demandHasValidOwningTeam(d));if(badTeam){alert(`Demand ${badTeam.id} references an unknown Owning Team. Clear it or select a configured Team.`);return}
  const badInitiative=s.draft.find(d=>!deleteIds.has(d.id)&&d.initiative&&!initiativesForBusinessArea(d.businessArea).some(i=>i.name===d.initiative));if(badInitiative){alert(`Initiative ${badInitiative.initiative} is not valid for Business Area ${badInitiative.businessArea}.`);return}
  if(deleteIds.size){if(!window.WorkPackages||window.WorkPackages.state?.loading||window.WorkPackages.state?.loaded===false){alert('Work Packages are not ready yet. Wait for the workspace to finish loading before deleting Demand.');return}const withChildren=[...deleteIds].map(id=>({id,count:window.WorkPackages.forDemand(id).length})).filter(x=>x.count);if(withChildren.length){alert(`Cannot delete Demand with child Work Packages. Delete the Work Packages first: ${withChildren.map(x=>`${x.id} (${x.count})`).join(', ')}.`);return}}
  const seenProjects=new Map();for(let i=0;i<s.draft.length;i++){let d=s.draft[i];if(deleteIds.has(d.id))continue;d.projectNumber=String(d.projectNumber||'').trim();if(d.projectNumber&&!/^\d+$/.test(d.projectNumber)){alert(`Project Number for ${d.id} must contain digits only.`);return}if(d.projectNumber){if(seenProjects.has(d.projectNumber)){alert(`Project Number ${d.projectNumber} is assigned to both ${seenProjects.get(d.projectNumber)} and ${d.id}.`);return}seenProjects.set(d.projectNumber,d.id)}if(window.DefinedDemandModel)d=window.DefinedDemandModel.cleanForSave(d,db.settings);s.draft[i]=d}
  for(const next of s.draft){if(deleteIds.has(next.id))continue;const old=original.find(x=>x.id===next.id);if(!old){original.push(clone(next));markDirty('demand',next.id,`Created ${next.id}.`);continue}if(JSON.stringify(old)!==JSON.stringify(next)){Object.keys(old).forEach(k=>delete old[k]);Object.assign(old,clone(next));old.version=(Number(old.version)||0)+1;old.modifiedAt=new Date().toISOString();markDirty('demand',next.id,`Updated ${next.id}.`)}}
  if(deleteIds.size){for(const id of deleteIds){deletedDemand.add(id);dirtyRecords.demand.delete(id);const dependent=db.allocations.filter(a=>a.demandId===id);dependent.forEach(a=>{deletedAllocations.add(a.id);dirtyRecords.allocations.delete(a.id)});db.allocations=db.allocations.filter(a=>a.demandId!==id)}db.demand=db.demand.filter(d=>!deleteIds.has(d.id));log(`Deleted ${deleteIds.size} demand record${deleteIds.size===1?'':'s'} and removed dependent allocations where applicable.`)}
  s.editing=false;s.draft=null;s.deleted=new Set();updateBanner();refreshAll();if(typeof requestAutosave==='function')requestAutosave()
}
saveGrid=function(name){if(name==='demand')return saveDefinedDemandGrid();if(name==='team'&&gridState.team.editing){const bad=gridState.team.draft.find(r=>!gridState.team.deleted.has(r.id)&&!teamById(r.teamId));if(bad){alert(`User ${bad.id} must reference a valid Home Team.`);return}}return clarityLegacyGridSave(name)};

function applyPeopleTerminology(){const nav=document.querySelector('.nav-btn[data-view="team"]');if(nav){const dot=nav.querySelector('.nav-dot');nav.innerHTML='';if(dot)nav.appendChild(dot);nav.append('People')}const hero=document.querySelector('#team .hero h1');if(hero)hero.textContent='People';const desc=document.querySelector('#team .hero p');if(desc)desc.textContent='Manage people, their Home Team and available capacity. Double-click any row to open its record.'}
const claritySwitchView=switchView;switchView=function(id){claritySwitchView(id);if(id==='team'){const host=document.getElementById('pageTitle'),text=host?.querySelector('.page-title-text');if(text)text.textContent='People';else if(host)host.textContent='People'}applyPeopleTerminology()};
const clarityRefreshAll=refreshAll;refreshAll=function(){clarityRefreshAll();renderScopeSelector();applyPeopleTerminology()};
applyPeopleTerminology();renderScopeSelector();
