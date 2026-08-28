/* Pure Status Report renderer shared by the AMO workspace UI and the lightweight /reports viewer.
   It consumes only the persisted report snapshot; it never reads the live workspace. */
(function initAmoReportRenderer(){
  if(window.AmoReportRenderer)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeHealth=v=>({Green:'On Track',Amber:'At Risk',Red:'Off Track','On Track':'On Track','At Risk':'At Risk','Off Track':'Off Track'}[String(v||'').trim()]||String(v||'').trim());
  const healthTone=v=>{const h=normalizeHealth(v);return h==='On Track'?'green':h==='At Risk'?'amber':h==='Off Track'?'red':'unset'};
  const moneyCompact=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const num=(n,d=0)=>Number(n||0).toFixed(d);
  const formatDate=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-GB')};
  const sectionTitle=(title,note='')=>`<div class="section-title report-section-title"><h2>${esc(title)}</h2>${note?`<span class="muted">${esc(note)}</span>`:''}</div>`;
  const kpi=(label,value,sub='')=>`<div class="card report-kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div>${sub?`<div class="kpi-sub">${esc(sub)}</div>`:''}</div>`;

  function demandHighlights(s){
    if(!s)return'';
    const defs=[
      ['Active demand',s.activeDemand,'Unresolved Architecture demand'],
      ['Unallocated',s.unallocated,'Needs resource allocation'],
      ['Demand without Estimate',s.demandWithoutEstimate,'No ROM or full estimate'],
      ['Unfunded Demand',s.unfundedDemand,'Forecast exists; funding not confirmed'],
      ['In socialisation',s.inSocialisation,'In Socialisation / Review'],
      ['In governance',s.inGovernance,'In Approval / Governance'],
      ['Capacity conflicts',s.capacityConflicts,'Person-period over-allocation']
    ].filter(([,v])=>v!==undefined&&v!==null);
    return defs.length?`${sectionTitle('Demand highlights','Headline portfolio position for this reporting cycle.')}<div class="grid kpis report-headline-kpis">${defs.map(([l,v,sub])=>kpi(l,String(v),sub)).join('')}</div>`:''
  }
  function capacityOutlook(s){
    const rows=s?.capacityOutlook||[];if(!rows.length)return'';
    return `${sectionTitle('Capacity outlook')}<div class="card report-snapshot-panel">${rows.map(r=>{const pct=Number(r.utilisationPct||0);return `<div class="capacity-row"><div class="flex"><strong>${esc(r.label||r.month||'')}</strong><span>${num(r.allocatedFte,1)} / ${num(r.capacityFte,1)} FTE (${Math.round(pct)}%)</span></div><div class="bar ${pct>100?'bad':pct>85?'warn':'good'}"><span style="width:${Math.min(Math.max(pct,0),100)}%"></span></div></div>`}).join('')}</div>`
  }
  function portfolioForecast(s){
    const p=s?.portfolioForecast;if(!p)return'';const m=p.maturity||{};
    return `<div class="portfolio-forecast">${sectionTitle('Portfolio forecast','Best available total forecast · ROM → Estimate → Complete Allocations')}<div class="grid kpis financial-kpis">${kpi('Current billable forecast',moneyCompact(p.currentForecast),`Best available basis${p.unresolvedValue?` · ${p.unresolvedValue} without £ value`:''}`)}${kpi('Funded forecast',moneyCompact(p.fundedForecast),'Current forecast with confirmed funding')}${kpi('Unfunded forecast',moneyCompact(p.unfundedForecast),'Current forecast without confirmed funding')}${kpi('Future allocated forecast',moneyCompact(p.futureAllocated),'Allocation forecast from current month onward')}</div><div class="forecast-maturity muted">Forecast basis: ${Number(m.allocations||0)} allocation-based · ${Number(m.estimate||0)} estimate-based · ${Number(m.rom||0)} ROM-based · ${Number(m.none||0)} without estimate/value.</div></div>`
  }
  function allocationOutlook(s){
    const o=s?.financialOutlook;if(!o)return'';const rows=o.rows||[],t=o.totals||{};
    const metrics=[['Billable capacity','capacity'],['Funded allocation','funded'],['Unfunded allocation','unfunded'],['Remaining / over capacity','remaining']];
    return `<div class="financial-dashboard">${sectionTitle('Allocation outlook','Planning Window · phased allocation forecast only')}<div class="grid kpis financial-kpis">${kpi('Billable capacity',moneyCompact(t.capacity),'Rate-bearing capacity in visible planning months')}${kpi('Funded allocations',moneyCompact(t.funded),'Phased allocations on funded Demand')}${kpi('Unfunded allocations',moneyCompact(t.unfunded),'Phased allocations without confirmed funding')}${kpi('Remaining capacity',moneyCompact(t.remaining),'Billable capacity less all phased allocations')}</div>${rows.length?`<div class="table-wrap"><table class="financial-outlook-table"><thead><tr><th>Metric</th>${rows.map(r=>`<th>${esc(r.label||r.month||'')}</th>`).join('')}<th>Window</th></tr></thead><tbody>${metrics.map(([label,key])=>`<tr><td><strong>${esc(label)}</strong></td>${rows.map(r=>`<td>${esc(moneyCompact(r[key]))}</td>`).join('')}<td><strong>${esc(moneyCompact(t[key]))}</strong></td></tr>`).join('')}</tbody></table></div>`:''}<div class="settings-note">Allocation values are forecasts, not Actuals. Past stored allocation periods remain in allocation totals until an Actuals source is introduced.</div></div>`
  }
  function narrative(report){
    const entries=report?.entries||[];
    return `${sectionTitle('Architecture Status Report')}<div class="report-narrative-list">${entries.length?entries.map(e=>{const health=normalizeHealth(e.health||e.rag),tone=healthTone(health);return `<article class="report-entry report-health-${tone}" data-health="${esc(health||'Unset')}"><div class="report-entry-head report-health-head"><div><strong>${esc(e.title||e.demandId||'Demand')}</strong><div class="muted">${esc(e.demandId||'')}${e.owner?` · ${esc(e.owner)}`:''}${e.service?` · ${esc(e.service)}`:''}</div></div><div class="report-health-label" aria-label="Health: ${esc(health||'Unset')}"><span class="health-dot rag-dot health-${tone}"></span><strong>${esc(health||'Health not set')}</strong></div></div><div class="report-entry-body"><div class="report-narrative"><h4>Status Update</h4><p>${esc(e.statusUpdate||'—')}</p></div><div class="report-narrative"><h4>Achievements</h4><p>${esc(e.achievements||'—')}</p></div><div class="report-narrative"><h4>Issues / Escalations</h4><p>${esc(e.issues||'—')}</p></div></div></article>`}).join(''):'<div class="notice">No narrative entries were captured for this report.</div>'}</div>`
  }
  function renderReport(report,{showHeader=true}={}){
    if(!report)return'<div class="notice">Report is unavailable.</div>';
    const status=report.status||'Published',published=report.publishedAt?` · Published ${formatDate(report.publishedAt)}`:'',revision=report.revision?` · Revision ${Number(report.revision)}`:'';
    const header=showHeader?`<div class="section-title report-title"><div><h1>Architecture Status Report</h1><div class="muted">${esc(report.reportingDate||'')}${esc(published)}${esc(revision)}</div></div><span class="pill ${status==='Published'||status==='Final'?'green':'amber'}">${esc(status)}</span></div>`:'';
    const s=report.dashboardSnapshot||null;
    return `<div class="report-card shared-report-renderer">${header}${demandHighlights(s)}${capacityOutlook(s)}${portfolioForecast(s)}${allocationOutlook(s)}${narrative(report)}</div>`
  }
  window.AmoReportRenderer={renderReport,normalizeHealth,healthTone,moneyCompact};
})();
