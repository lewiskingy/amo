const fs=require('fs'),vm=require('vm'),assert=require('assert');
const commitment=fs.readFileSync('src/app-commitment-health.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const sticky=fs.readFileSync('src/app-list-page-sticky.js','utf8');
const allocationFilters=fs.readFileSync('src/app-allocation-filter-toolbar.js','utf8');

// Dashboard KPI drill-through must target visible operational filter state, never an arbitrary first record.
assert.match(commitment,/function setDemandNavigation\(control,extra=\{\}\)/);
assert.match(commitment,/kind==='missing-work-item-list'\)\{setDemandNavigation\('work-item-missing'\)/);
assert.doesNotMatch(commitment,/missingWorkItems\[0\]/,'Work Items Missing KPI must navigate to the population, not open the first Work Package');
assert.match(commitment,/kind==='no-project'\)\{setDemandNavigation\('funding-missing',\{project:'missing'\}\)/);
assert.match(commitment,/kind==='unmet-demand'\|\|kind==='no-allocation'/);
assert.match(commitment,/allocationFilters\.control='actuals-missing'/);

// Demand filtering is typed and visible; project null/present and Active/All are first-class values.
assert.match(commitment,/const demandFilters=\{scope:'active'/);
assert.match(commitment,/Has Project Number/);
assert.match(commitment,/No Project Number/);
assert.match(commitment,/option value="active"/);
assert.match(commitment,/option value="all"/);
assert.match(commitment,/data-demand-filter="control"/);
assert.match(commitment,/management-filter-chips/);
assert.match(commitment,/table\.querySelector\('thead \.filter-row'\)\?\.remove\(\)/,'Legacy per-column filter row should not compete with the management filter bar');

// The canonical Demand row query must consume the management predicate before rendering. This is the
// behavioural contract that prevents a redraw from showing the same unfiltered population.
assert.match(demandGrid,/function demandManagementMatch\(row\)/);
assert.match(demandGrid,/window\.CommitmentHealth\?\.matchesDemandQuery/);
assert.match(demandGrid,/name!=='demand'\|\|demandManagementMatch\(r\)/);
const rows=[
  {id:'DEM-1',title:'No project',projectNumber:''},
  {id:'DEM-2',title:'Has project',projectNumber:'2002'},
  {id:'DEM-3',title:'Also no project',projectNumber:''}
];
const coreContext={console,Set,Map,Object,Number,String,Date,Math,structuredClone,
  window:{CommitmentHealth:{matchesDemandQuery:d=>!!String(d.projectNumber||'').trim()},WorkPackages:{}},
  db:{demand:rows,team:[{id:'P-1',name:'One'}],settings:{businessAreas:[],initiatives:[],priorities:[],statuses:[],demandSizeDays:{},healthStates:[]}},
  gridState:{demand:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null},team:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null}},
  getPath:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj),person:()=>null,normalizeInitiatives:x=>x,initiativesForBusinessArea:()=>[],escHtml:x=>String(x)
};
vm.createContext(coreContext);vm.runInContext(demandGrid,coreContext);
assert.deepEqual(Array.from(coreContext.gridRows('demand'),d=>d.id),['DEM-2'],'Has Project Number predicate must reduce canonical Demand rows');
coreContext.window.CommitmentHealth.matchesDemandQuery=d=>!String(d.projectNumber||'').trim();
assert.deepEqual(Array.from(coreContext.gridRows('demand'),d=>d.id),['DEM-1','DEM-3'],'No Project Number predicate must reduce canonical Demand rows');
coreContext.window.CommitmentHealth.matchesDemandQuery=()=>false;
assert.deepEqual(Array.from(coreContext.gridRows('team'),p=>p.id),['P-1'],'Demand management filters must not affect People rows');

// Manual filter changes and Dashboard drill-through share one render path; stale retired column filters are cleared.
assert.match(commitment,/function clearLegacyDemandFilters\(\)/);
assert.match(commitment,/gridState\.demand\.filters=\{\}/);
assert.match(commitment,/function renderDemandView\(\)/);
assert.match(commitment,/renderDemandView\(\)/);

// Control Position is a derived Demand presentation, not another persisted field.
assert.match(commitment,/label:'Control Position'/);
assert.doesNotMatch(commitment,/saveSettings|requestAutosave|dirtyRecords/);
assert.match(commitment,/Funding missing','bad'/);
assert.match(commitment,/missing Work Item/);
assert.match(commitment,/allocation.*missing Actuals/);

// Recovery variance and Actuals completeness are distinct visual semantics.
assert.match(commitment,/function recoveryTone\(c\)/);
assert.match(commitment,/materialVariancePct/);
assert.match(commitment,/allocationRecoveryHtml/);
assert.match(commitment,/missingActuals\.length\?badge/);
assert.doesNotMatch(commitment,/badge\(recovery,c\.actualStatus==='missing'/,'Aggregate recovery pill must not turn red merely because one allocation is missing Actuals');

// Allocation search retains the issue #159 selection-on-commit interaction rather than rerendering every keystroke.
assert.match(allocationFilters,/Typing only narrows suggestions; selecting commits/);
assert.match(allocationFilters,/function commit\(input,value\)/);
assert.doesNotMatch(allocationFilters,/input\.addEventListener\('input',[^\n]*renderAllocations/);

// Issue #158: page owns vertical scrolling while a viewport-accessible horizontal scrollbar mirrors wide tables.
assert.match(sticky,/amo-floating-list-scrollbar/);
assert.match(sticky,/bottomWrap\.scrollLeft=bottomScroller\.scrollLeft/);
assert.match(sticky,/bottomScroller\.scrollLeft=wrap\.scrollLeft/);
assert.match(sticky,/overflowY='hidden'/);

console.log('Management filter and navigation tests passed.');
