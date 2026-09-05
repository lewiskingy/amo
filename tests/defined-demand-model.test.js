const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-demand-model.js','utf8');
const context={window:{},structuredClone};vm.createContext(context);vm.runInContext(code,context);
const model=context.window.DefinedDemandModel;

assert(model,'DefinedDemandModel should load');
assert.deepEqual(Array.from(model.DEMAND_STATES),['Assessing','Defined','Planned','In Progress','On Hold','Complete','Cancelled']);
assert.deepEqual({...model.DEFAULT_SIZE_DAYS},{XS:2,S:5,M:10,L:20,XL:40});
assert.equal(model.canonicalState('Triage'),'Assessing');
assert.equal(model.canonicalState('Ready / Committed'),'Planned');
assert.equal(model.canonicalState('Governance'),'In Progress');
assert.equal(model.canonicalState('Closed'),'Complete');

const settings={
  schemaVersion:2,
  statuses:['Triage','Analysis / Design','Complete'],
  services:['Triage','Consultancy','Design'],
  serviceWorkflows:{Triage:['Triage']},
  demandSizeDays:{XS:1,S:4,M:9,L:18,XL:36}
};
const demand=[{
  id:'DEM-1',title:'Legacy demand',businessArea:'Customer',status:'Analysis / Design',priority:'High',service:'Design',
  costCentreOrProjectCode:'CC-123',projectNumber:'',health:'Amber',
  source:{type:'SharePoint',id:'FD-1',url:'https://example.test/1'},
  triage:{complexity:'Large',romDays:22,summary:'Initial architecture request.'},
  workPackage:{architectureOwner:'USR-1',objective:'Define target architecture.',scope:'Identity and integration.',outOfScope:'Implementation.',targetStart:'2026-10-01',targetEnd:'2026-12-31'},
  deliverables:[{id:'DEL-1',type:'HLD'}]
}];
const result=model.migrateWorkspace(settings,demand),d=demand[0];
assert.equal(result.changed,true);
assert.deepEqual(Array.from(settings.statuses),['Assessing','Defined','Planned','In Progress','On Hold','Complete','Cancelled']);
assert.deepEqual(Array.from(settings.services),['Consultancy','Design']);
assert.deepEqual(Array.from(settings.workPackageStatuses),['Planned','Ready','In Progress','Blocked','Complete','Cancelled']);
assert.equal(settings.serviceWorkflows,undefined);
assert.equal(d.status,'In Progress');
assert.equal(d.ownerId,'USR-1');
assert.equal(d.initialEstimate.size,'L');
assert.equal(d.initialEstimate.estimatedDays,22,'Legacy ROM days are preserved as the initial estimate snapshot');
assert.match(d.context,/Initial architecture request/);
assert.match(d.context,/Define target architecture/);
assert.match(d.context,/Identity and integration/);
assert.equal(d.service,undefined);
assert.equal(d.triage,undefined);
assert.equal(d.workPackage,undefined);
assert.equal(d.deliverables,undefined);
assert.equal(d.projectNumber,'','Cost Centre / Project Code must never be promoted to Project Number');
assert.equal(d.costCentreOrProjectCode,'CC-123','Unrelated legacy identifiers are not silently reinterpreted by the domain normalizer');
assert.equal(d.legacy.service,'Design');
assert.equal(d.legacy.triage.romDays,22);
assert.equal(d.legacy.demandWorkPackage.targetStart,'2026-10-01');
assert.equal(d.legacy.deliverables[0].id,'DEL-1');

const clean=model.cleanForSave({...d,costCentreOrProjectCode:undefined},settings);
assert.equal(clean.service,undefined);
assert.equal(clean.workPackage,undefined);
assert.equal(model.isOpen(clean),true);
assert.equal(model.isOpen({status:'Complete'}),false);

const fresh={id:'DEM-2',title:'New',businessArea:'Group',status:'Assessing',initialEstimate:{size:'M',estimatedDays:9}};
model.normalizeDemand(fresh,settings);
assert.equal(fresh.initialEstimate.size,'M');
assert.equal(fresh.initialEstimate.estimatedDays,9);
assert.equal(fresh.context,'');
assert.equal(fresh.ownerId,null);

console.log('Defined Demand model tests passed');
