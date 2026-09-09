const fs=require('fs'),assert=require('assert');
const arrangement=fs.readFileSync('src/app-list-arrangement.js','utf8');
const navigation=fs.readFileSync('src/app-navigation.js','utf8');

// One shared presentation capability owns the Arrange By vocabulary across the three portfolio views.
assert.match(arrangement,/\{value:'demand',label:'Demand'\}/);
assert.match(arrangement,/\{value:'businessArea',label:'Business Area'\}/);
assert.match(arrangement,/\{value:'initiative',label:'Initiative'\}/);
assert.match(arrangement,/\{value:'owner',label:'Owner'\}/);
assert.match(arrangement,/PREF_PREFIX='amo:arrange:'/);
assert.match(arrangement,/ensureControl\(toolbar,'demand'/);
assert.match(arrangement,/ensureControl\(toolbar,'status-report'/);
assert.match(arrangement,/ensureControl\(toolbar,'allocations'/);

// Grouping is view-only and keeps missing portfolio metadata visible in a deterministic Unassigned group.
assert.match(arrangement,/return clean\(value\)\|\|'Unassigned'/);
assert.match(arrangement,/if\(a==='Unassigned'/);
assert.match(arrangement,/amo-arrange-group/);
assert.doesNotMatch(arrangement,/markDirty|requestAutosave|saveStatusReport|saveGrid\(/,'Arrange By must not mutate workspace business data');

// Status Reporting gains Business Area and Initiative filters before grouping is applied.
assert.match(arrangement,/statusFilters=\{businessArea:'',initiative:''\}/);
assert.match(arrangement,/data-amo-status-filter="\$\{key\}"/);
assert.match(arrangement,/field\('Business Area','businessArea'\)/);
assert.match(arrangement,/field\('Initiative','initiative'\)/);
assert.match(arrangement,/statusVisible/);

// Allocation grouping keeps the canonical Demand -> Work Package -> Allocation block intact.
assert.match(arrangement,/blocksFromRows\(tbody,'tr\.allocation-demand-header'/);
assert.match(arrangement,/allocation-demand-id/);
assert.match(arrangement,/block\.rows\.forEach\(row=>tbody\.appendChild\(row\)\)/);

// Load only after the Status Report composition chain, so the capability decorates final canonical renderers.
assert.match(navigation,/\['app-list-arrangement\.js','amoListArrangement'\]/);
const deepLinks=navigation.indexOf("['app-status-report-deep-links.js','amoStatusReportDeepLinks']");
const arrange=navigation.indexOf("['app-list-arrangement.js','amoListArrangement']");
assert.ok(deepLinks>=0&&arrange>deepLinks,'Arrange By should load after the Status Reporting composition chain');

console.log('List arrangement tests passed');
