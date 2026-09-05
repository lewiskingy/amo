const fs=require('fs'),assert=require('assert');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');

// Any late Demand renderer must preserve the canonical Work Package tree decoration.
assert.match(integrations,/window\.WorkPackages\?\.renderDemandTreeRows\?\.\(table,rows\)/,
  'Late Demand renderer must invoke the canonical Work Package tree renderer.');
assert.match(workPackages,/function renderDemandTreeRows\(table,demands\)/);

console.log('Demand/Work Package renderer composition contract tests passed');
