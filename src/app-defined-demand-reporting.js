/* Defined Demand reporting integration.
   Step 5 moved Work Package-derived service context into the canonical Status Report snapshot/renderer.
   Keep only the refresh hook needed when child Work Packages change; do not wrap or mutate Status Reporting. */
(function initDefinedDemandReporting(){
  window.addEventListener('amo:work-packages-updated',()=>{
    if(document.getElementById('statusReportTable')&&typeof renderStatusReporting==='function')renderStatusReporting();
  });
})();
