/* Enhanced Status Report Preview/View experience: local scope, top actions, print and maximize. */
(function initStatusReportUiEnhancements(){
  let statusModalReport=null,statusModalScope='department',statusModalMaximized=false;

  function reportScopeName(scope){return scope==='department'?'Whole Department':(typeof teamById==='function'?(teamById(scope)?.name||scope):scope)}
  function reportForModalScope(report,scope){
    const copy=clone(report);
    copy.entries=scope==='department'?(report.entries||[]):(report.entries||[]).filter(e=>e.teamId===scope);
    if(report.dashboardSnapshots?.department&&scope==='department')copy.dashboardSnapshot=report.dashboardSnapshots.department;
    if(report.dashboardSnapshots?.teams&&scope!=='department')copy.dashboardSnapshot=report.dashboardSnapshots.teams[scope]||copy.dashboardSnapshot;
    copy.scopeId=scope;copy.scopeName=reportScopeName(scope);
    return copy
  }
  function modalReportTitle(report,scope){
    const draft=report.status!=='Published';
    return `Architecture Status Report — ${reportScopeName(scope)}${draft?' (DRAFT)':''}`
  }
  function scopedNarrative(report,scope){
    const copy=reportForModalScope(report,scope);
    const base=reportNarrativeHtml(copy);
    return base.replace(/<h2 style="margin:0">Architecture Status Report<\/h2>/,`<h2 style="margin:0">${escHtml(modalReportTitle(report,scope))}</h2>`)
  }
  function scopeOptions(selected){
    const teams=typeof configuredTeams==='function'?configuredTeams():[];
    return `<option value="department" ${selected==='department'?'selected':''}>Whole Department</option>${teams.map(t=>`<option value="${escHtml(t.id)}" ${selected===t.id?'selected':''}>${escHtml(t.name)}</option>`).join('')}`
  }
  function renderStatusModal(){
    if(!statusModalReport)return;
    const body=$('recordModalBody'),actions=$('recordModalActions'),title=$('recordModalTitle'),subtitle=$('recordModalSubtitle'),modal=document.querySelector('#recordModalBackdrop .record-modal');
    if(!body||!actions||!modal)return;
    modal.classList.add('status-modal');modal.classList.toggle('status-modal-maximized',statusModalMaximized);
    if(title)title.textContent=modalReportTitle(statusModalReport,statusModalScope);
    if(subtitle)subtitle.textContent=statusModalReport.status==='Published'?`${statusModalReport.id} · ${statusModalReport.reportingDate||''}`:'Preview of the current working draft';
    body.innerHTML=`<div class="status-modal-toolbar"><label class="status-scope-control"><span>Scope</span><select id="statusModalScope">${scopeOptions(statusModalScope)}</select></label><div class="status-modal-actions"><button class="btn" id="statusPrintTop">Print / Save PDF</button><button class="btn" id="statusOpenWindow">Open in New Window</button><button class="btn" id="statusMaximize">${statusModalMaximized?'Restore':'Maximize'}</button></div></div><div id="statusModalReportContent">${scopedNarrative(statusModalReport,statusModalScope)}</div>`;
    actions.innerHTML='<button class="btn" id="closeStatusReport">Close</button>';
    $('statusModalScope')?.addEventListener('change',e=>{statusModalScope=e.target.value;renderStatusModal()});
    $('statusPrintTop')?.addEventListener('click',()=>openStandaloneStatusReport(statusModalReport,statusModalScope,true));
    $('statusOpenWindow')?.addEventListener('click',()=>openStandaloneStatusReport(statusModalReport,statusModalScope,false));
    $('statusMaximize')?.addEventListener('click',()=>{statusModalMaximized=!statusModalMaximized;renderStatusModal()});
    $('closeStatusReport')?.addEventListener('click',closeStatusReportEnhanced)
  }
  function closeStatusReportEnhanced(){
    statusModalReport=null;statusModalMaximized=false;
    const modal=document.querySelector('#recordModalBackdrop .record-modal');modal?.classList.remove('status-modal','status-modal-maximized');
    if(typeof closeRecordModal==='function')closeRecordModal();else $('recordModalBackdrop')?.classList.remove('open')
  }

  openStatusReportModal=function(report){
    if(!report)return;
    statusModalReport=clone(report);statusModalScope=(typeof departmentScope!=='undefined'?departmentScope:'department');statusModalMaximized=false;
    const backdrop=$('recordModalBackdrop');if(backdrop)backdrop.classList.add('open');
    if(typeof recordModalState!=='undefined'){recordModalState.open=true;recordModalState.mode='view';recordModalState.type='status-report';recordModalState.id=report.id}
    renderStatusModal()
  };

  function absoluteStylesForPrint(){
    const links=[...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>`<link rel="stylesheet" href="${escHtml(l.href)}">`).join('');
    const styles=[...document.querySelectorAll('style')].map(s=>`<style>${s.textContent}</style>`).join('');
    return links+styles
  }
  function standaloneReportHeader(report,scope){
    const title=modalReportTitle(report,scope),published=report.status==='Published',date=report.reportingDate||'',publishedText=published&&report.publishedAt?` · Published ${new Date(report.publishedAt).toLocaleString()}`:'';
    return `<header class="standalone-report-header"><h1>${escHtml(title)}</h1><div class="standalone-report-meta">${escHtml(date)}${publishedText?escHtml(publishedText):''}${published&&report.id?` · ${escHtml(report.id)}`:''}</div></header>`
  }
  function standaloneReportDocument(report,scope){
    const theme=document.documentElement.dataset.theme||'light',title=modalReportTitle(report,scope),html=scopedNarrative(report,scope);
    return `<!DOCTYPE html><html data-theme="${escHtml(theme)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title>${absoluteStylesForPrint()}<style>body{margin:0;padding:24px;background:var(--bg);color:var(--ink)}.standalone-report-shell{max-width:1200px;margin:0 auto}.standalone-report-header{margin:0 0 22px;padding:0 0 16px;border-bottom:1px solid var(--line)}.standalone-report-header h1{margin:0 0 8px;font-size:2rem;line-height:1.15;color:var(--ink)}.standalone-report-meta{color:var(--muted);font-size:.9rem}.standalone-report-shell>.report-card{max-width:none;margin:0}.standalone-report-shell>.report-card>.section-title:first-child{display:none}.status-modal-toolbar,.modal-actions,.btn{display:none!important}@media print{html,body{background:#fff!important;color:#111!important}.standalone-report-header{border-color:#d0d5dd!important}.standalone-report-header h1{color:#111!important}.standalone-report-meta{color:#475467!important}.report-card{background:#fff!important;color:#111!important;border-color:#d0d5dd!important;box-shadow:none!important}.report-entry{border-color:#d0d5dd!important}.report-entry-head{background:#f7f9fc!important;color:#111!important}.report-narrative,.report-narrative h4,.muted{color:#475467!important}.report-narrative p,.report-entry strong,.section-title h2,.section-title h3{color:#111!important}.card{background:#fff!important;color:#111!important;border-color:#d0d5dd!important}.bar{background:#e9edf3!important}a{color:#175cd3!important}@page{margin:12mm}}</style></head><body><main class="standalone-report-shell">${standaloneReportHeader(report,scope)}${html}</main></body></html>`
  }
  function openStandaloneStatusReport(report,scope,autoPrint=false){
    const win=window.open('','_blank');if(!win){alert('The browser blocked the report window. Allow pop-ups for this page and try again.');return}
    win.document.open();
    win.document.write(standaloneReportDocument(report,scope));
    win.document.close();
    if(!autoPrint)return;
    const doPrint=()=>{try{win.focus();win.print()}catch(e){}};
    if(win.document.readyState==='complete')setTimeout(doPrint,250);else win.addEventListener('load',()=>setTimeout(doPrint,250),{once:true})
  }

  /* Always build Preview with all Department entries/snapshots underneath; modal scope controls presentation. */
  const fullPreviewBase=buildPreviewReport;
  buildPreviewReport=function(){
    if(typeof departmentScope==='undefined')return fullPreviewBase();
    const selected=departmentScope;departmentScope='department';
    try{const r=fullPreviewBase();r.initialScopeId=selected;r.initialScopeName=reportScopeName(selected);return r}finally{departmentScope=selected}
  };

  /* Put Latest Report ahead of the Portfolio Snapshot for quick access. */
  function positionLatestReport(){
    const section=$('status-report'),latest=$('latestStatusReport');if(!section||!latest)return;
    const heading=[...section.querySelectorAll('.section-title')].find(x=>x.querySelector('h2')?.textContent.trim()==='Latest Report');
    const snapshot=$('statusDashboardSnapshot');
    if(heading&&snapshot){section.insertBefore(heading,snapshot);section.insertBefore(latest,snapshot)}
  }
  const enhancedRenderStatus=renderStatusReporting;
  renderStatusReporting=function(){const r=enhancedRenderStatus();positionLatestReport();return r};

  const css=document.createElement('style');css.id='status-report-ui-enhancements';css.textContent=`
    .status-modal-toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0 14px;background:var(--panel);border-bottom:1px solid var(--line);margin-bottom:14px}
    .status-scope-control{display:flex;align-items:center;gap:8px;font-size:.82rem;font-weight:700;color:var(--muted)}
    .status-scope-control select{min-width:210px;border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 9px;background:var(--panel);color:var(--ink)}
    .status-modal-actions{display:flex;gap:8px;align-items:center}.status-modal-maximized{position:fixed!important;inset:12px!important;width:auto!important;max-width:none!important;height:calc(100vh - 24px)!important;max-height:none!important;display:flex!important;flex-direction:column!important}.status-modal-maximized #recordModalBody{overflow:auto;flex:1;min-height:0}.status-modal-maximized .status-modal-toolbar{top:-1px}
    #latestStatusReport{margin-bottom:18px}html[data-theme="dark"] #latestStatusReport .report-card{background:var(--panel);color:var(--ink);border-color:var(--line)}html[data-theme="dark"] #latestStatusReport .muted{color:var(--muted)}
    html[data-theme="dark"] .status-modal-toolbar{background:var(--panel);color:var(--ink)}
    @media(max-width:760px){.status-modal-toolbar{align-items:flex-start;flex-direction:column}.status-modal-actions{width:100%;flex-wrap:wrap}.status-scope-control{width:100%}.status-scope-control select{flex:1;min-width:0}}
  `;document.head.appendChild(css);
  positionLatestReport();
})();
