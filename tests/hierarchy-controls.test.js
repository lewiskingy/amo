const fs=require('fs'),assert=require('assert');
const controls=fs.readFileSync('src/app-hierarchy-controls.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const loader=fs.readFileSync('src/app-4.js','utf8');

assert.match(workPackages,/function setDemandExpansion\(demandIds,expanded/,'Demand hierarchy must expose one canonical bulk-expansion operation');
assert.match(workPackages,/setDemandExpansion,collapsedDemandIds/,'Bulk controls and drill-through must share the canonical Work Package collapse state');
assert.match(controls,/data-hierarchy-expand/);
assert.match(controls,/data-hierarchy-collapse/);
assert.match(controls,/visibleDemandIds\(\)/,'Demand expand/collapse must operate on the currently visible population');
assert.match(controls,/visibleAllocationDemandIds\(\)/,'Allocation expand/collapse must operate on the currently visible population');
assert.match(controls,/expandedDemandIds\.add/);
assert.match(controls,/expandedWorkPackageIds\.add/,'Allocation Expand all must reveal nested allocations beneath Work Packages');
assert.match(controls,/demandFilters\?\.control==='work-item-missing'/,'Work Item Dashboard drill-through must auto-expand the filtered Demand hierarchy');
assert.match(controls,/allocationFilters\?\.control==='actuals-missing'/,'Actuals Dashboard drill-through must auto-expand the filtered Allocation hierarchy');
assert.doesNotMatch(controls,/saveRecord|saveSettings|requestAutosave|dirtyRecords/,'Hierarchy state is presentation-only and must not mutate workspace records');
assert.match(loader,/app-hierarchy-controls\.js/,'Hierarchy controls must be loaded by the application composition');
console.log('Hierarchy controls tests passed.');
