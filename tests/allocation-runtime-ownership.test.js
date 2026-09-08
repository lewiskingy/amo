const fs=require('fs'),assert=require('assert');
const navigation=fs.readFileSync('src/app-navigation.js','utf8');
const canonical=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');
const app3=fs.readFileSync('src/app-3.js','utf8');
const filterToolbar=fs.readFileSync('src/app-allocation-filter-toolbar.js','utf8');

assert.match(canonical,/window\.renderAllocations=renderAllocations=function\(\)/,'Canonical Work Package module must install renderAllocations');
assert.match(canonical,/data-add-wp/,'Canonical renderer must create allocations from Work Package rows');
assert.match(canonical,/Allocate Person/);
assert.doesNotMatch(canonical,/data-add-allocation|New Allocation/,'Canonical renderer must not expose Demand-level allocation creation');

// Rich allocation editing is now baked into the canonical Work Package module. The retired modules
// were renderer/override layers and must not return as latent competing implementations.
for(const path of ['src/app-allocation-interactions.js','src/app-allocation-fill-polish.js','src/app-allocation-drag-wins.js']){
  assert.equal(fs.existsSync(path),false,`${path} should be retired after its behaviour is integrated into the canonical Work Package renderer`);
}
assert.match(canonical,/SNAP_VALUES=\[0,10,20,40,60,80,100\]/,'Canonical editor must own allocation snap increments');
assert.match(canonical,/alloc-level-handle/,'Canonical editor must own vertical percentage dragging');
assert.match(canonical,/alloc-fill-handle/,'Canonical editor must own directional fill');
assert.match(canonical,/function totalResourceFraction\(resourceId,month\)/,'Canonical editor must calculate whole-person monthly utilisation across allocations');
assert.match(canonical,/function capacityState\(resourceId,month\)/,'Canonical editor must own capacity-state colouring');
assert.match(canonical,/allocationState\.draft/,'Rich editing must mutate the canonical allocation draft model');
assert.doesNotMatch(navigation,/app-allocation-interactions\.js|app-allocation-fill-polish\.js|app-allocation-drag-wins\.js/,'Runtime must never load retired allocation override modules');

// Assert ownership by behaviour rather than by counting filename text. app-3 legitimately mentions the
// canonical filename in its contract comment and in both versioned/unversioned branches of one src assignment.
assert.equal((app3.match(/function loadWorkPackageResourcePlanning\(\)/g)||[]).length,1,'app-3 must contain exactly one canonical resource-planning loader');
assert.equal((app3.match(/document\.head\.appendChild\(script\)/g)||[]).length,1,'app-3 must append the canonical resource-planning script exactly once');
assert.match(app3,/script\.dataset\.amoWorkPackageResourcePlanning='true'/,'Canonical loader must mark its script instance');
assert.match(app3,/AMO_ASSET_VERSION\|\|window\.AMO_CONFIG\?\.buildId/,'Canonical loader must use the deployment build identity');
assert.doesNotMatch(filterToolbar,/loadWorkPackageResourcePlanning|dataset\.amoWorkPackageResourcePlanning|appendChild\(script\)/,'Filter toolbar must not own another resource-planning loader');

console.log('Allocation runtime ownership tests passed');
