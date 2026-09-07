/* Defined Demand planning and funding summary.
   Initial ROM belongs to Demand; refined delivery estimate belongs to child Work Packages;
   allocation forecast and Actuals remain independent reporting measures.
   Effort/cost valuation is delegated to the canonical ReportingModel. */
(function initDemandPlanning(){
  const FUNDING_STATUSES=['Not Assessed','Estimate Only','Funding Requested','Confirmed','Unfunded','Not Required'];
  const numberOrNull=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(v)||0);
  const days=v=>{const n=numberOrNull(v);return n==null?'—':`${Number.isInteger(n)?n:n.toFixed(1)}d`};
  const reportingModel=()=>window.ReportingModel||null;

  function estimatePosition(d){
    const rm=reportingModel(),canonical=rm?.estimateForDemand?.(d.id);
    if(canonical)return canonical;
    const s=window.WorkPackages?.summaryForDemand?.(d.id),initialRomDays=numberOrNull(d?.initialEstimate?.estimatedDays),wpEstimateDays=s?.estimatedCount?numberOrNull(s.estimatedEffortDays):null;
    return{initialSize:d?.initialEstimate?.size||'',initialRomDays,initialRomCost:null,wpCount:s?.count||0,wpEstimatedCount:s?.estimatedCount||0,wpEstimateDays,wpEstimateCost:null}
  }
  function demandForecast(d){
    const rm=reportingModel(),months=planningMonths();
    if(!rm?.forecastDays||!rm?.forecastCost)return{days:0,value:null};
    return{days:months.reduce((sum,m)=>sum+(Number(rm.forecastDays(null,d.id,m))||0),0),value:months.reduce((sum,m)=>sum+(Number(rm.forecastCost(null,d.id,m))||0),0)}
  }
  function initialRom(d){return estimatePosition(d).initialRomDays}
  function workPackageEstimate(d){const e=estimatePosition(d);return{days:e.wpEstimateDays,count:e.wpCount,estimatedCount:e.wpEstimatedCount,value:e.wpEstimateCost}}
  function fundingStatus(d){return FUNDING_STATUSES.includes(d?.funding?.status)?d.funding.status:'Not Assessed'}
  function fundingValues(d){return{approvedDays:numberOrNull(d?.funding?.approvedDays),approvedBudget:numberOrNull(d?.funding?.approvedBudget)}}
  function auditUser(){try{return typeof localWorkspaceUser==='function'?(localWorkspaceUser()?.displayName||localWorkspaceUser()?.id||'Unknown user'):'Unknown user'}catch(_){return'Unknown user'}}
  function fundingSnapshot(d){const f=fundingValues(d);return{status:fundingStatus(d),approvedDays:f.approvedDays,approvedBudget:f.approvedBudget,projectNumber:String(d?.projectNumber||''),changedAt:new Date().toISOString(),changedBy:auditUser()}}
  function planningSignals(d){const out=[],estimate=estimatePosition(d),initial=estimate.initialRomDays,wp={days:estimate.wpEstimateDays,count:estimate.wpCount,estimatedCount:estimate.wpEstimatedCount},forecast=demandForecast(d),fund=fundingValues(d),fs=fundingStatus(d);if(!d?.initialEstimate?.size)out.push('Initial size not assessed');if(wp.count&&!wp.estimatedCount)out.push('Work Packages not estimated');if(wp.days!=null&&forecast.days>wp.days+0.5)out.push(`Allocation forecast ${days(forecast.days-wp.days)} above Work Package estimate`);if(fs==='Confirmed'&&!String(d.projectNumber||'').trim())out.push('Funding confirmed without Project Number');if(fund.approvedDays!=null&&forecast.days>fund.approvedDays+0.5)out.push(`Allocation forecast ${days(forecast.days-fund.approvedDays)} above funded days`);if(initial!=null&&wp.days!=null&&Math.abs(wp.days-initial)>0.5)out.push(`Delivery estimate ${wp.days>initial?'above':'below'} initial ROM by ${days(Math.abs(wp.days-initial))}`);return out}
  function renderSection(r){
    const estimate=estimatePosition(r),initial=estimate.initialRomDays,wp={days:estimate.wpEstimateDays,count:estimate.wpCount,estimatedCount:estimate.wpEstimatedCount,value:estimate.wpEstimateCost},forecast=demandForecast(r),fund=fundingValues(r),signals=planningSignals(r);
    const history=[...(r.fundingHistory||[])].slice(-5).reverse(),indicative=v=>v==null?'—':`~${money(v)}`;
    const wpDetail=wp.count?(wp.estimatedCount?`${wp.estimatedCount}/${wp.count} packages estimated · ${indicative(wp.value)}`:`${wp.estimatedCount}/${wp.count} packages estimated`):'No packages yet';
    const summary=`<div class="field full planning-summary"><label>Planning position</label><div class="planning-summary-grid"><div><span>Initial ROM</span><strong>${estimate.initialSize?`${escHtml(estimate.initialSize)} · `:''}${escHtml(days(initial))}</strong><small>${initial!=null?escHtml(indicative(estimate.initialRomCost)):'Early sizing'}</small></div><div><span>Work Package estimate</span><strong>${escHtml(days(wp.days))}</strong><small>${escHtml(wpDetail)}</small></div><div><span>Allocation forecast</span><strong>${escHtml(days(forecast.days))}</strong><small>${forecast.value==null?'—':escHtml(money(forecast.value))}</small></div><div><span>Approved funding</span><strong>${escHtml(fund.approvedDays!=null?days(fund.approvedDays):'—')}</strong><small>${fund.approvedBudget!=null?escHtml(money(fund.approvedBudget)):'—'}</small></div></div><div class="planning-state"><span class="pill blue">${escHtml(fundingStatus(r))}</span>${signals.map(s=>`<span class="pill amber">${escHtml(s)}</span>`).join('')}</div></div>`;
    const fields=`${modalField('Funding Status','funding.status',fundingStatus(r),'select',FUNDING_STATUSES)}${modalField('Approved Funding (days)','funding.approvedDays',r.funding?.approvedDays??'','number')}${modalField('Approved Funding (GBP)','funding.approvedBudget',r.funding?.approvedBudget??'','number')}`;
    const historyHtml=recordModalState.mode==='view'&&history.length?`<div class="field full"><label>Funding History</label><div class="table-wrap"><table><thead><tr><th>When</th><th>Status</th><th>Approved</th><th>Project Number</th><th>By</th></tr></thead><tbody>${history.map(h=>`<tr><td>${escHtml(h.changedAt?new Date(h.changedAt).toLocaleString():'—')}</td><td>${escHtml(h.status||'')}</td><td>${escHtml(h.approvedDays!=null?days(h.approvedDays):'—')} · ${escHtml(h.approvedBudget!=null?money(h.approvedBudget):'—')}</td><td>${escHtml(h.projectNumber||h.projectCode||'—')}</td><td>${escHtml(h.changedBy||'')}</td></tr>`).join('')}</tbody></table></div></div>`:'';
    return `<div class="field full view-section"><h3>Planning & funding</h3><div class="muted">Initial ROM is retained on Defined Demand; Work Package estimates are the refined delivery estimate.</div></div>${summary}${fields}${historyHtml}`
  }
  function afterRender(body,state){if(state.mode!=='edit')return;for(const key of ['funding.approvedDays','funding.approvedBudget'])body.querySelector(`[data-modal-field="${key}"]`)?.addEventListener('change',()=>{state.draft=readModalDraft()})}
  function beforeSave(next,old){next.funding=next.funding||{};if(!FUNDING_STATUSES.includes(next.funding.status))next.funding.status='Not Assessed';for(const key of ['approvedDays','approvedBudget'])next.funding[key]=numberOrNull(next.funding[key]);const before=old?{status:fundingStatus(old),...fundingValues(old),projectNumber:String(old.projectNumber||'')}:null,after={status:fundingStatus(next),...fundingValues(next),projectNumber:String(next.projectNumber||'')};next.fundingHistory=Array.isArray(old?.fundingHistory)?clone(old.fundingHistory):Array.isArray(next.fundingHistory)?clone(next.fundingHistory):[];if((!before&&(after.status!=='Not Assessed'||after.approvedDays!=null||after.approvedBudget!=null))||(before&&JSON.stringify(before)!==JSON.stringify(after)))next.fundingHistory.push(fundingSnapshot(next));return next}
  window.amoDemandForecast=demandForecast;window.amoPlanningSignals=planningSignals;window.AmoDemandPlanning={renderSection,afterRender,beforeSave,demandForecast,initialRom,workPackageEstimate,planningSignals,estimatePosition};
})();
