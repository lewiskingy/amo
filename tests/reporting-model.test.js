const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-reporting-model.js','utf8');
const periods={
  '2026-07':{schemaVersion:1,month:'2026-07',facts:[
    {teamMemberId:'USR-1',demandId:'DEM-1',actualHours:82.5,actualCostGbp:8000},
    {teamMemberId:'USR-1',demandId:null,actualHours:16.5,actualCostGbp:1200},
    {teamMemberId:'USR-2',demandId:'DEM-1',actualHours:41.25,actualCostGbp:4000},
    {teamMemberId:'USR-3',demandId:'DEM-1',actualHours:34.5,actualCostGbp:3000},
    {teamMemberId:'USR-3',demandId:'DEM-2',actualHours:103.5,actualCostGbp:9000},
    {teamMemberId:'USR-5',demandId:'DEM-1',actualHours:34.5,actualCostGbp:3000},
    {teamMemberId:'USR-6',demandId:'DEM-1',actualHours:103.5,actualCostGbp:9000},
    {teamMemberId:'USR-7',demandId:'DEM-2',actualHours:34.5,actualCostGbp:3000}
  ]}
};
const repository={
  listActualsPeriods:async()=>Object.keys(periods),
  readActualsPeriod:async month=>periods[month]||null,
  readActualsManifest:async()=>({import:{firstMonth:'2026-07',latestMonth:'2026-07'}}),
  getSettings:async()=>context.db.settings,
  saveSettings:async()=>{}
};
const team=[
  {id:'USR-1',name:'One',fte:1,active:true},
  {id:'USR-2',name:'Two',fte:.5,active:true},
  {id:'USR-3',name:'Redirected',fte:1,active:true},
  {id:'USR-4',name:'None recorded',fte:1,active:true},
  {id:'USR-5',name:'Low overall',fte:1,active:true},
  {id:'USR-6',name:'Over capacity',fte:.5,active:true},
  {id:'USR-7',name:'Unplanned',fte:1,active:true}
];
const demand=[{id:'DEM-1',title:'Demand 1',status:'In Progress'},{id:'DEM-2',title:'Demand 2',status:'In Progress'}];
const allocations=[
  {teamMemberId:'USR-1',demandId:'DEM-1',forecast:{'2026-07-01':.4,'2026-08-01':.6}},
  {teamMemberId:'USR-2',demandId:'DEM-1',forecast:{'2026-07-01':.2,'2026-08-01':.3}},
  {teamMemberId:'USR-3',demandId:'DEM-1',forecast:{'2026-07-01':.6}},
  {teamMemberId:'USR-3',demandId:'DEM-2',forecast:{'2026-07-01':.2}},
  {teamMemberId:'USR-4',demandId:'DEM-1',forecast:{'2026-07-01':.6}},
  {teamMemberId:'USR-5',demandId:'DEM-1',forecast:{'2026-07-01':.8}},
  {teamMemberId:'USR-6',demandId:'DEM-1',forecast:{'2026-07-01':.4}}
];
const context={
  console,structuredClone,queueMicrotask,
  db:{settings:{reporting:{standardHoursPerDay:7.5}},team,demand,allocations,configFiles:{}},
  workspaceHandle:{},
  window:{workspaceRepository:repository,amoAccess:{can:()=>true},addEventListener:()=>{},dispatchEvent:()=>{}},
  document:{getElementById:()=>null},
  MutationObserver:function(){this.observe=()=>{}},CustomEvent:function(){},
  unresolvedWithoutAllocation:()=>[],isOpenDemand:()=>true,planningPeriods:()=>['2026-07-01','2026-08-01'],monthLabel:x=>x,escHtml:x=>String(x)
};
vm.createContext(context);vm.runInContext(code,context);const rm=context.window.ReportingModel;
(async()=>{
  await rm.load();
  assert.equal(rm.actualsAvailable('2026-07-01'),true);
  assert.equal(rm.actualsAvailable('2026-08-01'),false);
  assert.equal(rm.periodBasis('2026-07-01'),'actual');
  assert.equal(rm.periodBasis('2026-08-01'),'forecast');
  assert.equal(rm.workingDays('2026-07'),23);
  assert.equal(rm.fullTimeHours('2026-07'),172.5);
  assert.equal(rm.actualFte('USR-1','DEM-1','2026-07'),Number((82.5/172.5).toFixed(6)));
  assert.equal(rm.forecastFte('USR-1','DEM-1','2026-07'),.4);
  assert.equal(rm.reportedFte('USR-1','DEM-1','2026-08'),.6);
  assert.equal(rm.unplannedFacts('2026-07').length,1);

  const redirected=rm.personMonthSummary('USR-3','2026-07');
  assert.equal(redirected.redirected,true);
  assert.equal(redirected.noActual,false);
  assert.equal(redirected.lowOverall,false);
  assert.equal(redirected.redirectedFte,.4);
  assert.equal(redirected.actualFte,.8);

  const none=rm.personMonthSummary('USR-4','2026-07');
  assert.equal(none.noActual,true);
  assert.equal(none.primarySignal,'no-actual');

  const low=rm.personMonthSummary('USR-5','2026-07');
  assert.equal(low.lowOverall,true);
  assert.equal(low.noActual,false);

  const over=rm.personMonthSummary('USR-6','2026-07');
  assert.equal(over.overCapacity,true);
  assert.equal(over.utilisationPct,120);

  const unplanned=rm.personMonthSummary('USR-7','2026-07');
  assert.equal(unplanned.unplannedFte,.2);
  assert.equal(unplanned.primarySignal,'unplanned');

  const signals=rm.managementSignals('2026-07');
  assert.equal(signals.noActualPeople.length,1);
  assert.equal(signals.lowOverallPeople.length,1);
  assert.equal(signals.redirectedPeople.length,1);
  assert.equal(signals.overCapacityPeople.length,1);
  assert.equal(signals.unplannedPeople.length,1);
  assert.equal(signals.unmappedProjectFacts.length,1);

  const demandOne=rm.demandEffortContext('DEM-1');
  assert.equal(demandOne.signal,'under-plan');
  assert(demandOne.redirectedAwayFte>=.4);
  assert.match(rm.demandEffortMessage('DEM-1'),/below plan/);
  assert.match(rm.demandEffortMessage('DEM-1'),/recording effort on other Demand/);

  const demandTwo=rm.demandEffortContext('DEM-2');
  assert.equal(demandTwo.signal,'over-plan');
  assert.equal(demandTwo.unplannedFte,.2);
  assert.match(rm.demandEffortMessage('DEM-2'),/without a corresponding Demand allocation/);

  const summary=rm.demandSummary('DEM-1');
  assert(summary.actualToDateFte>0);
  assert.equal(summary.forecastRemainingFte,.9);
  console.log('Reporting model tests passed');
  require('./report-renderer.test.js');
})().catch(e=>{console.error(e);process.exit(1)});
