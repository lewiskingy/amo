/* Preserve lazy Status Report catalogue loading while allowing later UI layers to pass stubs to the viewer. */
(function initStatusReportHistoryCompatibility(){
  if(window.__amoStatusReportHistoryCompatLoaded)return;window.__amoStatusReportHistoryCompatLoaded=true;
  if(typeof openStatusReportModal!=='function')return;
  const baseOpenStatusReportModal=openStatusReportModal;
  openStatusReportModal=async function(report){
    if(!report)return;
    let resolved=report;
    if(report._lazy&&typeof loadPublishedStatusReport==='function'){
      resolved=await loadPublishedStatusReport(report.id);
      if(!resolved)return
    }
    return baseOpenStatusReportModal(resolved)
  };
})();
