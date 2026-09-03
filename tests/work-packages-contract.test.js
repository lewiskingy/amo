const fs=require('fs'),assert=require('assert');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const demandDetail=fs.readFileSync('src/app-5.js','utf8');
const localRepository=fs.readFileSync('src/app-workspace-repository.js','utf8');
const serverRepository=fs.readFileSync('server/repository.js','utf8');
const mongoRepository=fs.readFileSync('server/mongo-repository.js','utf8');
const targetStage=fs.readFileSync('src/app-target-stage.js','utf8');
const index=fs.readFileSync('src/index.html','utf8');

assert.match(workPackages,/ENTITY_TYPE='workPackages',LOCAL_FOLDER='work-packages'/);
assert.match(workPackages,/demandId:trim\(record\?\.demandId\)/);
assert.match(workPackages,/acceptanceCriteria:trim\(record\?\.acceptanceCriteria\)/);
assert.match(workPackages,/azureDevOpsWorkItemId:trim\(record\?\.azureDevOpsWorkItemId\)/);
assert.match(workPackages,/Team':trim\(departmentConfig\.organization\)\?'Department':trim\(system\.defaultOrganization\)\?'System'/);
assert.match(workPackages,/const organization=trim\(teamConfig\.organization\)\|\|trim\(departmentConfig\.organization\)\|\|trim\(system\.defaultOrganization\)/);
assert.match(workPackages,/const project=trim\(teamConfig\.project\)\|\|trim\(departmentConfig\.project\)/);
assert.match(workPackages,/https:\/\/dev\.azure\.com\/\$\{encodeURIComponent\(ctx\.organization\)\}\/\$\{encodeURIComponent\(ctx\.project\)\}\/_workitems\/edit\/\$\{encodeURIComponent\(id\)\}/);
assert.match(workPackages,/Azure DevOps Work Item Reference/);
assert.doesNotMatch(workPackages,/azureDevOpsUrl\s*:/);

assert.match(demandGrid,/selectedDemandId=tr\.dataset\.row;renderDemandDetail\(\);window\.WorkPackages\?\.renderDemandPanel\?\.\(\)/);
assert.match(demandDetail,/window\.WorkPackages\?\.renderDemandPanel\?\.\(\)/);
assert.match(workPackages,/\+ Work Package/);

assert.match(localRepository,/workPackages:'work-packages'/);
assert.match(localRepository,/\['demand','team','allocations','ideas','work-packages','config','actuals'\]/);
assert.match(serverRepository,/workPackages:'work-packages'/);
assert.match(serverRepository,/REQUIRED_FOLDERS=.*'work-packages'/);
assert.match(mongoRepository,/ENTITY_TYPES=new Set\(\['demand','team','allocations','ideas','workPackages'\]\)/);
assert.ok(index.includes('app-work-packages.js?v=20260903-1'),'Work Package module is not loaded by the application shell.');
assert.match(targetStage,/const APP_VERSION='1\.1\.1'/);

console.log('Work Package domain and Azure DevOps inheritance contract tests passed');
