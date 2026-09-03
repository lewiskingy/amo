function renderResource(){
  const rm=window.ReportingModel,months=planningPeriods(),activeTeam=db.team.filter(t=>t.active!==false),capacity=teamCapacity(),unmet=unresolvedWithoutAllocation();
  const reportingReady=!!rm?.ensureLoaded?.();const reported=m=>reportingReady&&rm?.reportedTotalFte?rm.reportedTotalFte(m):allocatedTotal(m),basis=m=>reportingReady?rm?.periodBasis?.(m)||'forecast':'forecast',actual=m=>basis(m)==='actual';
  const peak=months.map(m=>({m,used:reported(m)})).sort((a,b)=>b.used-a.used)[0]||{m:months[0],used:0},overMonths=months.filter(m=>reported(m)>capacity).length;
  const now=new Date(),calendarCurrent=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,currentMonth=months.includes(calendarCurrent)?calendarCurrent:(months[0]||calendarCurrent),currentUsed=reported(currentMonth),currentBasis=reportingReady?(actual(currentMonth)?'actual effort':'forecast allocation'):'loading Actuals';
  const bootstrapState=window.__amoReportingModelState||'',coverage=!rm?(bootstrapState==='error'?'Actuals reporting unavailable':'Loading Actuals reporting…'):reportingReady?(rm.coverageLabel?.()||'No Actuals loaded'):'Loading Actuals…';
  $('resourceKpis').innerHTML=[['Available capacity',`${capacity.toFixed(1)} FTE`,'Active team baseline'],['Current reported effort',`${currentUsed.toFixed(1)} FTE`,`${monthLabel(currentMonth)} ${currentBasis}`],['Unmet demand',unmet.length,'Unresolved items with no resource'],['Over-capacity periods',overMonths,peak.m?`Peak ${monthLabel(peak.m)}: ${peak.used.toFixed(1)} FTE`:'No planning periods']].map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('');
  const notice=$('resource')?.querySelector('.notice');if(notice)notice.innerHTML=`Reporting periods follow the <strong>Planning Window</strong>. <strong>${coverage}</strong>. Months with imported Actuals use observed effort; other months use allocation forecast. Allocations remain unchanged as the planning baseline.`;
  const monthHead=m=>`${monthLabel(m)}<br><span class="muted" style="font-size:.66rem">${reportingReady?(actual(m)?'ACTUAL':'FORECAST'):'LOADING'}</span>`,metric=(label,cls,fn)=>`<tr class="metric-row ${cls}"><td>${label}</td>${months.map(m=>`<td>${fn(m)}</td>`).join('')}</tr>`;
  $('resourceSummaryTable').innerHTML=`<thead><tr><th>Metric</th>${months.map(m=>`<th>${monthHead(m)}</th>`).join('')}</tr></thead><tbody>`+metric('Available capacity','metric-capacity',()=>`${capacity.toFixed(1)} FTE`)+metric('Reported effort','metric-allocated',m=>`${reported(m).toFixed(1)} FTE`)+metric('Remaining / over capacity',months.some(m=>reported(m)>capacity)?'metric-gap over':'metric-gap',m=>{const gap=capacity-reported(m);return `<span class="${gap<0?'over':''}">${gap>=0?'+':''}${gap.toFixed(1)} FTE</span>`})+metric('Utilisation','',m=>{const pct=capacity?Math.round(reported(m)/capacity*100):0;return `<span class="pill ${pct===0?'gray':pct>100?'red':pct>=85?'amber':'green'}">${pct}%</span>`})+`</tbody>`;
  $('unmetDemandPanel').innerHTML=!workspaceHandle?'<span class="muted">Open a workspace folder to load data.</span>':unmet.length?`<ul class="unmet-list">${unmet.map(d=>`<li><strong>${d.id}</strong> — ${d.title}<br><span class="muted">${d.priority||'—'} · ${d.service||'—'} · ${d.status||'—'}</span></li>`).join('')}</ul>`:'<span class="pill green">No unresolved demand without resource allocation</span>';

  const latestActual=reportingReady?rm?.latestActualMonth?.():null,signals=latestActual?rm.managementSignals(latestActual):null,signalPeriod=latestActual?monthLabel(`${latestActual}-01`):reportingReady?'No Actuals period':'Loading Actuals…';
  $('resourceSignals').innerHTML=signals?[
    ['No Actuals against plan',signals.noActualPeople.length],
    ['Low overall effort',signals.lowOverallPeople.length],
    ['Effort redirected',signals.redirectedPeople.length],
    ['Unplanned Demand effort',signals.unplannedPeople.length],
    ['People over capacity',signals.overCapacityPeople.length],
    ['Unmapped project facts',signals.unmappedProjectFacts.length]
  ].map(([l,v])=>`<div class="mini-stat"><span>${l}<br><small class="muted">${signalPeriod}</small></span><strong>${v}</strong></div>`).join(''):`<div class="mini-stat"><span>Actuals signals<br><small class="muted">${signalPeriod}</small></span><strong>—</strong></div>`;

  const personUsed=(id,m)=>reportingReady&&rm?.reportedFte?rm.reportedFte(id,null,m):allocationFor(id,m);
  $('resourceUtilTable').innerHTML=`<thead><tr><th>Team member</th><th>Available FTE</th>${months.map(m=>`<th>${monthHead(m)}</th>`).join('')}</tr></thead><tbody>${activeTeam.map(t=>`<tr><td><strong>${t.name}</strong><br><span class="muted">${t.role||''}</span></td><td>${(Number(t.fte)||0).toFixed(1)}</td>${months.map(m=>{const used=personUsed(t.id,m),cap=Number(t.fte)||0,pct=cap?Math.round(used/cap*100):0,forecast=reportingReady?(rm?.forecastFte?.(t.id,null,m)??allocationFor(t.id,m)):allocationFor(t.id,m),variance=actual(m)?used-forecast:null,pm=actual(m)&&rm?.personMonthSummary?rm.personMonthSummary(t.id,m):null,labels=[];if(pm?.noActual)labels.push('No Actuals');else if(pm?.lowOverall)labels.push('Low overall');if(pm?.redirected)labels.push('Redirected');if(pm?.unplannedFte>=rm.SIGNAL_THRESHOLDS.minimumFte)labels.push('Unplanned');if(pm?.overCapacity)labels.push('Over capacity');return `<td><span class="pill ${pct===0?'gray':pct>100?'red':pct>=85?'amber':'green'}">${pct}%</span><br><span class="muted">${used.toFixed(1)} FTE${variance==null?'':` · plan ${forecast.toFixed(1)} · Δ ${variance>=0?'+':''}${variance.toFixed(1)}`}</span>${labels.length?`<br><span class="muted"><strong>${labels.join(' · ')}</strong></span>`:''}</td>`}).join('')}</tr>`).join('')}</tbody>`;

  const allocRows=[...db.allocations].sort((a,b)=>`${a.demandId}|${person(a.teamMemberId)?.name||a.teamMemberId}`.localeCompare(`${b.demandId}|${person(b.teamMemberId)?.name||b.teamMemberId}`));
  $('resourceAllocationDetail').innerHTML=`<thead><tr><th>Demand</th><th>Person</th>${months.map(m=>`<th>${monthHead(m)}</th>`).join('')}</tr></thead><tbody>${allocRows.map(a=>{const d=demandById(a.demandId);return `<tr><td><strong>${a.demandId}</strong><br><span class="muted">${d?.title||'Unknown demand'}</span></td><td>${person(a.teamMemberId)?.name||a.teamMemberId}</td>${months.map(m=>{const forecast=Number(a.forecast?.[m])||0;if(!actual(m))return`<td><strong>${Math.round(forecast*100)}%</strong><br><span class="muted">${reportingReady?'Forecast':'Loading Actuals…'}</span></td>`;const observed=rm?.actualFte?.(a.teamMemberId,a.demandId,m)||0,variance=observed-forecast,pm=rm?.personMonthSummary?.(a.teamMemberId,m),row=pm?.demandRows?.find(x=>x.demandId===a.demandId),notes=[];if(row?.unplanned)notes.push('Unplanned');if(pm?.redirected&&forecast-observed>=rm.SIGNAL_THRESHOLDS.minimumFte)notes.push('Redirected elsewhere');else if(pm?.noActual&&forecast>=rm.SIGNAL_THRESHOLDS.minimumFte)notes.push('No Actuals');return`<td><strong>${Math.round(observed*100)}%</strong><br><span class="muted">Actual · plan ${Math.round(forecast*100)}% · Δ ${variance>=0?'+':''}${Math.round(variance*100)}%</span>${notes.length?`<br><span class="muted"><strong>${notes.join(' · ')}</strong></span>`:''}</td>`}).join('')}</tr>`}).join('')}</tbody>`;
  if(reportingReady)rm?.renderIntegratedViews?.();
}

/* Actuals load asynchronously from the workspace repository. Re-render Resource Plan when the
   canonical reporting model announces that its cache has been hydrated or refreshed. */
window.addEventListener('amo:reporting-model-updated',event=>{
  if(!workspaceHandle)return;
  if(event?.detail?.error){const notice=$('resource')?.querySelector('.notice');if(notice)notice.innerHTML=`<strong>Actuals reporting unavailable:</strong> ${escHtml(event.detail.error)}. Allocation Forecast has not been presented as Actuals.`;return}
  renderResource()
});

/* ReportingModel is a first-class reporting dependency. It is still loaded without changing the
   large application shell, but the request is now tied to the deployed build rather than a bare,
   cache-prone URL or the later-loaded amoAsset helper. */
(function loadReportingModel(){
  if(window.ReportingModel){window.__amoReportingModelState='loaded';return}
  if(document.querySelector('script[data-amo-reporting-model]'))return;
  window.__amoReportingModelState='loading';
  const s=document.createElement('script'),build=String(window.AMO_CONFIG?.buildId||'').trim(),base='app-reporting-model.js';
  s.src=build?`${base}?v=${encodeURIComponent(build)}`:base;s.dataset.amoReportingModel='true';s.async=false;
  s.onload=()=>{window.__amoReportingModelState=window.ReportingModel?'loaded':'error';if(window.ReportingModel){window.ReportingModel.ensureLoaded?.();if(typeof refreshAll==='function'&&workspaceHandle)refreshAll()}else if(workspaceHandle)renderResource()};
  s.onerror=()=>{window.__amoReportingModelState='error';console.error(`Could not load ${s.src}`);if(workspaceHandle)renderResource()};
  document.head.appendChild(s)
})();
