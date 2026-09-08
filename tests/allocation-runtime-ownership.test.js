const fs=require('fs'),assert=require('assert');
const navigation=fs.readFileSync('src/app-navigation.js','utf8');
const canonical=fs.readFileSync('src/app-work-package-resource-planning.js','utf8');
const legacyInteractions=fs.readFileSync('src/app-allocation-interactions.js','utf8');
const app3=fs.readFileSync('src/app-3.js','utf8');

assert.match(canonical,/window\.renderAllocations=renderAllocations=function\(\)/,'Canonical Work Package module must install renderAllocations');
assert.match(canonical,/data-add-wp/,'Canonical renderer must create allocations from Work Package rows');
assert.match(canonical,/Allocate Person/);
assert.doesNotMatch(canonical,/data-add-allocation|New Allocation/,'Canonical renderer must not expose Demand-level allocation creation');

assert.match(legacyInteractions,/renderAllocations=function\(\)/,'Fixture proves retired module is a competing renderer');
assert.match(legacyInteractions,/New Allocation/,'Fixture proves retired module exposes the obsolete Demand-level action');
assert.doesNotMatch(navigation,/app-allocation-interactions\.js/,'Runtime must never load the competing Demand-level renderer');
assert.doesNotMatch(navigation,/app-allocation-fill-polish\.js|app-allocation-drag-wins\.js/,'Runtime must not load interaction extensions coupled to the retired renderer');
assert.equal((app3.match(/app-work-package-resource-planning\.js/g)||[]).length,2,'app-3 should be the single loader and mention the canonical module only in its contract/comment and source path');

console.log('Allocation runtime ownership tests passed');
