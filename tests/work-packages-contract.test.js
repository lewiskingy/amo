const fs=require('fs'),path=require('path'),assert=require('assert');
const app1=fs.readFileSync('src/app-1.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const app5=fs.readFileSync('src/app-5.js','utf8');
const recordModal=fs.readFileSync('src/app-record-modal.js','utf8');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const workflows=fs.readFileSync('src/app-service-workflows.js','utf8');
const remoteWorkspace=fs.readFileSync('src/app-remote-workspace.js','utf8');
const lock=fs.readFileSync('src/app-lock.js','utf8');
const localRepository=fs.readFileSync('src/app-workspace-repository.js','utf8');
const serverRepository=fs.readFileSync('server/repository.js','utf8');
const mongoRepository=fs.readFileSync('server/mongo-repository.js','utf8');
const targetStage=fs.readFileSync('src/app-target-stage.js','utf8');
const index=fs.readFileSync('src/index.html','utf8');
const acceptance=fs.readFileSync('src/docs/WorkPackagesAcceptance.md.txt','utf8');

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

// Step 3 parent/child management remains the foundation for Step 4.
assert.match(recordModal,/WorkPackages\?\.renderModalSection\?\.\(\$\('recordModalBody'\),r\.id\)/);
assert.match(workPackages,/function renderModalSection\(host,demandId\)/);
assert.match(workPackages,/section\.id='demandWorkPackagesSection'/);
assert.match(workPackages,/\+ Add Work Package/);
assert.match(workPackages,/Save or cancel the Demand edit before changing its child Work Packages/);
assert.doesNotMatch(workPackages,/renderDemandPanel|selectedDemandId/);
assert.doesNotMatch(demandGrid,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(integrations,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(app5,/demandDetail|function renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(app1,/selectedDemandId/);
assert.doesNotMatch(remoteWorkspace,/selectedDemandId/);
assert.doesNotMatch(index,/id="demandDetail"/);
assert.match(index,/Double-click a row to open its single-record view/);
assert.match(acceptance,/Demand record modal is the canonical parent\/child management surface/);

// Work Package remains the only active Azure DevOps work-item relationship.
assert.doesNotMatch(recordModal,/Work Item — Azure DevOps|azureDevOps\.url|azureDevOps\.title/);
assert.doesNotMatch(workflows,/Work Item — Azure DevOps|azureDevOps\.url|azureDevOps\.title/);
assert.doesNotMatch(integrations,/key:'_work'|key:'azureDevOps\.url'|key:'azureDevOps\.title'|demandWorkHtml|enhanceAllocationWorkColumn|enhanceResourceWorkColumn|enhanceRoadmapWorkLinks/);
assert.doesNotMatch(app1,/d\.azureDevOps/);
assert.match(recordModal,/delete next\.azureDevOps/);
assert.match(demandGrid,/delete d\.azureDevOps/);
for(const file of fs.readdirSync('data/sample/demand').filter(name=>name.endsWith('.json'))){
  const sample=fs.readFileSync(path.join('data/sample/demand',file),'utf8');
  assert.doesNotMatch(sample,/"azureDevOps"\s*:/,`${file} still models a Demand-level Azure DevOps relationship.`);
}

// A parent Demand cannot be deleted while child Work Packages still exist, preventing orphans.
assert.match(demandGrid,/Cannot delete Demand with child Work Packages/);
assert.match(demandGrid,/window\.WorkPackages\.forDemand\(id\)\.length/);
assert.match(demandGrid,/Work Packages are not ready yet/);

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

// Work Package writes participate in the workspace edit lock lifecycle.
assert.match(lock,/\[data-wp-edit\],\[data-wp-delete\],#addWorkPackage/);
assert.match(lock,/#wpCancel/);
assert.doesNotMatch(lock,/#wpSave/);
assert.match(workPackages,/await releaseEditLock\('Work Package edit completed'\)/);
assert.match(workPackages,/finally\{await releaseEditLock\('Work Package delete completed'\)\}/);

// Step 4 static assets must not mix old cached Demand/Work Package implementations.
assert.match(index,/app-demand-model\.js\?v=20260905-2/);
assert.match(index,/app-1\.js\?v=20260905-2/);
assert.match(index,/app-2\.js\?v=20260905-2/);
assert.match(index,/app-config\.js\?v=20260905-2/);
assert.match(index,/app-record-modal\.js\?v=20260905-2/);
assert.match(index,/app-roadmap\.js\?v=20260905-2/);
assert.match(index,/app-integrations\.js\?v=20260905-2/);
assert.match(index,/app-work-packages\.js\?v=20260905-2/);
assert.match(index,/app-defined-demand-ui\.js\?v=20260905-2/);
assert.match(targetStage,/const APP_VERSION='1\.2\.0'/);

console.log('Work Package domain, Demand child UX and Azure DevOps relationship contract tests passed');
require('./defined-demand-model.test.js');
require('./defined-demand-contract.test.js');
