const fs=require('fs'),assert=require('assert');

const settings=fs.readFileSync('src/app-config-settings.js','utf8');
const users=fs.readFileSync('src/app-users-admin.js','utf8');
const tenant=fs.readFileSync('src/app-tenant-domain.js','utf8');
const hierarchy=fs.readFileSync('src/app-organization-hierarchy.js','utf8');
const target=fs.readFileSync('src/app-target-stage.js','utf8');
const transactions=fs.readFileSync('src/app-edit-transactions.js','utf8');
const shell=fs.readFileSync('src/app-5.js','utf8');

// Settings owns one transaction per tab, including the settings that previously had independent save paths.
assert.match(settings,/system:\{label:'System',keys:\['planningWindow','assistantUrl','azureDevOps','dataStage'\]\}/);
assert.match(settings,/organization:\{label:'Organization',keys:\['departments','teams','businessAreas','initiatives','tenantDomain'\]\}/);
assert.match(settings,/id="settingsDataStage"/);
assert.match(settings,/id="settingsTenantDomain"/);
assert.match(settings,/id="settingsAddDepartment"/);
assert.match(settings,/AmoEditTransactions\?\.register\?\.\('settings'/);
assert.doesNotMatch(target,/saveTabbedDataStage|saveSettings\(/);
assert.doesNotMatch(tenant,/saveTenantDomain|saveSettings\(/);
assert.doesNotMatch(hierarchy,/saveStructure|Edit Structure|amoOrganizationStructureCard|saveSettings\(/);

// Hierarchy normalization preserves extension metadata rather than reducing rows to core fields.
assert.match(hierarchy,/\.\.\.cloneValue\(x\|\|\{\}\),id:clean\(x\?\.id\),name:clean\(x\?\.name\)/);
assert.match(hierarchy,/departmentId:clean\(x\?\.departmentId\)\|\|fallback/);

// Person mapping is staged in Users and only persisted from Save Users.
assert.match(users,/personLinks:\{\},personBaseline:\{\}/);
assert.match(users,/data-person-user/);
assert.match(users,/setPersonLink/);
assert.match(users,/await repo\.saveRecord\('team',next\)/);
assert.match(users,/confirmRelationshipChanges/);
assert.match(users,/rollbackRelationships/);
assert.match(users,/AmoEditTransactions\?\.register\?\.\('users'/);
assert.doesNotMatch(tenant,/decorateUsersTable|linkUserToPerson/);

// Navigation resolves the actual surface transaction through Save, Discard or Stay.
assert.match(transactions,/Save and leave/);
assert.match(transactions,/Discard changes/);
assert.match(transactions,/Stay here/);
assert.match(transactions,/const result=await entry\.contract\.save\(\)/);
assert.match(transactions,/if\(result===false\|\|entry\.contract\.isEditing\(\)\)return false/);
assert.match(transactions,/window\.addEventListener\('beforeunload'/);
assert.match(transactions,/register\('people-list'/);
assert.match(transactions,/register\('demand-list'/);
assert.match(transactions,/register\('allocations'/);
assert.match(transactions,/register\('ideas'/);
assert.match(transactions,/register\('record-modal'/);
assert.match(shell,/app-edit-transactions\.js/);

console.log('Edit transaction contract tests passed');
