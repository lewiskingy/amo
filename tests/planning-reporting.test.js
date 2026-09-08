const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-planning-reporting.js','utf8');
const demand=[{id:'DEM-1',title:'Customer Platform',status:'In Progress',initialEstimate:{estimatedDays:80},budgetForecast:{estimatedDays:100}},{id:'DEM-2',title:'No forecast',status:'Planned',initialEstimate:{estimatedDays:20},budgetForecast:{estimatedDays:null}},{id:'DEM-3',title:'Large plan drift',status:'In Progress',initialEstimate:{estimatedDays:20},budgetForecast:{estimatedDays:null}}];
const allocations=[
  {id:'A1',demandId:'DEM-1',workPackageId:'WP-1',teamMemberId:'USR-1',forecast:{'2026-09-01':.5}},
  {id:'A2',demandId:'DEM-1',workPackageId:'WP-2',teamMemberId:'USR-2',forecast:{'2026-09-01':.6}},
  {id:'LEG',demandId:'DEM-1',teamMemberId:'USR-1',forecast:{'2026-09-01':.1}},
  {id:'A3',demandId:'DEM-3',workPackageId:'WP-3',teamMemberId:'USR-3',forecast:{'2026-09-01':1}}
];
const workPackages=[{id:'WP-1',demandId:'DEM-1',title:'Discovery',estimatedEffortDays:40},{id:'WP-2',demandId:'DEM-1',title:'Delivery',estimatedEffortDays:55},{id:'WP-3',demandId:'DEM-3',title:'Delivery',estimatedEffortDays:20}];
const context={
  console,db:{demand,allocations},planningPeriods:()=>['2026-09-01'],isOpenDemand:()=>true,
  window:{
    ReportingModel:{
      SIGNAL_THRESHOLDS:{materialVariancePct:.20},
      allocationDays:a=>({A1:50,A2:55,LEG:10,A3:138.6}[a.id]||0),
      demandSummary:id=>id==='DEM-1'?{actualDaysToDate:42,forecastRemainingDays:73,projectedDays:115}:id==='DEM-3'?{actualDaysToDate:38.8,forecastRemainingDays:90.2,projectedDays:129}:{actualDaysToDate:0,forecastRemainingDays:0,projectedDays:0}
    },
    WorkPackages:{state:{rows:workPackages},summaryForDemand:id=>id==='DEM-1'?{count:2,estimatedCount:2,estimatedEffortDays:95}:id==='DEM-3'?{count:1,estimatedCount:1,estimatedEffortDays:20}:{count:0,estimatedCount:0,estimatedEffortDays:0}}
  }
};
vm.createContext(context);vm.runInContext(code,context);const pr=context.window.PlanningReporting;
assert(pr,'PlanningReporting should load');
const c=pr.demandContext('DEM-1');
assert.equal(c.romDays,80);assert.equal(c.budgetForecastDays,100);assert.equal(c.wpEstimateDays,95);assert.equal(c.resourcePlanDays,115);assert.equal(c.actualDaysToDate,42);assert.equal(c.projectedDays,115);assert.equal(c.legacyAllocationCount,1);
assert.equal(c.wpVsBudget.delta,-5);assert.equal(c.wpVsBudget.material,false);
assert.equal(c.resourceVsBudget.delta,15);assert.equal(c.resourceVsBudget.material,false,'15% variance is below the 20% materiality threshold');
assert.equal(c.projectedVsBudget.delta,15);
const wp=pr.workPackageContext('WP-1');assert.equal(wp.estimateDays,40);assert.equal(wp.resourcePlanDays,50);assert.equal(wp.resourceVsEstimate.delta,10);assert.equal(wp.resourceVsEstimate.material,true);
const signals=pr.demandSignals('DEM-1');assert(signals.some(s=>s.code==='legacy-allocation'));assert(!signals.some(s=>s.code==='projected-vs-budget'),'15% projected variance should not be material');
assert(pr.demandSignals('DEM-2').some(s=>s.code==='budget-forecast-missing'));
const drift=pr.demandContext('DEM-3');assert.equal(drift.resourceVsWp.material,true);assert.equal(drift.projectedVsWp.material,true);const driftSignals=pr.demandSignals('DEM-3');assert(driftSignals.some(s=>s.code==='resource-vs-wp'&&s.severity==='warning'),'Resource Plan far above WP Estimate must be surfaced even when Budget Forecast is absent');assert(driftSignals.some(s=>s.code==='projected-vs-wp'&&s.severity==='warning'),'Projected effort far above WP Estimate must be surfaced even when Budget Forecast is absent');
const material=pr.comparison(25,100,'above','below');assert.equal(material.material,true);assert.equal(material.state,'above');assert.equal(material.label,'+25d (+25%)');
console.log('Planning reporting tests passed');
