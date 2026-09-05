const fs=require('fs'),path=require('path'),assert=require('assert');
const app1=fs.readFileSync('src/app-1.js','utf8');
const app2=fs.readFileSync('src/app-2.js','utf8');
const modal=fs.readFileSync('src/app-record-modal.js','utf8');
const model=fs.readFileSync('src/app-demand-model.js','utf8');
const config=fs.readFileSync('src/app-config.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');
const roadmap=fs.readFileSync('src/app-roadmap.js','utf8');
const reporting=fs.readFileSync('src/app-defined-demand-reporting.js','utf8');
const integrations=fs.readFileSync('src/app-integrations.js','utf8');
const compat=fs.readFileSync('src/app-defined-demand-ui.js','utf8');
const scopeClarity=fs.readFileSync('src/app-team-scope-clarity.js','utf8');
const schema=JSON.parse(fs.readFileSync('data/sample/config/schema.json','utf8'));
const targetStage=fs.readFileSync('src/app-target-stage.js','utf8');
const serverRepo=fs.readFileSync('server/repository.js','utf8');
const index=fs.readFileSync('src/index.html','utf8');

// Workspace and application versioning.
assert.match(app1,/CURRENT_SCHEMA_VERSION=3/);
assert.equal(schema.schemaVersion,3);
assert.match(serverRepo,/schemaVersion:3/);
assert.match(targetStage,/const APP_VERSION='1\.2\.1'/);

// Defined Demand is deliberately lightweight at creation.
assert.match(modal,/Title and Business Area are mandatory at creation/);
assert.match(modal,/modalField\('Title','title'.*true\)/);
assert.match(modal,/modalField\('Business Area','businessArea'.*true\)/);
assert.match(modal,/modalField\('Owning Team','teamId'/);
assert.match(modal,/Unassigned/);
assert.match(modal,/modalField\('Initial Size','initialEstimate\.size'/);
assert.match(modal,/modalField\('Initial ROM \(days\)','initialEstimate\.estimatedDays'/);
assert.match(modal,/modalField\('Summary \/ Context','context'/);
assert.match(modal,/modalField\('Architecture Owner','ownerId'/);
assert.doesNotMatch(modal,/modalField\('Service','service'/);
assert.doesNotMatch(modal,/modalField\('ROM Days','triage\.romDays'/);
assert.doesNotMatch(modal,/modalField\('Start','workPackage\.targetStart'/);
assert.doesNotMatch(modal,/modalField\('End','workPackage\.targetEnd'/);
assert.doesNotMatch(modal,/modalField\('Scope','workPackage\.scope'/);

// Demand list remains portfolio-oriented but may surface derived Work Package roll-ups.
assert.match(app2,/key:'initialEstimate\.size',label:'Initial Size'/);
assert.match(app2,/key:'ownerId',label:'Owner'/);
assert.match(app2,/key:'_wpEstimate',label:'WP Estimate'/);
assert.doesNotMatch(app2,/key:'service'/);
assert.doesNotMatch(app2,/triage\.romDays|workPackage\.targetStart|workPackage\.targetEnd/);
assert.doesNotMatch(integrations,/triage\.romDays|workPackage\.targetStart|workPackage\.targetEnd|workPackage\.architectureOwner/);

// Service, delivery status, dates and refined estimates are Work Package concerns.
assert.match(workPackages,/service:trim\(record\?\.service\)/);
assert.match(workPackages,/estimatedEffortDays:/);
assert.match(workPackages,/Estimated Effort \(days\)/);
assert.match(workPackages,/Work Package Service is required/);
assert.match(workPackages,/workPackageStatuses/);
assert.doesNotMatch(workPackages,/ROM Days/);
assert.match(config,/Work Package Services/);
assert.match(config,/Work Package Statuses/);
assert.match(config,/Initial Demand Sizing/);
assert.match(config,/demandSizeDays/);

// Roadmap must not operationalise retired Demand dates.
assert.match(roadmap,/summaryForDemand/);
assert.doesNotMatch(roadmap,/legacyDeliveryWindow|Legacy Demand dates/);

// Status Reporting no longer depends on Demand.service; Work Package services are immutable derived context.
assert.match(reporting,/servicesForDemand/);
assert.match(reporting,/entry\.services=\[\.\.\.services\]/);
assert.match(reporting,/entry\.service=services\.join/);
assert.match(reporting,/removeObsoleteDemandServiceColumn/);
assert.match(index,/app-defined-demand-reporting\.js\?v=20260905-1/);

// Compatibility layers no longer duplicate Demand modal/list persistence.
assert.match(compat,/compatibility bridge/i);
assert.doesNotMatch(compat,/function validateDemand|function saveDemandGrid|renderDemandModal=function\(r\)\{/);
assert.doesNotMatch(scopeClarity,/saveDefinedDemandGrid|Demand list persistence is owned here/);

// Sample Demand uses only the current model; no old delivery fields remain operational.
for(const file of fs.readdirSync('data/sample/demand').filter(name=>name.endsWith('.json'))){
  const d=JSON.parse(fs.readFileSync(path.join('data/sample/demand',file),'utf8'));
  assert.equal(d.demandModelVersion,2,`${file} is not model v2`);
  for(const field of ['service','triage','workPackage','deliverables','costCentreOrProjectCode'])assert.equal(Object.prototype.hasOwnProperty.call(d,field),false,`${file} still has legacy ${field}`);
  assert(['Assessing','Defined','Planned','In Progress','On Hold','Complete','Cancelled'].includes(d.status),`${file} has non-canonical Demand State ${d.status}`);
}

// Allocation / Actuals boundaries remain unchanged by Step 4.
assert.equal(schema.recordTypes.allocation.semantics,'Allocation remains Person × Defined Demand × Month; Step 4 does not move resource planning to Work Package.');
assert.match(schema.reportingInvariants.actuals,/Demand\.projectNumber/);
assert.match(schema.reportingInvariants.workPackageActuals,/No Work Package Actuals/);

console.log('Defined Demand cross-view contract tests passed');
