/* Defined Demand reporting integration.
   Work Package-derived service context remains owned by Status Reporting. Planning progression is
   composed by PlanningReporting and projected into Demand, Resource Plan and Status Reporting by the
   dedicated UI integration. Keep this file as the small load/refresh bridge rather than duplicating
   reporting arithmetic here. */
(function initDefinedDemandReporting(){
  function loadScript(src,marker){
    if(document.querySelector(`script[data-${marker}]`))return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script'),build=String(window.AMO_CONFIG?.buildId||'').trim();s.src=build?`${src}?v=${encodeURIComponent(build)}`:src;s.async=false;s.dataset[marker]='true';s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s)})
  }
  async function ensurePlanningReporting(){
    try{if(!window.PlanningReporting)await loadScript('app-planning-reporting.js','amoPlanningReporting');if(!window.PlanningReportingUI)await loadScript('app-planning-reporting-ui.js','amoPlanningReportingUi')}catch(error){console.warn('Planning reporting integration unavailable.',error)}
  }
  ensurePlanningReporting().then(()=>{if(typeof refreshAll==='function'&&workspaceHandle)refreshAll()});
  window.addEventListener('amo:work-packages-updated',()=>{
    if(document.getElementById('statusReportTable')&&typeof renderStatusReporting==='function')renderStatusReporting();
  });
})();
