const fs=require('fs'),assert=require('assert');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');

// app-2.js owns the single Demand renderer, including Work Package tree decoration.
assert.match(demandGrid,/function renderGrid\(name\)/);
assert.match(demandGrid,/else if\(name==='demand'\)window\.WorkPackages\?\.renderDemandTreeRows\?\.\(table,rows\)/);
assert.match(workPackages,/function renderDemandTreeRows\(table,demands\)/);

// Integration concerns may configure source-provenance columns and decorate their cells, but must
// never rebuild the Demand table or introduce a second Demand-specific renderer.
assert.doesNotMatch(integrations,/function renderIntegratedDemandGrid/);
assert.doesNotMatch(integrations,/table\.innerHTML=`<thead><tr>\$\{cols\.map/);
assert.match(integrations,/const baseRenderGridIntegration=renderGrid/);
assert.match(integrations,/return baseRenderGridIntegration\(name\)/);
assert.match(integrations,/sourceDemandColumns/);
assert.match(integrations,/decorateDemandSourceCells/);
assert.match(integrations,/populateSourceTitleIfBlank/);

console.log('Canonical Demand/Work Package renderer composition contract tests passed');
