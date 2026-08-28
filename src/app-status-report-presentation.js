/* Shared Status Report presentation semantics.
   Keeps report summaries concise and applies Health semantics to generated report HTML itself
   so Preview, Published/Final, standalone and print views all render consistently. */
(function initStatusReportPresentation(){
  if(window.__amoStatusReportPresentationLoaded)return;window.__amoStatusReportPresentationLoaded=true;

  const normalizeHealth=v=>({Green:'On Track',Amber:'At Risk',Red:'Off Track','On Track':'On Track','At Risk':'At Risk','Off Track':'Off Track'}[String(v||'').trim()]||String(v||'').trim());
  const healthTone=v=>{const h=normalizeHealth(v);return h==='On Track'?'green':h==='At Risk'?'amber':h==='Off Track'?'red':'unset'};

  /* Attention Required remains a Dashboard concern. Status Reports intentionally stop at
     Demand highlights, Capacity outlook, Portfolio forecast and Allocation outlook before narrative. */
  if(typeof attentionSnapshotHtml==='function')attentionSnapshotHtml=function(){return''};

  if(typeof dashboardSnapshotHtml==='function'){
    const baseDashboardSnapshotHtml=dashboardSnapshotHtml;
    dashboardSnapshotHtml=function(snapshot){
      let html=baseDashboardSnapshotHtml(snapshot);
      const marker='<div class="report-dashboard-snapshot">';
      if(html.includes(marker)&&!html.includes('report-demand-highlights-title')){
        html=html.replace(marker,`${marker}<div class="section-title report-demand-highlights-title"><h2>Demand highlights</h2><span class="muted">Headline portfolio position for this reporting cycle.</span></div>`)
      }
      return html
    }
  }

  /* Put semantic Health classes into the generated report itself rather than relying on a
     modal-only DOM decorator. This survives standalone window/print rendering as well. */
  if(typeof reportNarrativeHtml==='function'){
    const baseReportNarrativeHtml=reportNarrativeHtml;
    reportNarrativeHtml=function(report){
      const html=baseReportNarrativeHtml(report),template=document.createElement('template');template.innerHTML=html;
      const entries=[...template.content.querySelectorAll('.report-entry')];
      entries.forEach((node,index)=>{
        const data=report?.entries?.[index]||{},health=normalizeHealth(data.health||data.rag),tone=healthTone(health);
        node.classList.remove('report-health-green','report-health-amber','report-health-red','report-health-unset');node.classList.add(`report-health-${tone}`);node.dataset.health=health||'Unset';
        const head=node.querySelector('.report-entry-head');if(head)head.classList.add('report-health-head');
        const dot=node.querySelector('.rag-dot');if(dot){dot.classList.remove('rag-Green','rag-Amber','rag-Red','rag-Unset','health-green','health-amber','health-red','health-unset');dot.classList.add(`health-${tone}`)}
        const label=node.querySelector('.report-entry-head > div:last-child');if(label){label.classList.add('report-health-label');label.setAttribute('aria-label',`Health: ${health||'Unset'}`)}
      });
      return template.innerHTML
    }
  }

  function alignLiveStatusPage(){
    const snapshot=$('statusDashboardSnapshot');
    if(snapshot){
      const portfolioHeading=[...snapshot.children].find(el=>el.classList?.contains('section-title')&&el.querySelector('h2')?.textContent.trim()==='Portfolio Snapshot');
      portfolioHeading?.remove()
    }
    const section=$('status-report');if(!section)return;
    const current=[...section.querySelectorAll('.section-title h2')].find(h=>h.textContent.trim()==='Current Draft');if(current)current.textContent='Architecture Status Report'
  }
  if(typeof renderStatusReporting==='function'){
    const baseRenderStatusReporting=renderStatusReporting;
    renderStatusReporting=function(){const r=baseRenderStatusReporting();alignLiveStatusPage();return r}
  }

  const style=document.createElement('style');style.id='status-report-presentation-styles';style.textContent=`
    .report-dashboard-snapshot>.split{display:block!important}.report-dashboard-snapshot>.split>.report-snapshot-panel{width:100%;max-width:none}.report-demand-highlights-title{margin-top:0}.report-dashboard-snapshot{margin-bottom:18px}
    .report-entry{border-left-width:6px!important}.report-health-green{border-left-color:#1b7f5a!important}.report-health-amber{border-left-color:#d88a00!important}.report-health-red{border-left-color:#b42318!important}.report-health-unset{border-left-color:#98a2b3!important}
    .report-health-green .report-entry-head{background:rgba(27,127,90,.10)!important}.report-health-amber .report-entry-head{background:rgba(216,138,0,.11)!important}.report-health-red .report-entry-head{background:rgba(180,35,24,.10)!important}.report-health-unset .report-entry-head{background:rgba(152,162,179,.08)!important}.report-health-label{font-weight:800}
    html[data-theme="dark"] .report-health-green .report-entry-head{background:rgba(27,127,90,.18)!important}html[data-theme="dark"] .report-health-amber .report-entry-head{background:rgba(216,138,0,.18)!important}html[data-theme="dark"] .report-health-red .report-entry-head{background:rgba(180,35,24,.18)!important}
    @media print{.report-health-green{border-left-color:#1b7f5a!important}.report-health-amber{border-left-color:#b86f00!important}.report-health-red{border-left-color:#b42318!important}.report-health-green .report-entry-head{background:#edf8f3!important}.report-health-amber .report-entry-head{background:#fff7e6!important}.report-health-red .report-entry-head{background:#fff0ee!important}.report-health-unset .report-entry-head{background:#f5f6f7!important}}
  `;document.head.appendChild(style);

  alignLiveStatusPage();
})();
