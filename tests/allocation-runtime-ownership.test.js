const fs=require('fs'),assert=require('assert');
const navigation=fs.readFileSync('src/app-navigation.js','utf8');
const canonical=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');
const legacyInteractions=fs.readFileSync('src/app-allocation-interactions.js','utf8');
const app3=fs.readFileSync('src/app-3.js','utf8');
const filterToolbar=fs.readFileSync('src/app-allocation-filter-toolbar.js','utf8');

assert.match(canonical,/window\.renderAllocations=renderAllocations=function\(\)/,'Canonical Work Package module must install renderAllocations');
assert.match(canonical,/data-add-wp/,'Canonical renderer must create allocations from Work Package rows');
assert.match(canonical,/Allocate Person/);
assert.doesNotMatch(canonical,/data-add-allocation|New Allocation/,'Canonical renderer must not expose Demand-level allocation creation');

assert.match(legacyInteractions,/renderAllocations=function\(\)/,'Fixture proves retired module is a competing renderer');
assert.match(legacyInteractions,/New Allocation/,'Fixture proves retired module exposes the obsolete Demand-level action');
assert.doesNotMatch(navigation,/app-allocation-interactions\.js/,'Runtime must never load the competing Demand-level renderer');
assert.doesNotMatch(navigation,/app-allocation-fill-polish\.js|app-allocation-drag-wins\.js/,'Runtime must not load interaction extensions coupled to the retired renderer');

// Assert ownership by behaviour rather than by counting filename text. app-3 legitimately mentions the
// canonical filename in its contract comment and in both versioned/unversioned branches of one src assignment.
assert.equal((app3.match(/function loadWorkPackageResourcePlanning\(\)/g)||[]).length,1,'app-3 must contain exactly one canonical resource-planning loader');
assert.equal((app3.match(/document\.head\.appendChild\(script\)/g)||[]).length,1,'app-3 must append the canonical resource-planning script exactly once');
assert.match(app3,/script\.dataset\.amoWorkPackageResourcePlanning='true'/,'Canonical loader must mark its script instance');
assert.match(app3,/AMO_ASSET_VERSION\|\|window\.AMO_CONFIG\?\.buildId/,'Canonical loader must use the deployment build identity');
assert.doesNotMatch(filterToolbar,/loadWorkPackageResourcePlanning|dataset\.amoWorkPackageResourcePlanning|appendChild\(script\)/,'Filter toolbar must not own another resource-planning loader');

console.log('Allocation runtime ownership tests passed');
