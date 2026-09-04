const fs=require('fs'),assert=require('assert');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const app5=fs.readFileSync('src/app-5.js','utf8');
const recordModal=fs.readFileSync('src/app-record-modal.js','utf8');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const workflows=fs.readFileSync('src/app-service-workflows.js','utf8');
const localRepository=fs.readFileSync('src/app-workspace-repository.js','utf8');
const serverRepository=fs.readFileSync('server/repository.js','utf8');
const mongoRepository=fs.readFileSync('server/mongo-repository.js','utf8');
const targetStage=fs.readFileSync('src/app-target-stage.js','utf8');
const index=fs.readFileSync('src/index.html','utf8');

assert.match(workPackages,/const ENTITY_TYPE='workPackages'/);
assert.match(workPackages,/demandId:trim\(record\?\.demandId\)/);
assert.match(workPackages,/acceptanceCriteria:trim\(record\?\.acceptanceCriteria\)/);
assert.match(workPackages,/azureDevOpsWorkItemId:trim\(record\?\.azureDevOpsWorkItemId\)/);
assert.match(workPackages,/const organization=trim\(teamConfig\.organization\)\|\|trim\(departmentConfig\.organization\)\|\|trim\(system\.defaultOrganization\)/);
assert.match(workPackages,/const project=trim\(teamConfig\.project\)\|\|trim\(departmentConfig\.project\)/);
assert.match(workPackages,/https:\/\/dev\.azure\.com\/\$\{encodeURIComponent\(ctx\.organization\)\}\/\$\{encodeURIComponent\(ctx\.project\)\}\/_workitems\/edit\/\$\{encodeURIComponent\(id\)\}/);
assert.match(workPackages,/Azure DevOps Work Item Reference/);
assert.doesNotMatch(workPackages,/azureDevOpsUrl\s*:/);
assert.doesNotMatch(workPackages,/configuredDepartmentsSafe\(\)\[0\]/);

// Step 3: Demand record is the canonical parent/child management surface.
assert.match(recordModal,/WorkPackages\?\.renderModalSection\?\.\(\$\('recordModalBody'\),r\.id\)/);
assert.match(workPackages,/function renderModalSection\(host,demandId\)/);
assert.match(workPackages,/id='demandWorkPackagesSection'|id="demandWorkPackagesSection"|section\.id='demandWorkPackagesSection'/);
assert.match(workPackages,/\+ Add Work Package/);
assert.doesNotMatch(workPackages,/renderDemandPanel/);
assert.doesNotMatch(workPackages,/selectedDemandId/);
assert.doesNotMatch(demandGrid,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(integrations,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(app5,/function renderDemandDetail|renderDemandPanel/);

// Work Package is the only Azure DevOps work-item relationship.
assert.doesNotMatch(recordModal,/Work Item — Azure DevOps|azureDevOps\.url|azureDevOps\.title/);
assert.doesNotMatch(workflows,/Work Item — Azure DevOps|azureDevOps\.url|azureDevOps\.title/);
assert.doesNotMatch(integrations,/key:'_work'|key:'azureDevOps\.url'|key:'azureDevOps\.title'|demandWorkHtml|enhanceAllocationWorkColumn|enhanceResourceWorkColumn|enhanceRoadmapWorkLinks/);
assert.match(recordModal,/delete next\.azureDevOps/);
assert.match(demandGrid,/delete d\.azureDevOps/);

// Work Package persistence uses the repository contract rather than a parallel local-only path.
assert.match(workPackages,/repo\.listRecords\(ENTITY_TYPE/);
assert.match(workPackages,/repo\.saveRecord\(ENTITY_TYPE,record\)/);
assert.match(workPackages,/repo\.deleteRecord\(ENTITY_TYPE,id\)/);
assert.doesNotMatch(workPackages,/listJsonRecords|writeJson\(|deletePath\(/);
assert.match(localRepository,/workPackages:'work-packages'/);
assert.match(localRepository,/\['demand','team','allocations','ideas','work-packages','config','actuals'\]/);
assert.match(serverRepository,/workPackages:'work-packages'/);
assert.match(serverRepository,/REQUIRED_FOLDERS=.*'work-packages'/);
assert.match(mongoRepository,/ENTITY_TYPES=new Set\(\['demand','team','allocations','ideas','workPackages'\]\)/);
assert.ok(index.includes('app-work-packages.js'),'Work Package module is not loaded by the application shell.');
assert.match(targetStage,/const APP_VERSION='1\.1\.5'/);

console.log('Work Package domain, Demand child UX and Azure DevOps relationship contract tests passed');
