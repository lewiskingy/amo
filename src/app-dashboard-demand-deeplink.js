/* Transitional Dashboard -> canonical /demand drill-through bridge.
   The Dashboard is still legacy during #183, but Demand filtering now belongs to the route-owned client.
   Remove this bridge when Dashboard itself migrates to the target client. */
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
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#commitmentControlPanel [data-nav]');if(!button)return;
    const href=routes[button.dataset.nav];if(!href)return;
    event.preventDefault();event.stopImmediatePropagation();location.assign(href);
  },true);
  window.AmoDashboardDemandDeepLinks={routes};
})();
