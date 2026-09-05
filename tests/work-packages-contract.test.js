const fs=require('fs'),path=require('path'),assert=require('assert');
const app1=fs.readFileSync('src/app-1.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const app5=fs.readFileSync('src/app-5.js','utf8');
const recordModal=fs.readFileSync('src/app-record-modal.js','utf8');
const modalUx=fs.readFileSync('src/app-modal-ux.js','utf8');
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
assert.doesNotMatch(workPackages,/description:trim\(record\?\.description\)|acceptanceCriteria:trim\(record\?\.acceptanceCriteria\)/);
assert.doesNotMatch(workPackages,/wpDescription|wpAcceptance|Description \/ Scope|Acceptance Criteria/);
assert.match(workPackages,/Detailed description and acceptance criteria belong in the delivery backlog/i);
assert.match(workPackages,/azureDevOpsWorkItemId:trim\(record\?\.azureDevOpsWorkItemId\)/);
assert.match(workPackages,/const organization=trim\(teamConfig\.organization\)\|\|trim\(departmentConfig\.organization\)\|\|trim\(system\.defaultOrganization\)/);
assert.match(workPackages,/const project=trim\(teamConfig\.project\)\|\|trim\(departmentConfig\.project\)/);
assert.match(workPackages,/https:\/\/dev\.azure\.com\/\$\{encodeURIComponent\(ctx\.organization\)\}\/\$\{encodeURIComponent\(ctx\.project\)\}\/_workitems\/edit\/\$\{encodeURIComponent\(id\)\}/);
assert.match(workPackages,/Azure DevOps Work Item Reference/);
assert.doesNotMatch(workPackages,/azureDevOpsUrl\s*:/);
assert.doesNotMatch(workPackages,/configuredDepartmentsSafe\(\)\[0\]/);

// Demand Register is the canonical parent/child Work Package management surface.
assert.match(demandGrid,/key:'_wpEstimate',label:'WP Estimate'/);
assert.match(demandGrid,/window\.WorkPackages\?\.renderDemandTreeRows\?\.\(table,rows\)/);
assert.match(workPackages,/function renderDemandTreeRows\(table,demands\)/);
assert.match(workPackages,/class=\"wp-child-row\"/);
assert.match(workPackages,/data-wp-add=/);
assert.match(workPackages,/data-wp-edit=/);
assert.match(workPackages,/data-wp-row=/);
assert.match(workPackages,/\+ WP/);
assert.match(workPackages,/Delete Work Package/);
assert.match(workPackages,/Work Packages are managed from the nested rows in the Demand Register/);
assert.doesNotMatch(workPackages,/Save or cancel the Demand edit before changing its child Work Packages/);
assert.doesNotMatch(workPackages,/renderDemandPanel|selectedDemandId/);
assert.doesNotMatch(demandGrid,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(integrations,/selectedDemandId|renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(app5,/demandDetail|function renderDemandDetail|renderDemandPanel/);
assert.doesNotMatch(app1,/selectedDemandId/);
assert.doesNotMatch(remoteWorkspace,/selectedDemandId/);
assert.doesNotMatch(index,/id="demandDetail"/);
assert.match(index,/Double-click a row to open its single-record view/);
assert.match(acceptance,/Demand Register/);

// Work Package tree module must exist before app-2 performs the initial Demand grid render.
// Otherwise app-2's optional WorkPackages hook is skipped and an already-open remote workspace
// can show the parent Demand without its child rows or + WP action until another render occurs.
const wpScript=index.indexOf('app-work-packages.js?v=20260905-4');
const demandGridScript=index.indexOf('app-2.js?v=20260905-4');
assert(wpScript>=0&&demandGridScript>=0&&wpScript<demandGridScript,'Work Package module must load before Demand grid module.');

// Existing Demand records open in view mode; explicit Edit remains separate and lock guarded.
assert.match(modalUx,/baseOpenRecordModal\.call\(this,type,id,mode,extra\)/);
assert.doesNotMatch(modalUx,/baseOpenRecordModal\.call\(this,type,id,'edit',extra\)/);
assert.match(lock,/\[data-modal-edit\]/);

// Work Package editor owns create/edit/delete and acquires the lock regardless of entry path.
assert.match(workPackages,/async function ensureEditorLock/);
assert.match(workPackages,/if\(!await ensureEditorLock\(\)\)return/);
assert.match(workPackages,/id=\"wpDelete\" data-wp-delete/);
assert.match(workPackages,/await releaseEditLock\('Work Package edit completed'\)/);
assert.match(workPackages,/releaseEditLock\('Work Package delete completed'\)/);

// Work Package remains the only active Azure DevOps work-item relationship for now.
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
for(const file of fs.readdirSync('data/sample/work-packages').filter(name=>name.endsWith('.json'))){
  const wp=JSON.parse(fs.readFileSync(path.join('data/sample/work-packages',file),'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(wp,'description'),false,`${file} duplicates backlog description.`);
  assert.equal(Object.prototype.hasOwnProperty.call(wp,'acceptanceCriteria'),false,`${file} duplicates backlog acceptance criteria.`);
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

// Static assets for the changed Demand/Work Package UI use the same candidate cache key.
assert.match(index,/app-2\.js\?v=20260905-4/);
assert.match(index,/app-work-packages\.js\?v=20260905-4/);
assert.match(targetStage,/const APP_VERSION='1\.2\.2'/);

console.log('Work Package domain, nested Demand UX and backlog relationship contract tests passed');
require('./defined-demand-model.test.js');
require('./defined-demand-contract.test.js');
