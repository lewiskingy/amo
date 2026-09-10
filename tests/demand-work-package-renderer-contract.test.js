const fs=require('fs'),assert=require('assert');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const composition=fs.readFileSync('src/app-demand-grid-composition.js','utf8');
const commitment=fs.readFileSync('src/app-commitment-health.js','utf8');
const arrangement=fs.readFileSync('src/app-list-arrangement.js','utf8');

// app-2.js owns the one table renderer and nested Work Package render.
assert.match(demandGrid,/function renderGrid\(name\)/);
assert.match(demandGrid,/else if\(name==='demand'\)window\.WorkPackages\?\.renderDemandTreeRows\?\.\(table,rows\)/);
assert.match(workPackages,/function renderDemandTreeRows\(table,demands\)/);

// One explicit composition point owns the single runtime renderGrid replacement.
assert.match(composition,/const coreRenderGrid=renderGrid/);
assert.match(composition,/function composedRenderGrid\(name\)/);
assert.match(composition,/renderGrid=composedRenderGrid/);
assert.match(composition,/window\.AmoDemandGrid=\{register,unregister,contributions,coreRenderGrid,render:composedRenderGrid\}/);

// Demand feature modules register contributions rather than capturing/replacing renderGrid.
assert.doesNotMatch(integrations,/baseRenderGridIntegration|renderGrid=function/);
assert.match(integrations,/id:'demand-source-provenance',priority:10/);
assert.match(integrations,/beforeRender:\(\)=>installDemandColumns\(\)/);
assert.match(integrations,/afterRender:/);
assert.doesNotMatch(commitment,/const baseGrid=renderGrid|renderGrid=function\(name\)/);
assert.match(commitment,/id:'commitment-health',priority:20/);
assert.doesNotMatch(arrangement,/renderGrid=function\(name\)/);
assert.match(arrangement,/id:'list-arrangement',priority:30/);

// Integration concerns still own source provenance presentation, not table construction.
assert.doesNotMatch(integrations,/function renderIntegratedDemandGrid/);
assert.doesNotMatch(integrations,/table\.innerHTML=`<thead><tr>\$\{cols\.map/);
assert.match(integrations,/sourceDemandColumns/);
assert.match(integrations,/decorateDemandSourceCells/);
assert.match(integrations,/populateSourceTitleIfBlank/);

console.log('Canonical Demand/Work Package renderer composition contract tests passed');
