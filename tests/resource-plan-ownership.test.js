const fs=require('fs'),path=require('path'),assert=require('assert');
const canonicalPath='src/app-resource-plan.js';
const canonical=fs.readFileSync(canonicalPath,'utf8');
const reportingModel=fs.readFileSync('src/app-reporting-model.js','utf8');
const periodPresentation=fs.readFileSync('src/app-reporting-period-presentation.js','utf8');
const financeCompat=fs.readFileSync('src/app-financial-planning.js','utf8');
const legacyEntrypoint=fs.readFileSync('src/app-4.js','utf8');
const department=fs.readFileSync('src/app-department.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');

assert.match(canonical,/Resource Plan presentation/);
assert.match(canonical,/function renderResource\(\)/,'canonical Resource Plan renderer is missing');
assert.match(canonical,/ReportingModel/);
/* Scoped Resource Plan totals intentionally aggregate ReportingModel.reportedFte over the
   selected Demand set. reportedTotalFte is whole-workspace only and would bypass scope. */
assert.match(canonical,/reportedFte/);
assert.match(canonical,/reportedDays/);
assert.match(canonical,/reportedCost/);
assert.match(canonical,/scopedPeople/);
assert.match(canonical,/scopedDemand/);
assert.match(canonical,/scopedAllocations/);
assert.match(canonical,/periodBasis/,'Resource Plan must consume canonical period basis semantics');
assert.match(periodPresentation,/ReportingModel\?\.periodBasis/,'Actual/Forecast presentation must derive from ReportingModel');
assert.match(canonical,/Actual at Demand · plan/,'allocation detail must distinguish observed Demand-level Actuals from the Work Package planning baseline');

/* Forecast arithmetic remains owned by ReportingModel. The Resource Plan presentation may
   consume reported values instead of calling forecastFte directly when no separate plan-vs-actual
   measure is being rendered. */
assert.match(reportingModel,/forecastFte/);
assert.match(reportingModel,/allocationFte/);
assert.match(reportingModel,/allocationCost/);
assert.match(reportingModel,/actualCost/);
assert.match(reportingModel,/capacityCost/);
assert.match(reportingModel,/renderResourcePlanFinancialSummary/);

assert.match(financeCompat,/Retired compatibility module/);
assert.doesNotMatch(financeCompat,/renderResource\s*=|function\s+renderResource/,'legacy finance code must not own or wrap Resource Plan rendering');
assert.doesNotMatch(financeCompat,/function\s+workingDays|allocationValue\s*\(/,'legacy finance code must not recreate canonical quantitative reporting formulas');
assert.match(legacyEntrypoint,/app-resource-plan\.js/);
assert.doesNotMatch(legacyEntrypoint,/function\s+renderResource/,'legacy numeric module may only load the canonical renderer');

assert.match(department,/function scopedPeople\(\)/);
assert.match(department,/function scopedDemand\(\)/);
assert.match(department,/function scopedAllocations\(\)/);
assert.doesNotMatch(department,/function\s+renderResource\s*\(|renderResource\s*=\s*function/,
  'Department scope must provide data scope only; it must not own Resource Plan presentation');

for(const name of fs.readdirSync('src').filter(n=>n.endsWith('.js')&&n!==path.basename(canonicalPath)&&n!=='app-4.js')){
  const code=fs.readFileSync(path.join('src',name),'utf8');
  assert.doesNotMatch(code,/function\s+renderResource\s*\(|renderResource\s*=\s*function/,
    `${name} defines or overrides renderResource; app-resource-plan.js must be the sole owner`);
}

// The HTML application shell is the source of truth for the deployment build identity. It must
// never be reused across deployments, otherwise a browser can combine an older parser-loaded core
// module with newer dynamically loaded presentation modules.
assert.match(worker,/function versionApplicationScripts/);
assert.match(worker,/AMO_ASSET_VERSION/);
assert.match(worker,/headers\.set\('Cache-Control','no-store, max-age=0'\)/);
assert.match(worker,/headers\.set\('Pragma','no-cache'\)/);
assert.match(worker,/headers\.set\('X-AMO-Build',config\.buildId\)/);
console.log('Resource Plan ownership contract tests passed');
