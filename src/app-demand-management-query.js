/* Canonical runtime query projection for the Demand Register management filters.
   This module owns the final parent-Demand query composition at runtime. It deliberately filters
   the row population before rendering; it never hides rendered DOM rows. */
(function initDemandManagementQuery(){
  if(window.AmoDemandManagementQuery)return;

  const clean=v=>String(v??'').trim();

  function matches(row){
    const ch=window.CommitmentHealth,filters=ch?.demandFilters;
    if(!filters)return true;
    if(filters.scope==='active'&&!(window.DefinedDemandModel?.isOpen?.(row)??true))return false;
    if(filters.businessArea&&clean(row?.businessArea)!==clean(filters.businessArea))return false;
    if(filters.initiative&&clean(row?.initiative)!==clean(filters.initiative))return false;
    if(filters.owner&&clean(row?.ownerId)!==clean(filters.owner))return false;
    if(filters.project==='present'&&!clean(row?.projectNumber))return false;
    if(filters.project==='missing'&&clean(row?.projectNumber))return false;
    const q=clean(filters.search).toLowerCase();
    if(q&&!`${row?.id||''} ${row?.title||''} ${row?.projectNumber||''}`.toLowerCase().includes(q))return false;
    if(filters.control){
      const predicate=ch?.matchesDemandQuery;
      if(typeof predicate==='function'&&!predicate(row))return false;
    }
    return true
  }

  function install(){
    if(window.__amoDemandManagementQueryInstalled)return true;
    if(typeof gridRows!=='function'||!window.CommitmentHealth)return false;
    const baseRows=gridRows;
    gridRows=function(name){
      const rows=baseRows.apply(this,arguments);
      return name==='demand'?rows.filter(matches):rows
    };
    window.gridRows=gridRows;
    window.__amoDemandManagementQueryInstalled=true;
    return true
  }

  function installWhenReady(){
    if(install())return;
    let tries=0;
    const timer=setInterval(()=>{if(install()||++tries>=250)clearInterval(timer)},20)
  }

  window.AmoDemandManagementQuery={matches,install};
  installWhenReady()
})();
