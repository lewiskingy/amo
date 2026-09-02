/* Canonical Status Report deep-link helpers. Persisted reports open through the lightweight
   /reports viewer and may carry an independent Department/Team projection. */
(function initStatusReportDeepLinks(){
  if(window.__amoStatusReportDeepLinksLoaded)return;window.__amoStatusReportDeepLinksLoaded=true;
  const ORG='organization',ALL='department';
  function reportSourceMode(){return window.workspaceRepository?.mode||(typeof getLastConnectionPreference==='function'?getLastConnectionPreference()?.mode:null)||'remote'}
  function applyScope(url,scope){
    const departmentId=scope?.departmentId||ORG,teamId=scope?.teamId||ALL;
    if(departmentId!==ORG)url.searchParams.set('department',departmentId);
    if(teamId!==ALL)url.searchParams.set('team',teamId);
    return url
  }
  function reportUrl(id,mode=reportSourceMode(),scope=null){const url=applyScope(new URL(`/reports/${encodeURIComponent(id)}`,location.origin),scope);if(mode==='local')url.searchParams.set('source','local');return url.href}
  function openReportPage(id,mode=reportSourceMode(),scope=null){window.open(reportUrl(id,mode,scope),'_blank','noopener')}
  window.AmoReportLinks={reportUrl,openReportPage,reportSourceMode};
})();
