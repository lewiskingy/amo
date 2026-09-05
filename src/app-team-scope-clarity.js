/* Clarify Team scope terminology. Defined Demand persistence is owned by the canonical
   Demand model/editor; this module does not implement a second save path. */
function owningTeamOptions(){return[{value:'',label:'Unassigned'},...configuredTeams().map(t=>({value:t.id,label:t.name}))]}

const clarityRenderScopeSelector=renderScopeSelector;
renderScopeSelector=function(){clarityRenderScopeSelector();const host=document.getElementById('scopeSelector');if(!host)return;const label=host.querySelector('span');if(label)label.textContent='Team View';host.title='Defined Demand is filtered by Owning Team when assigned. People are filtered by Home Team. Allocations and delivery views follow the Demand Owning Team.'};

const demandTeamCol=demandCols.find(c=>c.key==='teamId');if(demandTeamCol){demandTeamCol.label='Owning Team';demandTeamCol.values=owningTeamOptions}
const peopleTeamCol=teamCols.find(c=>c.key==='teamId');if(peopleTeamCol){peopleTeamCol.label='Home Team *';peopleTeamCol.values=()=>configuredTeams().map(t=>({value:t.id,label:t.name}))}

const clarityRenderTeamModal=renderTeamModal;renderTeamModal=function(r){return clarityRenderTeamModal(r).replace('<label>Team *</label>','<label>Home Team *</label>')};
const claritySaveTeamModal=saveTeamModal;saveTeamModal=function(next){if(!teamById(next.teamId)){alert('Home Team is required.');return}return claritySaveTeamModal(next)};

function applyPeopleTerminology(){const nav=document.querySelector('.nav-btn[data-view="team"]');if(nav){const dot=nav.querySelector('.nav-dot');nav.innerHTML='';if(dot)nav.appendChild(dot);nav.append('People')}const hero=document.querySelector('#team .hero h1');if(hero)hero.textContent='People';const desc=document.querySelector('#team .hero p');if(desc)desc.textContent='Manage people, their Home Team and available capacity. Double-click any row to open its record.'}
const claritySwitchView=switchView;switchView=function(id){claritySwitchView(id);if(id==='team'){const host=document.getElementById('pageTitle'),text=host?.querySelector('.page-title-text');if(text)text.textContent='People';else if(host)host.textContent='People'}applyPeopleTerminology()};
const clarityRefreshAll=refreshAll;refreshAll=function(){clarityRefreshAll();renderScopeSelector();applyPeopleTerminology()};
applyPeopleTerminology();renderScopeSelector();
