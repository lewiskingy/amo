/* Resource-planning compatibility entrypoint.
   Canonical allocation UI and persistence now live in app-work-package-resource-planning.js.
   Keep only shared legacy helpers used by older reporting/view modules while the new module loads. */
function allocationFor(memberId,month){return db.allocations.filter(a=>a.teamMemberId===memberId).reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)}
function teamCapacity(){return db.team.filter(t=>t.active!==false).reduce((n,t)=>n+(Number(t.fte)||0),0)}
function allocatedTotal(month){return db.allocations.reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)}
function unresolvedWithoutAllocation(){return db.demand.filter(isOpenDemand).filter(d=>!db.allocations.some(a=>a.demandId===d.id&&a.teamMemberId))}

/* Load the canonical implementation after the core workspace/allocation state is defined. */
(function loadWorkPackageResourcePlanning(){
  if(window.__amoWorkPackageResourcePlanningLoading||window.WorkPackageResourcePlanning)return;
  window.__amoWorkPackageResourcePlanningLoading=true;
  const script=document.createElement('script');
  script.src='app-work-package-resource-planning.js?v=20260907-2';
  script.onload=()=>{window.__amoWorkPackageResourcePlanningLoading=false;if(typeof renderAllocations==='function')renderAllocations()};
  script.onerror=()=>{window.__amoWorkPackageResourcePlanningLoading=false;console.warn('Could not load Work Package resource planning UI.')};
  document.head.appendChild(script);
})();

/* Load-safe stubs prevent early refresh calls from failing before the canonical module arrives. */
function renderAllocations(){return window.WorkPackageResourcePlanning?.render?.()}
function saveAllocations(){return window.WorkPackageResourcePlanning?.save?.()}
