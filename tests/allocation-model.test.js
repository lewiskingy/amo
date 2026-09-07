const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-allocation-model.js','utf8');
const context={window:{},structuredClone};vm.createContext(context);vm.runInContext(code,context);
const model=context.window.AllocationModel;

assert(model,'AllocationModel should load');
assert.equal(model.MODEL_VERSION,1);

const demand=[{id:'DEM-1'},{id:'DEM-2'}];
const team=[{id:'USR-1'},{id:'USR-2'}];
const workPackages=[
  {id:'WP-1',demandId:'DEM-1',title:'Discovery'},
  {id:'WP-2',demandId:'DEM-1',title:'Integration'},
  {id:'WP-3',demandId:'DEM-2',title:'Other'}
];
const allocations=[
  {id:'A-LEG',demandId:'DEM-1',teamMemberId:'USR-1',forecast:{'2026-09-01':.2}},
  {id:'A-1',demandId:'DEM-1',workPackageId:'WP-1',teamMemberId:'USR-1',forecast:{'2026-09-01':.3,'2026-10-01':.4}},
  {id:'A-2',demandId:'DEM-1',workPackageId:'WP-2',teamMemberId:'USR-2',forecast:{'2026-09':.25}},
  {id:'A-3',demandId:'DEM-2',workPackageId:'WP-3',teamMemberId:'USR-2',forecast:{'2026-09-01':.5}}
];

assert.equal(model.isLegacyUndecomposed(allocations[0]),true);
assert.equal(model.isLegacyUndecomposed(allocations[1]),false);
assert.equal(model.allocationsForDemand('DEM-1',allocations).length,3);
assert.equal(model.allocationsForWorkPackage('WP-1',allocations).length,1);
assert.equal(model.legacyAllocationsForDemand('DEM-1',allocations).length,1);
assert.equal(model.plannedAllocationsForDemand('DEM-1',allocations).length,2);
assert.equal(model.workPackageFraction('WP-1','2026-09',allocations),.3);
assert.equal(model.demandFraction('DEM-1','2026-09',allocations),.75,'Demand roll-up includes WP plan plus legacy undecomposed allocation during transition');

const breakdown=model.demandBreakdown('DEM-1','2026-09',{allocations,workPackages});
assert.equal(breakdown.totalFraction,.75);
assert.equal(breakdown.workPackageFraction,.55);
assert.equal(breakdown.legacyUndecomposedFraction,.2);
assert.equal(breakdown.legacyUndecomposedCount,1);
assert.equal(breakdown.workPackages.length,2);
assert.equal(breakdown.workPackages.find(x=>x.workPackageId==='WP-1').fraction,.3);
assert.equal(breakdown.workPackages.find(x=>x.workPackageId==='WP-2').fraction,.25);

const valid=model.validate(allocations[1],{demand,team,workPackages});
assert.equal(valid.valid,true);assert.equal(valid.legacyUndecomposed,false);assert.equal(valid.errors.length,0);

const legacy=model.validate(allocations[0],{demand,team,workPackages});
assert.equal(legacy.valid,true);assert.equal(legacy.legacyUndecomposed,true);assert.equal(legacy.warnings.length,1);
const noLegacy=model.validate(allocations[0],{demand,team,workPackages,allowLegacy:false});
assert.equal(noLegacy.valid,false);assert.match(noLegacy.errors[0],/Work Package/);

const wrongParent=model.validate({demandId:'DEM-1',workPackageId:'WP-3',teamMemberId:'USR-1',forecast:{}},{demand,team,workPackages});
assert.equal(wrongParent.valid,false);assert.match(wrongParent.errors.join(' '),/belong/);

const missingWp=model.validate({demandId:'DEM-1',workPackageId:'WP-X',teamMemberId:'USR-1',forecast:{}},{demand,team,workPackages});
assert.equal(missingWp.valid,false);assert.match(missingWp.errors.join(' '),/existing Work Package/);

const summary=model.legacySummary(allocations);
assert.equal(summary.count,1);assert.equal(summary.demandCount,1);assert.deepEqual(Array.from(summary.demandIds),['DEM-1']);

console.log('Allocation model tests passed');
require('./work-package-resource-planning.test.js');
