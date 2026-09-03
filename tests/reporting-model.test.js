const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-reporting-model.js','utf8');
const periods={
  '2026-07':{schemaVersion:1,month:'2026-07',facts:[
    {teamMemberId:'USR-1',demandId:'DEM-1',actualHours:82.5,actualCostGbp:8000},
    {teamMemberId:'USR-1',demandId:null,actualHours:16.5,actualCostGbp:1200},
    {teamMemberId:'USR-2',demandId:'DEM-1',actualHours:41.25,actualCostGbp:4000}
  ]}
};
const repository={
  listActualsPeriods:async()=>Object.keys(periods),
  readActualsPeriod:async month=>periods[month]||null,
  readActualsManifest:async()=>({import:{firstMonth:'2026-07',latestMonth:'2026-07'}}),
  getSettings:async()=>context.db.settings,
  saveSettings:async()=>{}
};
const context={
  console,structuredClone,queueMicrotask,
  db:{settings:{reporting:{standardHoursPerDay:7.5}},team:[{id:'USR-1',name:'One',fte:1,active:true},{id:'USR-2',name:'Two',fte:.5,active:true}],demand:[{id:'DEM-1',title:'Demand 1',status:'In Progress'}],allocations:[
    {teamMemberId:'USR-1',demandId:'DEM-1',forecast:{'2026-07-01':.4,'2026-08-01':.6}},
    {teamMemberId:'USR-2',demandId:'DEM-1',forecast:{'2026-07-01':.2,'2026-08-01':.3}}
  ],configFiles:{}},
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
  assert.equal(rm.reportedFte('USR-1','DEM-1','2026-07'),Number((82.5/172.5).toFixed(6)));
  assert.equal(rm.reportedFte('USR-1','DEM-1','2026-08'),.6);
  assert.equal(rm.unplannedFacts('2026-07').length,1);
  const summary=rm.demandSummary('DEM-1');
  assert(summary.actualToDateFte>0);
  assert.equal(summary.forecastRemainingFte,.9);
  assert.equal(summary.actualHoursToDate,123.75);
  assert.equal(summary.actualCostToDate,12000);
  console.log('Reporting model tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
