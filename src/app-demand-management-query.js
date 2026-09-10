/* Single runtime composition point for the Demand Register renderer.
   app-2.js remains the canonical renderer. Feature modules register before/after render contributions
   here instead of replacing renderGrid and capturing competing renderer versions. */
(function initDemandGridComposition(){
  if(window.AmoDemandGrid)return;
  if(typeof renderGrid!=='function')return;

  const coreRenderGrid=renderGrid;
  const contributions=new Map();
  const pending=window.AmoDemandGridPending=window.AmoDemandGridPending||[];

  function ordered(kind){return[...contributions.values()].filter(x=>typeof x[kind]==='function').sort((a,b)=>(a.priority||0)-(b.priority||0))}
  function register(contribution){
    if(!contribution?.id)throw new Error('Demand grid contribution requires an id.');
    contributions.set(contribution.id,contribution);
    return contribution
  }
  function unregister(id){contributions.delete(id)}
  function runBefore(context){
    for(const c of ordered('beforeRender')){
      const cleanup=c.beforeRender(context);
      if(typeof cleanup==='function')context.cleanups.push(cleanup)
    }
  }
  function runAfter(context){for(const c of ordered('afterRender'))c.afterRender(context)}

  function composedRenderGrid(name){
    if(name!=='demand')return coreRenderGrid.apply(this,arguments);
    const context={name,cleanups:[],table:null,rows:[],editing:typeof gridState!=='undefined'&&!!gridState.demand?.editing};
    runBefore(context);
    try{
      const result=coreRenderGrid.apply(this,arguments);
      context.table=document.getElementById('demandTable');
      context.rows=typeof gridRows==='function'?gridRows('demand'):[];
      runAfter(context);
      return result
    }finally{
      for(const cleanup of context.cleanups.reverse())cleanup()
    }
  }

  renderGrid=composedRenderGrid;
  window.renderGrid=composedRenderGrid;
  window.AmoDemandGrid={register,unregister,contributions,coreRenderGrid,render:composedRenderGrid};
  // Compatibility alias retained while older tests/callers still refer to the #179 module name.
  window.AmoDemandManagementQuery=window.AmoDemandGrid;
  while(pending.length)register(pending.shift());
})();
