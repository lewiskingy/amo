/* Step 4 reporting integration.
   Defined Demand no longer owns a delivery Service. Status reporting therefore removes the obsolete
   Demand Service authoring column and captures child Work Package services in report snapshots. */
(function initDefinedDemandReporting(){
  const servicesForDemand=d=>window.WorkPackages?.summaryForDemand?.(d?.id)?.services||[];

  if(typeof snapshotStatusEntry==='function'){
    const baseSnapshotStatusEntry=snapshotStatusEntry;
    snapshotStatusEntry=function(d,e){
      const entry=baseSnapshotStatusEntry(d,e),services=servicesForDemand(d);
      entry.services=[...services];
      /* Keep the existing immutable report-renderer contract readable while the richer Work Package
         reporting treatment is completed in Step 5. This is derived context, not Demand.service. */
      entry.service=services.join(', ');
      return entry
    }
  }

  function removeObsoleteDemandServiceColumn(){
    const table=document.getElementById('statusReportTable');if(!table)return;
    const headerRows=table.querySelectorAll('thead tr');
    headerRows.forEach(row=>row.children?.[2]?.remove());
    table.querySelectorAll('tbody tr').forEach(row=>row.children?.[2]?.remove());
  }

  if(typeof renderStatusReporting==='function'){
    const baseRenderStatusReporting=renderStatusReporting;
    renderStatusReporting=function(){
      if(typeof statusReportState!=='undefined'){
        statusReportState.filters.service='';
        if(statusReportState.sort==='service'){statusReportState.sort='title';statusReportState.direction='asc'}
      }
      const result=baseRenderStatusReporting();removeObsoleteDemandServiceColumn();return result
    }
  }

  window.addEventListener('amo:work-packages-updated',()=>{
    if(document.getElementById('statusReportTable')&&typeof renderStatusReporting==='function')renderStatusReporting()
  });
})();
