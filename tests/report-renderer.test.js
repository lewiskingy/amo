const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{},structuredClone};vm.createContext(context);vm.runInContext(fs.readFileSync('src/app-report-renderer.js','utf8'),context);const renderer=context.window.AmoReportRenderer;
const report={
  id:'SR-1',status:'Published',reportingDate:'2026-09-03',
  dashboardSnapshot:{actualsCoverage:'Actuals Jan 2026–Jul 2026',activeDemand:1,unallocated:0,inSocialisation:0,inGovernance:0,capacityConflicts:0,capacityOutlook:[{month:'2026-07-01',label:'Jul 2026',basis:'actual',capacityFte:2,reportedFte:1.5,allocatedFte:1.5,utilisationPct:75},{month:'2026-08-01',label:'Aug 2026',basis:'forecast',capacityFte:2,reportedFte:1.8,allocatedFte:1.8,utilisationPct:90}],financialOutlook:{rows:[{month:'2026-08-01',label:'Aug 2026',capacity:10000,funded:6000,unfunded:1000,remaining:3000}],totals:{capacity:10000,funded:6000,unfunded:1000,remaining:3000}}},
  entries:[{demandId:'DEM-1',title:'Demand One',owner:'Owner',service:'Design',health:'At Risk',statusUpdate:'Update',achievements:'Done',issues:'Issue',effortContext:{actualToDateFte:1.2,historicalForecastFte:1.6,varianceToDateFte:-.4,signal:'under-plan',message:'Actual effort is 25% below plan to date. 0.3 FTE-mo of planned shortfall coincides with those People recording effort on other Demand.'}}]
};
const html=renderer.renderReport(report);
assert.match(html,/Actuals Jan 2026–Jul 2026/);
assert.match(html,/ACTUAL/);
assert.match(html,/FORECAST/);
assert.match(html,/1\.5 \/ 2\.0 FTE/);
assert.match(html,/Effort to date/);
assert.match(html,/Actual 1\.2 FTE-mo/);
assert.match(html,/plan 1\.6 FTE-mo/);
assert.match(html,/under plan/);
assert.match(html,/coincides with those People recording effort on other Demand/);
assert.match(html,/Allocation outlook remains the planning baseline/);
console.log('Report renderer tests passed');
