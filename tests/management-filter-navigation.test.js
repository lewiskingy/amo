const fs=require('fs'),vm=require('vm'),assert=require('assert');
const commitment=fs.readFileSync('src/app-commitment-health.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const sticky=fs.readFileSync('src/app-list-page-sticky.js','utf8');
const allocationFilters=fs.readFileSync('src/app-allocation-filter-toolbar.js','utf8');
const workPackages=fs.readFileSync('src/app-work-packages.js','utf8');

// Dashboard KPI drill-through must target visible operational filter state, never an arbitrary first record.
assert.match(commitment,/function setDemandNavigation\(control,extra=\{\}\)/);
assert.match(commitment,/kind==='missing-work-item-list'\)\{setDemandNavigation\('work-item-missing'\)/);
assert.doesNotMatch(commitment,/missingWorkItems\[0\]/,'Work Items Missing KPI must navigate to the population, not open the first Work Package');
assert.match(commitment,/kind==='no-project'\)\{setDemandNavigation\('funding-missing',\{project:'missing'\}\)/);
assert.match(commitment,/kind==='unmet-demand'\|\|kind==='no-allocation'/);
assert.match(commitment,/allocationFilters\.control='actuals-missing'/);

// Demand filtering is typed and visible; project null/present and Active/All are first-class values.
// The user-facing label is Show, reserving organisational scope for Department / Team page context.
assert.match(commitment,/const demandFilters=\{scope:'active'/);
assert.match(commitment,/<label>Show<select data-demand-filter="scope">/);
assert.doesNotMatch(commitment,/<label>Scope<select data-demand-filter="scope">/);
assert.match(commitment,/Has Project Number/);
assert.match(commitment,/No Project Number/);
assert.match(commitment,/option value="active"/);
assert.match(commitment,/option value="all"/);
assert.match(commitment,/data-demand-filter="control"/);
assert.match(commitment,/management-filter-chips/);
assert.match(commitment,/Show: All/);
assert.match(commitment,/table\.querySelector\('thead \.filter-row'\)\?\.remove\(\)/,'Legacy per-column filter row should not compete with the management filter bar');

// The canonical Demand row query consumes the exported management filter state directly for
// parent-Demand fields. Derived Control remains delegated to Commitment Health semantics.
assert.match(demandGrid,/function demandManagementMatch\(row\)/);
assert.match(demandGrid,/const ch=window\.CommitmentHealth,filters=ch\?\.demandFilters/);
assert.match(demandGrid,/filters\.businessArea/);
assert.match(demandGrid,/filters\.initiative/);
assert.match(demandGrid,/filters\.owner/);
assert.match(demandGrid,/filters\.project==='missing'/);
assert.match(demandGrid,/filters\.control/);
assert.match(demandGrid,/name!=='demand'\|\|demandManagementMatch\(r\)/);
assert.doesNotMatch(commitment,/const baseRows=gridRows/,'Commitment Health must not re-wrap the canonical Demand row query');

const rows=[
  {id:'DEM-1',title:'No project',status:'In Progress',projectNumber:'',businessArea:'Pensions',initiative:'Modernise',ownerId:'P-1'},
  {id:'DEM-2',title:'Has project',status:'Planned',projectNumber:'2002',businessArea:'Protection',initiative:'Growth',ownerId:'P-2'},
  {id:'DEM-3',title:'Done no project',status:'Complete',projectNumber:'',businessArea:'Pensions',initiative:'Modernise',ownerId:'P-1'}
];
const demandFilters={scope:'active',businessArea:'',initiative:'',owner:'',project:'',control:'',search:''};
const coreContext={console,Set,Map,Object,Number,String,Date,Math,structuredClone,
  window:{CommitmentHealth:{demandFilters,matchesDemandQuery:d=>d.id==='DEM-2'},DefinedDemandModel:{isOpen:d=>!['Complete','Cancelled'].includes(d.status)},WorkPackages:{}},
  db:{demand:rows,team:[{id:'P-1',name:'One'},{id:'P-2',name:'Two'}],settings:{businessAreas:[],initiatives:[],priorities:[],statuses:[],demandSizeDays:{},healthStates:[]}},
  gridState:{demand:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null},team:{editing:false,draft:null,deleted:new Set(),filters:{},sort:null,direction:null}},
  getPath:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj),person:id=>({name:id}),normalizeInitiatives:x=>x,initiativesForBusinessArea:()=>[],escHtml:x=>String(x)
};
vm.createContext(coreContext);vm.runInContext(demandGrid,coreContext);
const ids=()=>Array.from(coreContext.gridRows('demand'),d=>d.id);
assert.deepEqual(ids(),['DEM-1','DEM-2'],'Active must exclude terminal parent Demand');
demandFilters.businessArea='Protection';assert.deepEqual(ids(),['DEM-2'],'Business Area must reduce canonical parent rows');demandFilters.businessArea='';
demandFilters.initiative='Modernise';assert.deepEqual(ids(),['DEM-1'],'Initiative must reduce canonical parent rows and retain Active semantics');demandFilters.initiative='';
demandFilters.owner='P-2';assert.deepEqual(ids(),['DEM-2'],'Owner must reduce canonical parent rows');demandFilters.owner='';
demandFilters.project='missing';assert.deepEqual(ids(),['DEM-1'],'No Project Number must exclude rows with Project Number');demandFilters.project='present';assert.deepEqual(ids(),['DEM-2'],'Has Project Number must exclude rows without Project Number');demandFilters.project='';
demandFilters.search='Has project';assert.deepEqual(ids(),['DEM-2'],'Search must reduce canonical parent rows');demandFilters.search='';
demandFilters.scope='all';assert.deepEqual(ids(),['DEM-1','DEM-2','DEM-3'],'Show All must include terminal parent Demand');demandFilters.scope='active';
demandFilters.control='funding-missing';assert.deepEqual(ids(),['DEM-2'],'Derived Control must remain delegated to Commitment Health');demandFilters.control='';
assert.deepEqual(Array.from(coreContext.gridRows('team'),p=>p.id),['P-1','P-2'],'Demand management filters must not affect People rows');

// Active / All applies consistently across the nested Demand hierarchy. Work Package filtering is
// owned by the canonical Work Package renderer rather than a post-render DOM hider.
assert.match(workPackages,/const isTerminalStatus=status=>\['Complete','Cancelled'\]\.includes\(trim\(status\)\)/);
assert.match(workPackages,/function visibleForDemand\(demandId,\{show='active',control=''\}=\{\}\)/);
assert.match(workPackages,/if\(show!=='all'\)rows=rows\.filter\(w=>!isTerminalStatus\(w\.status\)\)/);
assert.match(workPackages,/visibleForDemand\(demand\.id,\{show:filters\.scope\|\|'active',control:filters\.control\|\|''\}\)/);
assert.match(workPackages,/control==='work-item-missing'/,'Work Item control drill-through should narrow nested children to the offending Work Packages');
assert.doesNotMatch(commitment,/applyDemandDomFilter/,'Demand filtering must not depend on post-render DOM hiding');
assert.match(commitment,/replace\(\/records\?\/i,'Demand'\)/,'Demand count should identify the parent entity rather than generic records');

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
