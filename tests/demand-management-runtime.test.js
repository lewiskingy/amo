const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-demand-management-query.js','utf8');
const rows=[
  {id:'DEM-0001',title:'iPaaS',status:'In Progress',businessArea:'CTO (Technology)',initiative:'iPaaS',ownerId:'P-WP',projectNumber:'11702'},
  {id:'DEM-0009',title:'AOI CoE',status:'In Progress',businessArea:'GDO (Data & AI)',initiative:'AI CoE',ownerId:'P-CD',projectNumber:'11744'},
  {id:'DEM-0010',title:'Small Change',status:'In Progress',businessArea:'Ireland',initiative:'BPA (Bulk Purchase Annuities)',ownerId:'P-LK',projectNumber:''},
  {id:'DEM-0011',title:'Data Accelerators',status:'In Progress',businessArea:'GDO (Data & AI)',initiative:'Data Accelerators',ownerId:'P-LK',projectNumber:'11696'},
  {id:'DEM-0012',title:'Complete item',status:'Complete',businessArea:'Ireland',initiative:'BPA (Bulk Purchase Annuities)',ownerId:'P-LK',projectNumber:''}
];
const filters={scope:'active',businessArea:'Ireland',initiative:'BPA (Bulk Purchase Annuities)',owner:'P-LK',project:'missing',control:'',search:'0010'};
const context={console,Set,Map,Object,Number,String,Date,Math,
  window:{CommitmentHealth:{demandFilters:filters,matchesDemandQuery:()=>true},DefinedDemandModel:{isOpen:d=>!['Complete','Cancelled'].includes(d.status)}},
  gridRows:name=>name==='demand'?rows:[{id:'P-LK'}],setInterval,clearInterval
};
context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context);
assert.ok(context.window.AmoDemandManagementQuery,'runtime Demand management query API must load');
assert.deepEqual(Array.from(context.gridRows('demand'),d=>d.id),['DEM-0010'],'combined parent Demand filters must reduce the runtime row population');
filters.search='0009';assert.deepEqual(Array.from(context.gridRows('demand'),d=>d.id),[],'search must compose with Business Area, Initiative, Owner and Project filters rather than merely redraw');
filters.search='';filters.businessArea='';filters.initiative='';filters.owner='';filters.project='';assert.deepEqual(Array.from(context.gridRows('demand'),d=>d.id),['DEM-0001','DEM-0009','DEM-0010','DEM-0011'],'Active must exclude terminal Demand in the runtime composition');
filters.scope='all';assert.equal(context.gridRows('demand').length,5,'Show All must restore terminal Demand');
assert.deepEqual(Array.from(context.gridRows('team'),p=>p.id),['P-LK'],'Demand management query must not affect other grids');
console.log('Demand management runtime query tests passed.');
