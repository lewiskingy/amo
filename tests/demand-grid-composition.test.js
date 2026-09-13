const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-demand-grid-composition.js','utf8');
const demandGrid=fs.readFileSync('src/app-2.js','utf8');
const calls=[];
const table={id:'demandTable'};
const context={console,Map,Set,
  window:{AmoDemandGridPending:[],AmoCanonicalGridRows:name=>name==='demand'?[{id:'DEM-1'}]:[{id:'P-1'}]},
  gridState:{demand:{editing:false}},
  // Deliberately conflicting legacy query. Demand composition must not consume it.
  gridRows:name=>name==='demand'?[{id:'LEGACY-1'},{id:'LEGACY-2'}]:[{id:'P-1'}],
  document:{getElementById:id=>id==='demandTable'?table:null},
  renderGrid:function(name){calls.push(`core:${name}`);return `rendered:${name}`}
};
context.window.window=context.window;
context.window.AmoDemandGridPending.push({id:'pending',priority:15,afterRender:ctx=>calls.push(`pending:${ctx.rows.length}:${ctx.rows[0]?.id||''}`)});
vm.createContext(context);vm.runInContext(code,context);
const grid=context.window.AmoDemandGrid;
assert.ok(grid,'Demand grid composition API must load');
const original=grid.coreRenderGrid;
grid.register({id:'source',priority:10,beforeRender:()=>{calls.push('before:source');return()=>calls.push('cleanup:source')},afterRender:ctx=>calls.push(`after:source:${ctx.table.id}`)});
grid.register({id:'commitment',priority:20,afterRender:()=>calls.push('after:commitment')});
grid.register({id:'arrangement',priority:30,afterRender:()=>calls.push('after:arrangement')});
assert.equal(context.renderGrid('demand'),'rendered:demand');
assert.deepEqual(calls,[
  'before:source','core:demand','after:source:demandTable','pending:1:DEM-1','after:commitment','after:arrangement','cleanup:source'
],'Demand render contributions must run around exactly one canonical render and consume canonical row results');
calls.length=0;
assert.equal(context.renderGrid('team'),'rendered:team');
assert.deepEqual(calls,['core:team'],'non-Demand grids must bypass Demand composition');
assert.equal(grid.coreRenderGrid,original,'canonical renderer reference must remain stable');

// The renderer itself must use a lexical canonical query, so a later global gridRows override cannot
// replace the row population that app-2.js renders.
assert.match(demandGrid,/function canonicalGridRows\(name\)/);
assert.match(demandGrid,/function gridRows\(name\)\{return canonicalGridRows\(name\)\}/);
assert.match(demandGrid,/window\.AmoCanonicalGridRows=canonicalGridRows/);
assert.match(demandGrid,/function renderGrid\(name\)\{[^\n]*rows=canonicalGridRows\(name\)/);
assert.doesNotMatch(code,/context\.rows=typeof gridRows/,'Demand composition must not consume an overrideable global gridRows reference');
assert.match(code,/window\.AmoCanonicalGridRows\('demand'\)/);

console.log('Demand grid composition tests passed.');
