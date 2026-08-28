/* Canonical Status Report deep links. Published/Final reports open in the lightweight /reports viewer;
   Draft Preview retains the existing generated-window behaviour because it has no persisted report ID. */
(function initStatusReportDeepLinks(){
  if(window.__amoStatusReportDeepLinksLoaded)return;window.__amoStatusReportDeepLinksLoaded=true;

  const persistedReport=r=>!!r?.id&&/^SR-/.test(r.id)&&['Published','Final','Unpublished'].includes(r.status||'Published');
  function reportSourceMode(){return window.workspaceRepository?.mode||(typeof getLastConnectionPreference==='function'?getLastConnectionPreference()?.mode:null)||'remote'}
  function reportUrl(id,mode=reportSourceMode()){
    const url=new URL(`/reports/${encodeURIComponent(id)}`,location.origin);if(mode==='local')url.searchParams.set('source','local');return url.href
  }
  async function copyReportLink(id,mode=reportSourceMode(),button=null){
    const value=reportUrl(id,mode);try{await navigator.clipboard.writeText(value);if(button){const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1300)}}catch{prompt('Copy report link',value)}
  }
  function openReportPage(id,mode=reportSourceMode()){window.open(reportUrl(id,mode),'_blank','noopener')}

  /* From this layer onwards both the in-app modal and /reports use the same persisted-snapshot renderer. */
  if(window.AmoReportRenderer&&typeof reportNarrativeHtml==='function')reportNarrativeHtml=function(report){return AmoReportRenderer.renderReport(report)};

  function decorateOpenModal(report){
    if(!persistedReport(report))return;const open=$('statusOpenWindow');if(open){const replacement=open.cloneNode(true);replacement.id='statusOpenWindow';replacement.textContent='Open Report';replacement.title='Open the canonical lightweight report page.';open.replaceWith(replacement);replacement.addEventListener('click',()=>openReportPage(report.id))}
    const actions=document.querySelector('.status-modal-actions');if(actions&&!actions.querySelector('[data-copy-report-link]')){const copy=document.createElement('button');copy.className='btn';copy.dataset.copyReportLink=report.id;copy.textContent=reportSourceMode()==='local'?'Copy Local Link':'Copy Link';copy.title=reportSourceMode()==='local'?'Local links require access to the same remembered browser workspace.':'Copy the shareable report URL.';copy.addEventListener('click',()=>copyReportLink(report.id,reportSourceMode(),copy));actions.prepend(copy)}
  }
  if(typeof openStatusReportModal==='function'){
    const base=openStatusReportModal;openStatusReportModal=async function(report){const result=await base(report);let resolved=report;if(report?._lazy)resolved=statusReports?.find?.(r=>r.id===report.id)||report;queueMicrotask(()=>decorateOpenModal(resolved));return result}
  }

  function addRowActions(){
    const table=$('statusHistoryTable');if(!table)return;table.querySelectorAll('tr[data-report-id]').forEach(row=>{const id=row.dataset.reportId,cell=row.lastElementChild;if(!id||!cell||cell.querySelector('[data-open-report-page]'))return;const open=document.createElement('button');open.className='btn';open.dataset.openReportPage=id;open.textContent='Open Report';open.addEventListener('click',()=>openReportPage(id));const copy=document.createElement('button');copy.className='btn';copy.dataset.copyReportLink=id;copy.textContent=reportSourceMode()==='local'?'Copy Local Link':'Copy Link';copy.addEventListener('click',()=>copyReportLink(id,reportSourceMode(),copy));cell.style.whiteSpace='nowrap';cell.append(' ',open,' ',copy)})
  }
  if(typeof renderStatusHistory==='function'){const base=renderStatusHistory;renderStatusHistory=function(){const r=base();addRowActions();return r}}

  function decorateLatest(){const host=$('latestStatusReport'),report=typeof latestReport==='function'?latestReport():null;if(!host||!persistedReport(report)||host.querySelector('[data-open-latest-report]'))return;const flex=host.querySelector('.flex'),buttons=flex?.lastElementChild?.tagName==='BUTTON'?flex:null;if(!buttons)return;const open=document.createElement('button');open.className='btn';open.dataset.openLatestReport=report.id;open.textContent='Open Report';open.addEventListener('click',()=>openReportPage(report.id));buttons.after(open)}
  if(typeof renderLatestReportCard==='function'){const base=renderLatestReportCard;renderLatestReportCard=function(){const r=base();decorateLatest();return r}}

  window.AmoReportLinks={reportUrl,openReportPage,copyReportLink};
  addRowActions();decorateLatest();
})();
