/* Canonical Status Report deep-link helpers. UI surfaces expose only View/Preview; persisted
   report modals offer Open Report, which opens this canonical lightweight route. */
(function initStatusReportDeepLinks(){
  if(window.__amoStatusReportDeepLinksLoaded)return;window.__amoStatusReportDeepLinksLoaded=true;
  function reportSourceMode(){return window.workspaceRepository?.mode||(typeof getLastConnectionPreference==='function'?getLastConnectionPreference()?.mode:null)||'remote'}
  function reportUrl(id,mode=reportSourceMode()){const url=new URL(`/reports/${encodeURIComponent(id)}`,location.origin);if(mode==='local')url.searchParams.set('source','local');return url.href}
  function openReportPage(id,mode=reportSourceMode()){window.open(reportUrl(id,mode),'_blank','noopener')}
  window.AmoReportLinks={reportUrl,openReportPage,reportSourceMode};
})();
