const fs=require('fs'),assert=require('assert');
const recordModal=fs.readFileSync('src/app-record-modal.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const demandDetail=fs.readFileSync('src/app-5.js','utf8');
const actuals=fs.readFileSync('src/app-actuals.js','utf8');
const actualsAdmin=fs.readFileSync('src/app-actuals-admin.js','utf8');

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
assert.match(demandDetail,/<strong>Project Number:<\/strong>/);
assert.doesNotMatch(demandDetail,/<strong>Cost Centre \/ Project Code:<\/strong>/);

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
