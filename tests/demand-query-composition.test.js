const fs=require('fs'),vm=require('vm'),assert=require('assert');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const compatibility=fs.readFileSync('src/app-defined-demand-ui.js','utf8');
const department=fs.readFileSync('src/app-department.js','utf8');

assert.match(demandGrid,/function recordInOrganizationalScope\(name,row\)/);
assert.match(demandGrid,/recordInOrganizationalScope\(name,r\)/);
assert.match(demandGrid,/window\.AmoCanonicalGridRows=gridRows/);
assert.match(compatibility,/gridRows=window\.AmoCanonicalGridRows/,'Defined Demand compatibility must retire the Department-era gridRows wrapper');
assert.match(department,/const deptGridRows=gridRows;gridRows=function/,'Legacy wrapper remains identifiable until app-department is retired');

const rows=[
 {id:'DEM-1',title:'Matching',status:'In Progress',teamId:'TEAM-A',businessArea:'Finance',initiative:'BPA',ownerId:'P-1',projectNumber:''},
 {id:'DEM-2',title:'Wrong owner',status:'In Progress',teamId:'TEAM-A',businessArea:'Finance',initiative:'BPA',ownerId:'P-2',projectNumber:''},
 {id:'DEM-3',title:'Wrong team',status:'In Progress',teamId:'TEAM-B',businessArea:'Finance',initiative:'BPA',ownerId:'P-1',projectNumber:''},
 {id:'DEM-4',title:'Wrong BA',status:'In Progress',teamId:'TEAM-A',businessArea:'Technology',initiative:'BPA',ownerId:'P-1',projectNumber:''}
];
const filters={scope:'active',businessArea:'Finance',initiative:'BPA',owner:'P-1',project:'missing',control:'',search:''};
const context={console,Set,Map,Object,Number,String,Date,Math,structuredClone,
 window:{CommitmentHealth:{demandFilters:filters},DefinedDemandModel:{isOpen:()=>true},WorkPackages:{}},
 db:{demand:rows,team:[],settings:{businessAreas:[],initiatives:[],priorities:[],statuses:[],demandSizeDays:{},healthStates:[]}},
 gridState:{demand:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null},team:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null}},
 demandInScope:d=>d.teamId==='TEAM-A',personInScope:()=>true,
 getPath:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj),person:id=>({name:id}),normalizeInitiatives:x=>x,initiativesForBusinessArea:()=>[],escHtml:x=>String(x)
};
context.window.window=context.window;
vm.createContext(context);vm.runInContext(demandGrid,context);
assert.deepEqual(Array.from(context.gridRows('demand'),d=>d.id),['DEM-1'],'Canonical Demand query must compose organisational scope and management filters in one pass');
console.log('Demand query composition tests passed');
