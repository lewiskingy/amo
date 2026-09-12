const fs=require('fs'),assert=require('assert');

const settings=fs.readFileSync('src/app-config-settings.js','utf8');
const workItems=fs.readFileSync('src/client/domain/work-packages/work-item-reference.js','utf8');

// Azure DevOps is owned by the canonical tabbed Settings editor alongside other System/Organization settings.
assert.match(settings,/system:\{label:'System',keys:\['planningWindow','assistantUrl','azureDevOps','dataStage'\]\}/);
assert.match(settings,/organization:\{label:'Organization',keys:\['departments','teams','businessAreas','initiatives','tenantDomain'\]\}/);
assert.match(settings,/id="settingsAzdoDefaultOrganization"/);
assert.match(settings,/data-azdo-department-org/);
assert.match(settings,/data-azdo-department-project/);
assert.match(settings,/data-azdo-team-org/);
assert.match(settings,/data-azdo-team-project/);

// System and Organization values participate in the same optimistic repository save contract.
assert.match(settings,/const latest=await window\.workspaceRepository\.getSettings\(\)/);
assert.match(settings,/changed=scope\.keys\.filter/);
assert.match(settings,/await window\.workspaceRepository\.saveSettings\(merged\)/);
assert.match(settings,/db\.settings=\{\.\.\.clone\(DEFAULT_SETTINGS\),\.\.\.clone\(merged\)\}/);

// Editing Organization must preserve nested Azure DevOps metadata rather than stripping it during team normalization.
assert.match(settings,/function normalizeTeamsPreservingAzdo/);
assert.match(settings,/normalizeRowAzdo/);
assert.doesNotMatch(settings,/s\.teams=normalizeTeams\(s\.teams\|\|\[\]\)/);

// Blank overrides inherit; legacy flat fields are migrated to the canonical nested form when touched.
assert.match(settings,/rowAzdoOrganization\(row\).*azureDevOpsOrganization/);
assert.match(settings,/rowAzdoProject\(row\).*azureDevOpsProject/);
assert.match(settings,/delete row\.azureDevOpsOrganization/);
assert.match(settings,/delete row\.azureDevOpsProject/);
assert.match(settings,/Organisation inherits Team → Department → System; Project inherits Team → Department/);

// Work Package URL resolution remains the consumer of the persisted inheritance model.
assert.match(workItems,/clean\(teamConfig\.organization\).*clean\(departmentConfig\.organization\).*clean\(system\.defaultOrganization\)/s);
assert.match(workItems,/clean\(teamConfig\.project\).*clean\(departmentConfig\.project\)/s);
assert.match(workItems,/https:\/\/dev\.azure\.com\/\$\{encodeURIComponent\(context\.organization\)\}\/\$\{encodeURIComponent\(context\.project\)\}\/_workitems\/edit\/\$\{encodeURIComponent\(id\)\}/);

console.log('Azure DevOps settings contract tests passed');
