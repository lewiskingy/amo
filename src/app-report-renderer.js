/* Pure Status Report renderer shared by the AMO workspace UI and the lightweight /reports viewer.
   It consumes only a report snapshot. Historical reports are scoped by projecting the persisted
   snapshot; the renderer never reads or recalculates from the live workspace. */
(function initAmoReportRenderer(){
  if(window.AmoReportRenderer)return;
  const ORG='organization',ALL='department';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const normalizeHealth=v=>({Green:'On Track',Amber:'At Risk',Red:'Off Track','On Track':'On Track','At Risk':'At Risk','Off Track':'Off Track'}[String(v||'').trim()]||String(v||'').trim());
  const healthTone=v=>{const h=normalizeHealth(v);return h==='On Track'?'green':h==='At Risk'?'amber':h==='Off Track'?'red':'unset'};
  const moneyCompact=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const num=(n,d=0)=>Number(n||0).toFixed(d);
  const formatDate=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-GB')};
  const sectionTitle=(title,note='')=>`<div class="section-title report-section-title"><h2>${esc(title)}</h2>${note?`<span class="muted">${esc(note)}</span>`:''}</div>`;
  const kpi=(label,value,sub='')=>`<div class="card report-kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div>${sub?`<div class="kpi-sub">${esc(sub)}</div>`:''}</div>`;

  function normalizeScope(scope={}){
    const departmentId=scope.departmentId||scope.departmentScopeId||ORG;
    const teamId=departmentId===ORG?ALL:(scope.teamId||scope.teamScopeId||ALL);
    return{departmentId,teamId,departmentName:scope.departmentName||'',teamName:scope.teamName||'',label:scope.label||scope.scopeName||''}
  }
  function scopeLabel(scope){
    if(scope.label)return scope.label;
    if(scope.departmentId===ORG)return'Whole organisation';
    if(scope.teamId===ALL)return scope.departmentName||'Whole department';
    return[scope.departmentName,scope.teamName].filter(Boolean).join(' · ')||scope.teamName||scope.teamId
  }
  function entryDepartmentId(entry,teamsById={}){return entry?.departmentId||teamsById?.[entry?.teamId]?.departmentId||''}
  function projectReport(report,scopeInput={},catalog={}){
    if(!report)return report;
    const scope=normalizeScope(scopeInput),copy=clone(report),teamsById=catalog.teamsById||{};
    copy.entries=(report.entries||[]).filter(entry=>{
      if(scope.departmentId!==ORG&&entryDepartmentId(entry,teamsById)!==scope.departmentId)return false;
      return scope.teamId===ALL||entry.teamId===scope.teamId
    });
    const snapshots=report.dashboardSnapshots||{};
    let snapshot=report.dashboardSnapshot||null;
    if(scope.teamId!==ALL)snapshot=snapshots.teams?.[scope.teamId]||snapshot;
    else if(scope.departmentId!==ORG)snapshot=snapshots.departments?.[scope.departmentId]||(report.departmentScopeId===scope.departmentId?snapshots.department:null)||snapshot;
    else snapshot=snapshots.organization||snapshots.department||snapshot;
    copy.dashboardSnapshot=snapshot;
    copy.departmentScopeId=scope.departmentId;copy.teamScopeId=scope.teamId;copy.scopeName=scopeLabel(scope);
    return copy
  }

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
    return defs.length?`${sectionTitle('Demand highlights','Headline portfolio position captured for this reporting cycle.')}<div class="grid kpis report-headline-kpis">${defs.map(([l,v,sub])=>kpi(l,String(v),sub)).join('')}</div>`:''
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
  function healthSummary(entries){
    const totals={'On Track':0,'At Risk':0,'Off Track':0,Unset:0};
    entries.forEach(e=>{const h=normalizeHealth(e.health||e.rag);if(Object.prototype.hasOwnProperty.call(totals,h))totals[h]++;else totals.Unset++});
    return `<div class="report-health-summary" aria-label="Health summary"><div class="report-health-summary-title"><strong>Health overview</strong><span class="muted">${entries.length} reported item${entries.length===1?'':'s'}</span></div><div class="report-health-summary-items">${[['On Track','green'],['At Risk','amber'],['Off Track','red'],['Unset','unset']].map(([label,tone])=>`<div class="report-health-summary-item report-health-summary-${tone}"><span class="health-dot health-${tone}"></span><span>${label}</span><strong>${totals[label]}</strong></div>`).join('')}</div></div>`
  }
  function narrative(report){
    const entries=report?.entries||[];
    return `${sectionTitle('Architecture Status Report','Demand-level Health and management narrative.')} ${healthSummary(entries)}<div class="report-narrative-list">${entries.length?entries.map(e=>{const health=normalizeHealth(e.health||e.rag),tone=healthTone(health);return `<article class="report-entry report-health-${tone}" data-health="${esc(health||'Unset')}"><div class="report-entry-head report-health-head"><div><strong>${esc(e.title||e.demandId||'Demand')}</strong><div class="muted">${esc(e.demandId||'')}${e.owner?` · ${esc(e.owner)}`:''}${e.service?` · ${esc(e.service)}`:''}</div></div><div class="report-health-label" aria-label="Health: ${esc(health||'Unset')}"><span class="health-dot health-${tone}"></span><strong>${esc(health||'Health not set')}</strong></div></div><div class="report-entry-body"><div class="report-narrative"><h4>Status Update</h4><p>${esc(e.statusUpdate||'—')}</p></div><div class="report-narrative"><h4>Achievements</h4><p>${esc(e.achievements||'—')}</p></div><div class="report-narrative"><h4>Issues / Escalations</h4><p>${esc(e.issues||'—')}</p></div></div></article>`}).join(''):'<div class="notice">No narrative entries were captured for this scope.</div>'}</div>`
  }
  function renderReport(report,{showHeader=true,scope=null,catalog={}}={}){
    if(!report)return'<div class="notice">Report is unavailable.</div>';
    const projected=scope?projectReport(report,scope,catalog):report;
    const status=projected.status||'Published',published=projected.publishedAt?` · Published ${formatDate(projected.publishedAt)}`:'',revision=projected.revision?` · Revision ${Number(projected.revision)}`:'',scopeText=projected.scopeName?` · ${projected.scopeName}`:'';
    const isDraft=!['Published','Final'].includes(status);
    const header=showHeader?`<header class="report-hero ${isDraft?'report-hero-draft':'report-hero-published'}"><div><div class="report-eyebrow">Architecture Management Office</div><h1>Architecture Status Report</h1><div class="report-meta">${esc(projected.reportingDate||'')}${esc(scopeText)}${esc(published)}${esc(revision)}</div></div><span class="pill ${isDraft?'amber':'green'}">${esc(status)}</span></header>`:'';
    const s=projected.dashboardSnapshot||null;
    return `<div class="report-card shared-report-renderer">${header}${demandHighlights(s)}${capacityOutlook(s)}${portfolioForecast(s)}${allocationOutlook(s)}${narrative(projected)}</div>`
  }
  window.AmoReportRenderer={renderReport,projectReport,normalizeScope,scopeLabel,normalizeHealth,healthTone,moneyCompact,ORG,ALL};
})();
