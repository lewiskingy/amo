const fs=require('fs'),assert=require('assert');
const recordModal=fs.readFileSync('src/app-record-modal.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const app5=fs.readFileSync('src/app-5.js','utf8');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const workflows=fs.readFileSync('src/app-service-workflows.js','utf8');
const actuals=fs.readFileSync('src/app-actuals.js','utf8');
const actualsAdmin=fs.readFileSync('src/app-actuals-admin.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');

assert.match(recordModal,/projectNumber:''/);
assert.match(recordModal,/modalField\('Project Number','projectNumber'/);
assert.match(recordModal,/Project Number must contain digits only/);
assert.match(recordModal,/Project Number .* is already assigned to/);
assert.doesNotMatch(recordModal,/Cost Centre \/ Project Code/);
assert.doesNotMatch(recordModal,/costCentreOrProjectCode:''/);

assert.match(demandGrid,/key:'projectNumber',label:'Project Number'/);
assert.doesNotMatch(demandGrid,/key:'costCentreOrProjectCode',label:'Cost Centre \/ Project Code'/);
assert.match(demandGrid,/Project Number for \$\{d\.id\} must contain digits only/);
assert.match(demandGrid,/seenProjects\.has\(d\.projectNumber\)/);
assert.doesNotMatch(app5,/<strong>Cost Centre \/ Project Code:<\/strong>/);

// Late-loaded layers consume the canonical Defined Demand model rather than recreating old fields.
assert.match(integrations,/const baseDemandColumns=demandCols\.filter/);
assert.doesNotMatch(integrations,/key:'costCentreOrProjectCode'/);
assert.doesNotMatch(integrations,/label:'Cost Centre \/ Project Code'/);
assert.doesNotMatch(integrations,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.match(workflows,/Retired by Defined Demand model v2/);
assert.doesNotMatch(workflows,/Cost Centre \/ Project Code|costCentreOrProjectCode|Work Item — Azure DevOps|modalField\(/);
assert.match(worker,/window\.AMO_ASSET_VERSION=\$\{JSON\.stringify\(config\.buildId\)\}/);
assert.match(worker,/function versionStaticAssets\(html,buildId\)/);
assert.match(worker,/html=versionStaticAssets\(await response\.text\(\),config\.buildId\)/);
assert.match(worker,/headers\.set\('Cache-Control','no-store'\)/);

assert.match(actuals,/function projectNumber\(demand\)/);
assert.match(actuals,/demand\?\.projectNumber/);
assert.doesNotMatch(actuals,/demand\?\.costCentreOrProjectCode/);
assert.doesNotMatch(actuals,/demand\?\.projectNumbers/);
assert.doesNotMatch(actuals,/demand\?\.projectCodes/);
assert.match(actuals,/ambiguousProjectNumbers/);
assert.match(actuals,/ambiguousProjectRows/);
assert.match(actualsAdmin,/optional unique <strong>Project Number<\/strong> on Demand/);
assert.match(actualsAdmin,/assigned to more than one Demand/);

console.log('Demand Project Number contract tests passed');
