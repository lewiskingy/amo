const fs=require('node:fs');
const assert=require('node:assert/strict');

async function importSource(path){
  const source=fs.readFileSync(path,'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

(async()=>{
  const {DemandFilterState}=await importSource('src/client/domain/demand/demand-filter-state.js');
  const {DemandQueryService}=await importSource('src/client/domain/demand/demand-query-service.js');

  const demands=[
    {id:'DEM-1',title:'Funded delivery',businessArea:'Customer',initiative:'Modernise',ownerId:'P-1',projectNumber:'12345',status:'In Progress',owningTeamId:'TEAM-A'},
    {id:'DEM-2',title:'Needs funding',businessArea:'Customer',initiative:'Modernise',ownerId:'P-1',projectNumber:'',status:'Planned',owningTeamId:'TEAM-A'},
    {id:'DEM-3',title:'Needs people',businessArea:'Operations',initiative:'',ownerId:'P-2',projectNumber:'777',status:'Planned',owningTeamId:'TEAM-B'},
    {id:'DEM-4',title:'Finished',businessArea:'Operations',initiative:'',ownerId:'P-2',projectNumber:'888',status:'Complete',owningTeamId:'TEAM-B'}
  ];
  const workPackages=[
    {id:'WP-1',demandId:'DEM-1',title:'Tracked',status:'In Progress',azureDevOpsWorkItemId:'9001'},
    {id:'WP-2',demandId:'DEM-2',title:'Missing tracking',status:'Ready',azureDevOpsWorkItemId:''}
  ];
  const allocations=[
    {id:'A-1',demandId:'DEM-1',teamMemberId:'P-1',forecast:{'2026-09':0.5}},
    {id:'A-2',demandId:'DEM-2',teamMemberId:'P-1',forecast:{'2026-09':0.3}}
  ];
  const people=[{id:'P-1',name:'Alex Architect'},{id:'P-2',name:'Sam Strategist'}];
  const query=new DemandQueryService({demands,workPackages,allocations,people,today:()=> '2026-09-11'});
  const state=new DemandFilterState();

  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-1','DEM-2','DEM-3'],'Active is the canonical default and excludes terminal Demand.');
  state.set('businessArea','Customer');
  state.set('ownerId','P-1');
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-1','DEM-2'],'Management filters compose as an intersection.');
  state.set('projectNumber','present');
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-1'],'Project Number presence is evaluated by the canonical query.');
  state.set('control','funding-missing');
  assert.deepEqual(query.query(state.value).map(d=>d.id),[],'Has Project Number and Funding missing are contradictory and must return no Demand.');
  state.replace({control:'funding-missing'});
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-2'],'Funding missing is derived from committed + resourced + no Project Number.');
  state.replace({control:'resource-missing'});
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-3'],'Resource missing is derived rather than persisted.');
  state.replace({control:'work-item-missing'});
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-2'],'Work Item missing uses Work Package execution semantics.');
  state.replace({search:'Alex'});
  assert.deepEqual(query.query(state.value).map(d=>d.id),['DEM-1','DEM-2'],'Search includes resolved owner names.');
  state.reset();
  assert.deepEqual(query.query(state.value,{mode:'team',teamId:'TEAM-A'}).map(d=>d.id),['DEM-1','DEM-2'],'Team scope composes with management filters.');
  assert.deepEqual(query.query(state.value,{mode:'department',teamIds:['TEAM-B']}).map(d=>d.id),['DEM-3'],'Department scope composes with management filters.');

  const architecture=fs.readFileSync('src/client/README.md','utf8');
  assert.match(architecture,/\*\*Canonical\*\*/);
  assert.match(architecture,/\*\*Transitional adapter\*\*/);
  assert.match(architecture,/\*\*Legacy\*\*/);
  assert.match(architecture,/remove the superseded path/i);
  const adapter=fs.readFileSync('src/client/legacy/legacy-workspace-adapter.js','utf8');
  assert.match(adapter,/Transitional anti-corruption adapter/);
  const demandShell=fs.readFileSync('src/demand/index.html','utf8');
  assert.match(demandShell,/Dark launch/);
  assert.match(demandShell,/src\/client\/README\.md/);

  console.log('Target client Demand tests passed.');
})().catch(error=>{console.error(error);process.exit(1)});
