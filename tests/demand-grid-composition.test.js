const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/app-demand-grid-composition.js','utf8');
const calls=[];
const table={id:'demandTable'};
const context={console,Map,Set,
  window:{AmoDemandGridPending:[]},
  gridState:{demand:{editing:false}},
  gridRows:name=>name==='demand'?[{id:'DEM-1'}]:[{id:'P-1'}],
  document:{getElementById:id=>id==='demandTable'?table:null},
  renderGrid:function(name){calls.push(`core:${name}`);return `rendered:${name}`}
};
context.window.window=context.window;
context.window.AmoDemandGridPending.push({id:'pending',priority:15,afterRender:ctx=>calls.push(`pending:${ctx.rows.length}`)});
vm.createContext(context);vm.runInContext(code,context);
const grid=context.window.AmoDemandGrid;
assert.ok(grid,'Demand grid composition API must load');
const original=grid.coreRenderGrid;
grid.register({id:'source',priority:10,beforeRender:()=>{calls.push('before:source');return()=>calls.push('cleanup:source')},afterRender:ctx=>calls.push(`after:source:${ctx.table.id}`)});
grid.register({id:'commitment',priority:20,afterRender:()=>calls.push('after:commitment')});
grid.register({id:'arrangement',priority:30,afterRender:()=>calls.push('after:arrangement')});
assert.equal(context.renderGrid('demand'),'rendered:demand');
assert.deepEqual(calls,[
  'before:source','core:demand','after:source:demandTable','pending:1','after:commitment','after:arrangement','cleanup:source'
],'Demand render contributions must run around exactly one canonical render in priority order');
calls.length=0;
assert.equal(context.renderGrid('team'),'rendered:team');
assert.deepEqual(calls,['core:team'],'non-Demand grids must bypass Demand composition');
assert.equal(grid.coreRenderGrid,original,'canonical renderer reference must remain stable');
console.log('Demand grid composition tests passed.');
