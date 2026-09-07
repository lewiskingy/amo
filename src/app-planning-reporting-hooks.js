/* Late-view hooks for canonical planning reporting.
   Keeps compatibility with modules that are dynamically loaded while avoiding a second set of
   planning calculations. All values and classifications come from PlanningReporting. */
(function initPlanningReportingHooks(){
  let resourceWrapped=false,dashboardWrapped=false;
  const pr=()=>window.PlanningReporting;
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'');

  function installResource(){
    if(resourceWrapped||typeof renderResource!=='function'||!window.PlanningReportingUI)return resourceWrapped;
    const base=renderResource;renderResource=function(){const result=base.apply(this,arguments);window.PlanningReportingUI?.enhanceResource?.();return result};resourceWrapped=true;return true
  }
  function appendDashboardPlanningSignals(){
    const host=document.getElementById('attentionList');if(!host||!workspaceHandle||!pr())return;
    host.querySelectorAll('[data-planning-attention]').forEach(x=>x.remove());
    const source=typeof scopedDemand==='function'?scopedDemand():db.demand,portfolio=pr().portfolioSignals(source);
    for(const item of portfolio.aboveBudgetForecast.slice(0,5)){
      const li=document.createElement('li');li.dataset.planningAttention='true';li.innerHTML=`<strong>${esc(item.demandId)}</strong> — ${esc(item.title)}<br><span class="muted">${esc(item.text)}</span>`;host.appendChild(li)
    }
    if(portfolio.legacyAllocations.length){const li=document.createElement('li');li.dataset.planningAttention='true';li.innerHTML=`<strong>Resource plan decomposition</strong><br><span class="muted">${portfolio.legacyAllocations.length} Demand item${portfolio.legacyAllocations.length===1?'':'s'} still contain allocation not assigned to a Work Package.</span>`;host.appendChild(li)}
  }
  function installDashboard(){
    if(dashboardWrapped||typeof renderDashboard!=='function')return dashboardWrapped;
    const base=renderDashboard;renderDashboard=function(){const result=base.apply(this,arguments);appendDashboardPlanningSignals();return result};dashboardWrapped=true;return true
  }
  function updateStaticWording(){
    const allocationHero=document.querySelector('#allocations .hero p');if(allocationHero)allocationHero.textContent='Plan named resources against Work Packages; Demand totals are derived roll-ups.';
    const resourceNotice=document.querySelector('#resource > .notice');if(resourceNotice&&!resourceNotice.dataset.planningCopy){resourceNotice.dataset.planningCopy='true'}
    const roadmapNotice=document.querySelector('#roadmap > .notice');if(roadmapNotice)roadmapNotice.innerHTML='Delivery dates are maintained on Work Packages. The thin line is derived from child Work Package dates; the resource line is the <strong>roll-up of Work Package Resource Plan allocations</strong> to the parent Demand. Legacy undecomposed allocations remain visible only during migration.';
    const roadmapHero=document.querySelector('#roadmap .hero p');if(roadmapHero)roadmapHero.textContent='Work Package delivery windows compared with the resource plan rolled up to the parent Defined Demand.';
  }
  function install(){installResource();installDashboard();updateStaticWording();appendDashboardPlanningSignals()}
  install();let attempts=0;const timer=setInterval(()=>{attempts++;install();if((resourceWrapped&&dashboardWrapped)||attempts>40)clearInterval(timer)},100);
  window.addEventListener('amo:reporting-model-updated',()=>{install();appendDashboardPlanningSignals()});
  window.addEventListener('amo:work-packages-updated',()=>{install();appendDashboardPlanningSignals()});
  window.PlanningReportingHooks={install,appendDashboardPlanningSignals};
})();
