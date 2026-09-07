/* Late-view hooks for canonical planning reporting.
   Dynamically loaded views are enhanced through stable DOM lifecycle surfaces; this module does not
   replace canonical renderers or recreate planning calculations. */
(function initPlanningReportingHooks(){
  const pr=()=>window.PlanningReporting;
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'');
  function appendDashboardPlanningSignals(){
    const host=document.getElementById('attentionList');if(!host||!workspaceHandle||!pr())return;
    host.querySelectorAll('[data-planning-attention]').forEach(x=>x.remove());
    const source=typeof scopedDemand==='function'?scopedDemand():db.demand,portfolio=pr().portfolioSignals(source);
    for(const item of portfolio.aboveBudgetForecast.slice(0,5)){const li=document.createElement('li');li.dataset.planningAttention='true';li.innerHTML=`<strong>${esc(item.demandId)}</strong> — ${esc(item.title)}<br><span class="muted">${esc(item.text)}</span>`;host.appendChild(li)}
    if(portfolio.legacyAllocations.length){const li=document.createElement('li');li.dataset.planningAttention='true';li.innerHTML=`<strong>Resource plan decomposition</strong><br><span class="muted">${portfolio.legacyAllocations.length} Demand item${portfolio.legacyAllocations.length===1?'':'s'} still contain allocation not assigned to a Work Package.</span>`;host.appendChild(li)}
  }
  function updateStaticWording(){
    const allocationHero=document.querySelector('#allocations .hero p');if(allocationHero)allocationHero.textContent='Plan named resources against Work Packages; Demand totals are derived roll-ups.';
    const roadmapNotice=document.querySelector('#roadmap > .notice');if(roadmapNotice)roadmapNotice.innerHTML='Delivery dates are maintained on Work Packages. The thin line is derived from child Work Package dates; the resource line is the <strong>roll-up of Work Package Resource Plan allocations</strong> to the parent Demand. Legacy undecomposed allocations remain visible only during migration.';
    const roadmapHero=document.querySelector('#roadmap .hero p');if(roadmapHero)roadmapHero.textContent='Work Package delivery windows compared with the resource plan rolled up to the parent Defined Demand.';
  }
  const dashboardKpis=document.getElementById('kpiGrid');if(dashboardKpis)new MutationObserver(()=>queueMicrotask(appendDashboardPlanningSignals)).observe(dashboardKpis,{childList:true});
  function refresh(){updateStaticWording();appendDashboardPlanningSignals();window.PlanningReportingUI?.enhanceResource?.();window.PlanningReportingUI?.enhanceStatusTable?.();window.PlanningReportingUI?.enhanceDemandModal?.()}
  refresh();window.addEventListener('amo:reporting-model-updated',refresh);window.addEventListener('amo:work-packages-updated',refresh);
  window.PlanningReportingHooks={refresh,appendDashboardPlanningSignals};
})();
