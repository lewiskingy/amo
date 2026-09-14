/* Transitional Dashboard -> canonical /demand drill-through and navigation bridge.
   The Dashboard and surrounding shell are still legacy during #183, but Demand filtering and the
   preferred Demand experience now belong to the route-owned client. Remove this bridge when the
   legacy shell itself has migrated to the target client. */
(function installDashboardDemandDeepLinks(){
  if(window.__amoDashboardDemandDeepLinksInstalled)return;
  window.__amoDashboardDemandDeepLinksInstalled=true;
  const routes={
    'no-project':'/demand?control=funding-missing&project=missing',
    'unmet-demand':'/demand?control=resource-missing',
    'no-allocation':'/demand?control=resource-missing',
    'missing-work-item-list':'/demand?control=work-item-missing',
    'missing-actuals':'/demand?control=actuals-missing'
  };
  function promoteDemandNavigation(){
    const legacyButton=document.querySelector('.sidebar .nav-btn[data-view="demand"]');if(!legacyButton)return;
    legacyButton.innerHTML='<span class="nav-dot"></span>Demand (legacy)';
    if(document.querySelector('.sidebar [data-canonical-demand-link]'))return;
    const link=document.createElement('a');link.className='nav-btn';link.dataset.canonicalDemandLink='true';link.href='/demand';link.style.textDecoration='none';link.innerHTML='<span class="nav-dot"></span>Demand';legacyButton.parentNode?.insertBefore(link,legacyButton)
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#commitmentControlPanel [data-nav]');if(!button)return;
    const href=routes[button.dataset.nav];if(!href)return;
    event.preventDefault();event.stopImmediatePropagation();location.assign(href);
  },true);
  promoteDemandNavigation();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',promoteDemandNavigation,{once:true});
  setTimeout(promoteDemandNavigation,0);
  window.AmoDashboardDemandDeepLinks={routes,promoteDemandNavigation};
})();
