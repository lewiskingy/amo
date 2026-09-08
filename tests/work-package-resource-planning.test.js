const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');
const app3=fs.readFileSync('src/app-3.js','utf8');
const filterToolbar=fs.readFileSync('src/app-allocation-filter-toolbar.js','utf8');
const navigation=fs.readFileSync('src/app-navigation.js','utf8');
const allocationModel=fs.readFileSync('src/app-allocation-model.js','utf8');

assert.match(ui,/Demand provides planning context/);
assert.match(ui,/named-person allocations are created against Work Packages/);
assert.match(ui,/function blankAllocation\(demandId,workPackageId\)/);
assert.match(ui,/workPackageId/);
assert.match(ui,/data-add-wp/);
assert.match(ui,/Allocate Person/);
assert.match(ui,/New allocations must be created against a Work Package/);
assert.match(ui,/legacy-wp-select/);
assert.match(ui,/Unassigned to WP/);
assert.match(ui,/assignLegacy/);
assert.match(ui,/wp\.demandId!==a\.demandId/);
assert.match(ui,/Budget Forecast/);
assert.match(ui,/WP Estimate/);
assert.match(ui,/Resource Plan/);
assert.match(ui,/packageSummary/);
assert.match(ui,/planningSummary/);
assert.match(ui,/window\.AllocationModel\?\.validate/);
assert.match(ui,/allowLegacy:true/,'Legacy Demand-only allocations remain editable during migration');
assert.doesNotMatch(ui,/Actual.*workPackageId|workPackage.*Actual/i,'WP resource planning must not invent WP Actuals');
assert.match(allocationModel,/Legacy allocation is not yet assigned to a Work Package/);

// The canonical renderer now also owns the rich Person × Month editing experience. This keeps the
// old usability without restoring any Demand-level renderer or patch-on-patch interaction modules.
assert.match(ui,/direct percentage entry, snapped vertical drag and directional fill/);
assert.match(ui,/alloc-pct-text/);
assert.match(ui,/alloc-level-handle/);
assert.match(ui,/alloc-fill-handle/);
assert.match(ui,/totalResourceFraction/);
assert.match(ui,/capacityState/);

// app-3 is the single load boundary for the canonical allocation UI. It must use the deployment
// build identity so a release cannot mix the current shell with a cached resource-planning module.
assert.match(app3,/Canonical allocation UI and persistence live in app-work-package-resource-planning\.js/);
assert.doesNotMatch(app3,/addAllocationForDemand|makeBlankAllocation|New Allocation/,'Legacy Demand-level allocation creation path must be retired');
assert.match(app3,/AMO_ASSET_VERSION\|\|window\.AMO_CONFIG\?\.buildId/);
assert.match(app3,/app-work-package-resource-planning\.js\?v=\$\{encodeURIComponent\(build\)\}/);
assert.doesNotMatch(app3,/app-work-package-resource-planning\.js\?v=20\d{6}/,'Canonical dynamic asset must not use a hard-coded release query');
assert.doesNotMatch(filterToolbar,/loadWorkPackageResourcePlanning|createElement\(['"]script['"]\)|script\.src\s*=|appendChild\(script\)/,'Filter toolbar must not own a second resource-planning loader');

// app-navigation must never load another allocation renderer or interaction override. The rich
// editing behaviour is part of the canonical Work Package implementation.
assert.match(navigation,/sole allocation renderer\/save/);
assert.match(navigation,/app-allocation-filter-toolbar\.js/);
assert.doesNotMatch(navigation,/app-allocation-interactions\.js/,'Retired Demand-level renderer must not be loaded by the application shell');
assert.doesNotMatch(navigation,/app-allocation-fill-polish\.js|app-allocation-drag-wins\.js/,'Retired interaction overrides must not be loaded');

console.log('Work Package resource planning tests passed');
require('./allocation-runtime-ownership.test.js');
require('./work-package-allocation-editor.test.js');
require('./planning-reporting.test.js');
require('./planning-reporting-contract.test.js');
