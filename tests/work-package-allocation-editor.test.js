const fs=require('fs'),assert=require('assert');
const ui=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');

// Rich editing remains inside the canonical Work Package renderer rather than reintroducing an
// override renderer. All interaction paths update allocationState.draft through setPct.
assert.match(ui,/const SNAP_VALUES=\[0,10,20,40,60,80,100\]/);
assert.match(ui,/function snapPercent\(raw\)/);
assert.match(ui,/function setPct\(aid,month,value\)/);
assert.match(ui,/currentAllocation\(aid\)/);
assert.match(ui,/a\.forecast\[month\]=Math\.max\(0,Math\.min\(100,Number\(value\)\|\|0\)\)\/100/);

// Direct editing, snapped vertical drag and directional fill are all available on Person × Month cells.
assert.match(ui,/class=\"alloc-pct-text\"/);
assert.match(ui,/class=\"alloc-level-handle\"/);
assert.match(ui,/data-fill=\"left\"/);
assert.match(ui,/data-fill=\"right\"/);
assert.match(ui,/function bindPctInputs\(\)/);
assert.match(ui,/function bindVerticalHandles\(\)/);
assert.match(ui,/function bindFillHandles\(\)/);
assert.match(ui,/pct=snapPercent\(raw\)/,'Vertical drag should use the defined percentage increments');
assert.match(ui,/original=Object\.fromEntries/,'Fill drag should preserve the original row for reversible preview');
assert.match(ui,/for\(const m of visibleMonths\)a\.forecast\[m\]=original\[m\]/,'Fill preview should restore the original row before applying the current range');

// Colouring reports whole-person utilisation across every visible allocation, not only the Work Package being edited.
assert.match(ui,/function totalResourceFraction\(resourceId,month\)/);
assert.match(ui,/allocationSource\(\)\.filter\(a=>a\.teamMemberId===resourceId/);
assert.match(ui,/function capacityState\(resourceId,month\)/);
assert.match(ui,/usedPct>100\.0001/);
assert.match(ui,/usedPct>=80/);
assert.match(ui,/usedPct<=30\.0001/);
assert.match(ui,/state-blue/);
assert.match(ui,/state-green/);
assert.match(ui,/state-amber/);
assert.match(ui,/state-red/);
assert.match(ui,/function refreshPerson\(resourceId\)/,'Capacity feedback should refresh all visible allocations for the affected Person');

// Dragging deliberately cancels any half-entered text value so one gesture cannot race another.
assert.match(ui,/function cancelActivePercentageEdit\(\)/);
assert.match(ui,/cancelCommit/);
assert.match(ui,/cancelActivePercentageEdit\(\);/);

// Domain and persistence ownership remain unchanged.
assert.match(ui,/function blankAllocation\(demandId,workPackageId\)/);
assert.match(ui,/data-add-wp/);
assert.match(ui,/New allocations must be created against a Work Package/);
assert.match(ui,/window\.saveAllocations=saveAllocations=function\(\)/);
assert.doesNotMatch(ui,/addAllocationForDemand|data-add-allocation|New Allocation/);

console.log('Work Package allocation editor tests passed');
