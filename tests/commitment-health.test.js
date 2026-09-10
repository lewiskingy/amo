const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-commitment-health.js','utf8');
const demand=[
  {id:'DEM-1',title:'Funded gap',status:'In Progress',projectNumber:''},
  {id:'DEM-2',title:'Resource gap',status:'Planned',projectNumber:'2002'},
  {id:'DEM-3',title:'Early demand',status:'Defined',projectNumber:''}
];
const allocations=[
  {id:'A-1',demandId:'DEM-1',workPackageId:'WP-1',teamMemberId:'P-1',forecast:{'2026-08-01':.5}},
  {id:'A-2',demandId:'DEM-1',workPackageId:'WP-1',teamMemberId:'P-2',forecast:{'2026-09-01':.5}}
];
const workPackages=[
  {id:'WP-1',demandId:'DEM-1',title:'Active package',status:'Ready',targetStart:'2026-08-01',azureDevOpsWorkItemId:''},
  {id:'WP-2',demandId:'DEM-2',title:'Future package',status:'Planned',targetStart:'2999-01-01',azureDevOpsWorkItemId:''}
];
const rm={
  SIGNAL_THRESHOLDS:{zeroFte:.01,materialVariancePct:.20},monthStart:m=>`${String(m).slice(0,7)}-01`,ensureLoaded:()=>true,latestActualMonth:()=> '2026-08',actualsAvailable:m=>String(m).startsWith('2026-08'),
  actualHours:(person,demandId,month)=>person==='P-1'&&demandId==='DEM-1'&&String(month).startsWith('2026-08')?0:10,
  forecastFte:(person,demandId)=>demandId==='DEM-1'?.5:.5,actualFte:(person,demandId)=>demandId==='DEM-1'?0:.2,
  personDemandRows:person=>person==='P-1'?[{demandId:'DEM-3',plannedFte:0,actualFte:.2}]:[]
};
const context={console,Date,Set,Map,Object,Number,String,Math,structuredClone,
  db:{demand,allocations,team:[{id:'P-1',name:'One',active:true},{id:'P-2',name:'Two',active:true}]},workspaceHandle:false,
  demandCols:[],displayVal:()=>'',gridRows:()=>demand,renderGrid:()=>{},renderDashboard:()=>{},renderAllocations:()=>{},renderActualsAdmin:async()=>{},dashboardHeadlineSnapshot:()=>({}),
  unresolvedWithoutAllocation:()=>[demand[1]],switchView:()=>{},monthLabel:x=>x,escHtml:x=>String(x),
  document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild:()=>{}},querySelectorAll:()=>[]},
  window:{addEventListener:()=>{},ReportingModel:rm,DefinedDemandModel:{canonicalState:d=>d,isOpen:d=>!['Complete','Cancelled'].includes(d.status)},WorkPackages:{state:{rows:workPackages},openEditor:()=>{},workItemUrl:()=>''},WorkPackageResourcePlanning:{}},
  setInterval:()=>0,clearInterval:()=>{}
};
context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context);
const ch=context.window.CommitmentHealth;
assert.ok(ch,'CommitmentHealth API must be registered');
assert.equal(ch.committedDemand(demand[0]),true);
assert.equal(ch.committedDemand(demand[2]),false);
assert.equal(ch.allocationHasCommitment(allocations[0]),true);
assert.equal(ch.allocationHasCommitment({teamMemberId:'P-1',forecast:{'2026-08-01':0}}),false);
assert.equal(ch.workPackageRequiresWorkItem(workPackages[0]),true,'Ready Work Package requires a delivery Work Item');
assert.equal(ch.workPackageRequiresWorkItem(workPackages[1]),false,'Future Planned Work Package must not be a false-positive');
const snapshot=ch.snapshot();
assert.equal(snapshot.committed.length,2);
assert.deepEqual(snapshot.committedWithoutProject.map(x=>x.demand.id),['DEM-1']);
assert.deepEqual(snapshot.committedWithoutAllocation.map(x=>x.demand.id),['DEM-2']);
assert.deepEqual(snapshot.missingWorkItems.map(x=>x.workPackageId),['WP-1']);
assert.deepEqual(snapshot.missingActuals.map(x=>x.allocationId),['A-1'],'Only allocation in an imported/due Actuals period is missing');
assert.deepEqual(snapshot.unmetDemand.map(x=>x.id),['DEM-2'],'Existing unmet-demand calculation remains authoritative');
assert.equal(snapshot.unexpectedActuals.length,1);
assert.equal(snapshot.unexpectedActuals[0].demandId,'DEM-3');
assert.match(ch.summaryText(demand[0]),/Funding missing/);
assert.match(ch.summaryText(demand[0]),/Work Item missing/);
assert.match(ch.summaryText(demand[0]),/Actuals missing/);
assert.equal(ch.demandFilters.scope,'active');
ch.demandFilters.project='missing';assert.equal(ch.matchesDemandQuery(demand[0]),true);assert.equal(ch.matchesDemandQuery(demand[1]),false);ch.demandFilters.project='';
ch.demandFilters.control='funding-missing';assert.equal(ch.matchesDemandQuery(demand[0]),true);assert.equal(ch.matchesDemandQuery(demand[1]),false);ch.demandFilters.control='';

// Keep the feature compositionally loaded once; do not create a second persisted control model.
const loader=fs.readFileSync('src/app-4.js','utf8');
assert.match(loader,/app-commitment-health\.js/);
assert.doesNotMatch(code,/saveRecord|saveSettings|requestAutosave|dirtyRecords/);
console.log('Commitment health tests passed.');
