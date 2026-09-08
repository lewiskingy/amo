/* Resource-planning compatibility entrypoint.
   Canonical allocation UI and persistence live in app-work-package-resource-planning.js.
   Keep only shared helpers plus one deterministic loader. */
function allocationFor(memberId,month){return db.allocations.filter(a=>a.teamMemberId===memberId).reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)}
function teamCapacity(){return db.team.filter(t=>t.active!==false).reduce((n,t)=>n+(Number(t.fte)||0),0)}
function allocatedTotal(month){return db.allocations.reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)}
function unresolvedWithoutAllocation(){return db.demand.filter(isOpenDemand).filter(d=>!db.allocations.some(a=>a.demandId===d.id&&a.teamMemberId))}

/* Load exactly one canonical implementation. Dynamic assets use the same deployment build identity
   as the application shell so a release cannot combine a new shell with cached resource-planning assets. */
(function loadWorkPackageResourcePlanning(){
  const build=String(window.AMO_ASSET_VERSION||window.AMO_CONFIG?.buildId||'').trim();
  if(!document.querySelector('link[data-amo-work-package-resource-planning]')){
    const style=document.createElement('link');style.rel='stylesheet';
    style.href=build?`app-work-package-resource-planning.css?v=${encodeURIComponent(build)}`:'app-work-package-resource-planning.css';
    style.dataset.amoWorkPackageResourcePlanning='true';
    document.head.appendChild(style)
  }
  if(window.WorkPackageResourcePlanning){if(typeof renderAllocations==='function')renderAllocations();return}
  if(window.__amoWorkPackageResourcePlanningLoading)return;
  window.__amoWorkPackageResourcePlanningLoading=true;
  const script=document.createElement('script');
  script.src=build?`app-work-package-resource-planning.js?v=${encodeURIComponent(build)}`:'app-work-package-resource-planning.js';
  script.dataset.amoWorkPackageResourcePlanning='true';
  script.async=false;
  script.onload=()=>{
    window.__amoWorkPackageResourcePlanningLoading=false;
    if(!window.WorkPackageResourcePlanning){console.error('Work Package resource planning module loaded without registering its API.');return}
    /* The canonical module replaces this compatibility function when it evaluates. */
    if(typeof renderAllocations==='function')renderAllocations()
  };
  script.onerror=()=>{
    window.__amoWorkPackageResourcePlanningLoading=false;
    console.error(`Could not load canonical Work Package resource planning UI from ${script.src}`)
  };
  document.head.appendChild(script)
})();

/* Load-safe stubs prevent early refresh calls from failing before the canonical module arrives. */
function renderAllocations(){}
function saveAllocations(){}
