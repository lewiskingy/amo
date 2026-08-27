/* Financial planning and forecast semantics.
   Forecast maturity: ROM -> Estimate -> complete Allocation Forecast -> future Actuals + remaining Forecast.
   Role is the rate-bearing entity for allocations: Allocation -> Person -> roleId -> Role.dayRate.
   ROM/Estimate £ are explicit source estimates because day estimates alone cannot infer a role mix. */
(function initFinancialPlanning(){
  if(window.__amoFinancialPlanningLoaded)return;window.__amoFinancialPlanningLoaded=true;

  const FUNDING_STATUSES=['Funded','Funding Pending','Unfunded','Non-billable'];
  const ALLOCATION_FORECAST_STATUSES=['Not Planned','Partial','Complete'];
  const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
  const moneyCompact=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const finiteAmount=v=>v===''||v==null?null:(Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null);
  const currentMonth=()=>normalizeMonthStart(new Date().toISOString().slice(0,10));

  function workingDays(month){const m=normalizeMonthStart(month);if(!m)return 0;const [y,mo]=m.split('-').map(Number),last=new Date(Date.UTC(y,mo,0)).getUTCDate(),d=new Date(Date.UTC(y,mo-1,1));let days=0;for(let i=1;i<=last;i++){d.setUTCDate(i);const dow=d.getUTCDay();if(dow!==0&&dow!==6)days++}return days}
  function estimateInfo(d){const full=Number(d?.workPackage?.executionEstimateDays);if(Number.isFinite(full)&&full>0)return{days:full,kind:'Estimate'};const rom=Number(d?.triage?.romDays);if(Number.isFinite(rom)&&rom>0)return{days:rom,kind:'ROM'};return{days:0,kind:null}}
  function romValue(d){return finiteAmount(d?.triage?.romAmount)}
  function executionEstimateValue(d){return finiteAmount(d?.workPackage?.executionEstimateAmount)}
  function hasAnyEstimate(d){return estimateInfo(d).days>0||romValue(d)!=null||executionEstimateValue(d)!=null}
  function scopedPeopleForFinance(){return(typeof scopedPeople==='function'?scopedPeople():db.team).filter(p=>p.active!==false)}
  function scopedDemandForFinance(){return typeof scopedDemand==='function'?scopedDemand():db.demand}
  function scopedAllocationsForFinance(){return typeof scopedAllocations==='function'?scopedAllocations():db.allocations}
  function demandAllocations(demandId,scoped=false){const rows=scoped?scopedAllocationsForFinance():db.allocations;return rows.filter(a=>a.demandId===demandId)}
  function allocationHasForecast(a){return Object.values(a?.forecast||{}).some(v=>(Number(v)||0)>0)}
  function allocationForecastStatus(d){const explicit=d?.forecast?.allocationStatus;if(ALLOCATION_FORECAST_STATUSES.includes(explicit))return explicit;return demandAllocations(d.id).some(allocationHasForecast)?'Partial':'Not Planned'}
  function allocationValue(a,month){const p=person(a.teamMemberId),fte=Number(a.forecast?.[normalizeMonthStart(month)])||0;return p?fte*workingDays(month)*(Number(personRoleDayRate?.(p))||0):0}
  function allocationPersonDaysForMonths(a,months){return months.reduce((sum,m)=>sum+(Number(a.forecast?.[m])||0)*workingDays(m),0)}
  function allocationMonths(a){return [...new Set(Object.keys(a?.forecast||{}).map(normalizeMonthStart).filter(Boolean))].sort()}
  function allocationValueForMonths(a,months){return months.reduce((sum,m)=>sum+allocationValue(a,m),0)}
  function allocationTotalForecastValue(a){return allocationValueForMonths(a,allocationMonths(a))}
  function allocationPlanningWindowValue(a){return allocationValueForMonths(a,planningPeriods())}
  function allocationFutureValue(a,asOf=currentMonth()){return allocationValueForMonths(a,allocationMonths(a).filter(m=>m>=asOf))}
  function demandAllocationValue(demandId,valueFn){return demandAllocations(demandId).reduce((sum,a)=>sum+valueFn(a),0)}
  function demandAllocationTotalValue(demandId){return demandAllocationValue(demandId,allocationTotalForecastValue)}
  function demandPlanningWindowAllocationValue(demandId){return demandAllocationValue(demandId,allocationPlanningWindowValue)}
  function demandFutureAllocationValue(demandId,asOf=currentMonth()){return demandAllocationValue(demandId,a=>allocationFutureValue(a,asOf))}
  function demandAllocationWeightedRate(demandId){const rows=demandAllocations(demandId),months=[...new Set(rows.flatMap(allocationMonths))];let weighted=0,totalDays=0;for(const a of rows){const p=person(a.teamMemberId),days=allocationPersonDaysForMonths(a,months);if(!p||days<=0)continue;weighted+=days*(Number(personRoleDayRate?.(p))||0);totalDays+=days}return totalDays>0?weighted/totalDays:null}

  function currentForecast(d){
    const allocationStatus=allocationForecastStatus(d),allocationTotal=demandAllocationTotalValue(d.id),estimate=executionEstimateValue(d),rom=romValue(d);
    if(allocationStatus==='Complete')return{value:allocationTotal,basis:'Allocations',allocationStatus,isResolved:true};
    if(estimate!=null)return{value:estimate,basis:'Estimate',allocationStatus,isResolved:true};
    if(rom!=null)return{value:rom,basis:'ROM',allocationStatus,isResolved:true};
    const info=estimateInfo(d);return{value:null,basis:info.kind||'None',allocationStatus,isResolved:false};
  }
  function estimatedValue(d){return currentForecast(d).value}
  function fundingStatus(d){return FUNDING_STATUSES.includes(d?.funding?.status)?d.funding.status:'Unfunded'}
  function hasConfirmedFunding(d){return fundingStatus(d)==='Funded'}
  function needsFunding(d){if(!hasAnyEstimate(d)||hasConfirmedFunding(d)||fundingStatus(d)==='Non-billable')return false;const f=currentForecast(d),partialAllocated=demandPlanningWindowAllocationValue(d.id);if(f.value===0&&partialAllocated===0)return false;return true}

  function monthlyCapacityValue(month){const days=workingDays(month);return scopedPeopleForFinance().reduce((sum,p)=>sum+(Number(p.fte)||0)*days*(Number(personRoleDayRate?.(p))||0),0)}
  function monthlyAllocatedValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>sum+allocationValue(a,month),0)}
  function monthlyFundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&hasConfirmedFunding(d)?allocationValue(a,month):0)},0)}
  function monthlyUnfundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&!hasConfirmedFunding(d)&&fundingStatus(d)!=='Non-billable'?allocationValue(a,month):0)},0)}
  function financialOutlook(){const rows=planningPeriods().map(month=>{const capacity=monthlyCapacityValue(month),allocated=monthlyAllocatedValue(month),funded=monthlyFundedAllocationValue(month),unfunded=monthlyUnfundedAllocationValue(month);return{month,label:monthLabel(month),capacity,allocated,funded,unfunded,remaining:capacity-allocated}});const total=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);return{scope:'planningWindow',rows,totals:{capacity:total('capacity'),allocated:total('allocated'),funded:total('funded'),unfunded:total('unfunded'),remaining:total('remaining')}}}
  function portfolioForecastSummary(){const active=scopedDemandForFinance().filter(isOpenDemand),resolved=active.map(d=>({d,forecast:currentForecast(d)})),billable=resolved.filter(x=>fundingStatus(x.d)!=='Non-billable'),sum=rows=>rows.reduce((n,x)=>n+(x.forecast.value??0),0),futureAllocated=scopedAllocationsForFinance().reduce((n,a)=>n+allocationFutureValue(a),0);return{currentForecast:sum(billable),fundedForecast:sum(billable.filter(x=>hasConfirmedFunding(x.d))),unfundedForecast:sum(billable.filter(x=>!hasConfirmedFunding(x.d))),futureAllocated,unresolvedValue:billable.filter(x=>x.forecast.value==null).length,maturity:{allocations:resolved.filter(x=>x.forecast.basis==='Allocations').length,estimate:resolved.filter(x=>x.forecast.basis==='Estimate').length,rom:resolved.filter(x=>x.forecast.basis==='ROM').length,none:resolved.filter(x=>x.forecast.basis==='None').length}}}

  window.AmoFinance={FUNDING_STATUSES,ALLOCATION_FORECAST_STATUSES,workingDays,estimateInfo,romValue,executionEstimateValue,hasAnyEstimate,allocationForecastStatus,currentForecast,estimatedValue,fundingStatus,hasConfirmedFunding,needsFunding,allocationValue,allocationTotalForecastValue,allocationPlanningWindowValue,allocationFutureValue,demandAllocationTotalValue,demandPlanningWindowAllocationValue,demandFutureAllocationValue,demandAllocationWeightedRate,monthlyCapacityValue,monthlyAllocatedValue,monthlyFundedAllocationValue,monthlyUnfundedAllocationValue,financialOutlook,portfolioForecastSummary,money,moneyCompact};

  const financialDemandColumns=()=>[
    {key:'triage.romAmount',label:'ROM £',type:'number',editable:true},
    {key:'workPackage.executionEstimateDays',label:'Estimate Days',type:'number',editable:true},
    {key:'workPackage.executionEstimateAmount',label:'Estimate £',type:'number',editable:true},
    {key:'_forecastValue',label:'Forecast £',type:'number',editable:false},
    {key:'_forecastBasis',label:'Basis',type:'text',editable:false},
    {key:'forecast.allocationStatus',label:'Allocation Forecast',type:'select',values:()=>ALLOCATION_FORECAST_STATUSES,editable:true},
    {key:'funding.status',label:'Funding',type:'select',values:()=>FUNDING_STATUSES,editable:true}
  ];
  function addDemandFinancialColumns(cols){if(!Array.isArray(cols)||cols.some(c=>c.key==='_forecastValue'))return;const romIndex=cols.findIndex(c=>c.key==='triage.romDays'),at=romIndex>=0?romIndex+1:cols.length;cols.splice(at,0,...financialDemandColumns())}
  if(typeof demandCols!=='undefined')addDemandFinancialColumns(demandCols);
  if(typeof demandTailColumns!=='undefined')addDemandFinancialColumns(demandTailColumns);

  if(typeof displayVal==='function'){const base=displayVal;displayVal=function(row,col){if(col.key==='_forecastValue')return currentForecast(row).value;if(col.key==='_forecastBasis')return currentForecast(row).basis;if(col.key==='forecast.allocationStatus')return allocationForecastStatus(row);if(col.key==='funding.status')return fundingStatus(row);return base(row,col)}}
  if(typeof integratedDemandValue==='function'){const base=integratedDemandValue;integratedDemandValue=function(row,col){if(col.key==='_forecastValue')return currentForecast(row).value;if(col.key==='_forecastBasis')return currentForecast(row).basis;if(col.key==='forecast.allocationStatus')return allocationForecastStatus(row);if(col.key==='funding.status')return fundingStatus(row);return base(row,col)}}
  if(typeof integratedDemandCell==='function'){
    const base=integratedDemandCell;integratedDemandCell=function(row,col){
      if(col.key==='_forecastValue'){const f=currentForecast(row);return f.value!=null?`<span class="nowrap">${f.basis==='ROM'?'~':''}${moneyCompact(f.value)}</span>`:'<span class="muted">£ not captured</span>'}
      if(col.key==='_forecastBasis'){const f=currentForecast(row);return `<span class="pill ${f.basis==='Allocations'?'green':f.basis==='Estimate'?'blue':f.basis==='ROM'?'amber':''}">${escHtml(f.basis)}</span>`}
      if(col.key==='forecast.allocationStatus'&&gridState.demand.editing){const current=allocationForecastStatus(row);return `<select class="cell-input" data-edit-key="forecast.allocationStatus" data-row-id="${row.id}">${ALLOCATION_FORECAST_STATUSES.map(v=>`<option value="${escHtml(v)}" ${v===current?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}
      if(col.key==='funding.status'&&gridState.demand.editing){const current=fundingStatus(row);return `<select class="cell-input" data-edit-key="funding.status" data-row-id="${row.id}">${FUNDING_STATUSES.map(v=>`<option value="${escHtml(v)}" ${v===current?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}
      return base(row,col)
    }
  }
  if(typeof defaultDemandRecord==='function'){const base=defaultDemandRecord;defaultDemandRecord=function(){const r=base();r.triage=r.triage||{};r.triage.romAmount=null;r.workPackage=r.workPackage||{};r.workPackage.executionEstimateDays=null;r.workPackage.executionEstimateAmount=null;r.forecast={allocationStatus:'Not Planned'};r.funding={status:'Unfunded',approvedAmount:null};return r}}

  function computedField(label,value,full=false){return `<div class="field${full?' full':''}"><label>${escHtml(label)}</label><div class="record-value ${value==null||value===''?'empty':''}">${value==null||value===''?'—':value}</div></div>`}
  if(typeof renderDemandModal==='function'){
    const base=renderDemandModal;
    renderDemandModal=function(r){
      let html=base(r),f=currentForecast(r),windowAllocated=demandPlanningWindowAllocationValue(r.id),futureAllocated=demandFutureAllocationValue(r.id),totalAllocated=demandAllocationTotalValue(r.id),status=allocationForecastStatus(r);
      const forecastDisplay=f.value==null?'£ not captured':`${f.basis==='ROM'?'~':''}${money(f.value)}`;
      const warning=status==='Partial'?'<div class="notice field full">Allocation forecast is partial, so Current Forecast continues to use Estimate £ or ROM £. Planned allocation values are shown separately.</div>':status==='Complete'?'<div class="settings-note field full">Complete allocation forecast is authoritative. Total allocation forecast includes past stored allocation periods; Actuals are not yet captured.</div>':'';
      const extra=`${modalField('ROM (£)','triage.romAmount',r.triage?.romAmount??'','number')}${modalField('Estimate Days','workPackage.executionEstimateDays',r.workPackage?.executionEstimateDays??'','number')}${modalField('Estimate (£)','workPackage.executionEstimateAmount',r.workPackage?.executionEstimateAmount??'','number')}${modalField('Allocation Forecast','forecast.allocationStatus',status,'select',ALLOCATION_FORECAST_STATUSES)}${computedField('Current Forecast',forecastDisplay)}${computedField('Forecast Basis',escHtml(f.basis))}${computedField('Planning Window Allocated',money(windowAllocated))}${computedField('Forecast From Current Month',money(futureAllocated))}${computedField('Total Allocation Forecast',money(totalAllocated))}${warning}${modalField('Funding Status','funding.status',fundingStatus(r),'select',FUNDING_STATUSES)}${modalField('Approved Funding (£)','funding.approvedAmount',r.funding?.approvedAmount??'','number')}`;
      return html.replace(/(<div class="field"><label>Start)/,extra+'$1')
    }
  }
  if(typeof saveDemandModal==='function'){
    const base=saveDemandModal;saveDemandModal=function(next){
      next.triage=next.triage||{};next.workPackage=next.workPackage||{};next.forecast=next.forecast||{};next.funding=next.funding||{};
      const est=next.workPackage.executionEstimateDays;next.workPackage.executionEstimateDays=est===''||est==null?null:Math.max(0,Number(est)||0);
      for(const [obj,key] of [[next.triage,'romAmount'],[next.workPackage,'executionEstimateAmount'],[next.funding,'approvedAmount']]){const v=obj[key];obj[key]=v===''||v==null?null:Math.max(0,Number(v)||0)}
      next.forecast.allocationStatus=ALLOCATION_FORECAST_STATUSES.includes(next.forecast.allocationStatus)?next.forecast.allocationStatus:allocationForecastStatus(next);
      next.funding.status=FUNDING_STATUSES.includes(next.funding.status)?next.funding.status:'Unfunded';
      if(next.forecast.allocationStatus==='Complete'&&!demandAllocations(next.id).length){alert('Allocation Forecast cannot be marked Complete until at least one allocation record exists.');return}
      return base(next)
    }
  }

  function portfolioForecastPanelHtml(snapshot){const p=snapshot?.portfolioForecast||portfolioForecastSummary(),m=p.maturity||{};return `<div class="portfolio-forecast"><div class="section-title"><h2>Portfolio forecast</h2><span class="muted">Best available total forecast · ROM → Estimate → Complete Allocations</span></div><div class="grid kpis financial-kpis"><div class="card"><div class="kpi-label">Current billable forecast</div><div class="kpi-value">${moneyCompact(p.currentForecast)}</div><div class="kpi-sub">Best available basis across active Demand${p.unresolvedValue?` · ${p.unresolvedValue} without £ value`:''}</div></div><div class="card"><div class="kpi-label">Funded forecast</div><div class="kpi-value">${moneyCompact(p.fundedForecast)}</div><div class="kpi-sub">Current forecast with confirmed funding</div></div><div class="card"><div class="kpi-label">Unfunded forecast</div><div class="kpi-value">${moneyCompact(p.unfundedForecast)}</div><div class="kpi-sub">Current forecast without confirmed funding</div></div><div class="card"><div class="kpi-label">Future allocated forecast</div><div class="kpi-value">${moneyCompact(p.futureAllocated)}</div><div class="kpi-sub">Allocation forecast from current month onward</div></div></div><div class="forecast-maturity muted">Forecast basis: ${m.allocations||0} allocation-based · ${m.estimate||0} estimate-based · ${m.rom||0} ROM-based · ${m.none||0} without estimate/value.</div></div>`}
  function allocationOutlookPanelHtml(snapshot){const outlook=snapshot?.financialOutlook||financialOutlook(),t=outlook.totals||{};return `<div class="financial-dashboard"><div class="section-title"><h2>Allocation outlook</h2><span class="muted">Planning Window · phased allocation forecast only</span></div><div class="grid kpis financial-kpis"><div class="card"><div class="kpi-label">Billable capacity</div><div class="kpi-value">${moneyCompact(t.capacity)}</div><div class="kpi-sub">Rate-bearing capacity in visible planning months</div></div><div class="card"><div class="kpi-label">Funded allocations</div><div class="kpi-value">${moneyCompact(t.funded)}</div><div class="kpi-sub">Phased allocations on funded Demand</div></div><div class="card"><div class="kpi-label">Unfunded allocations</div><div class="kpi-value">${moneyCompact(t.unfunded)}</div><div class="kpi-sub">Phased allocations without confirmed funding</div></div><div class="card"><div class="kpi-label">Remaining capacity</div><div class="kpi-value">${moneyCompact(t.remaining)}</div><div class="kpi-sub">Billable capacity less all phased allocations</div></div></div><div class="table-wrap" style="margin-top:12px"><table class="financial-outlook-table"><thead><tr><th>Metric</th>${outlook.rows.map(r=>`<th>${escHtml(r.label)}</th>`).join('')}<th>Window</th></tr></thead><tbody>${[['Billable capacity','capacity'],['Funded allocation','funded'],['Unfunded allocation','unfunded'],['Remaining / over capacity','remaining']].map(([label,key])=>`<tr><td><strong>${label}</strong></td>${outlook.rows.map(r=>`<td>${moneyCompact(r[key])}</td>`).join('')}<td><strong>${moneyCompact(t[key])}</strong></td></tr>`).join('')}</tbody></table></div><div class="settings-note">Allocation values are forecasts, not Actuals. Past stored allocation periods remain in allocation totals until an Actuals source is introduced.</div></div>`}

  if(typeof dashboardHeadlineSnapshot==='function'){
    const base=dashboardHeadlineSnapshot;dashboardHeadlineSnapshot=function(){
      const s=base(),active=scopedDemandForFinance().filter(isOpenDemand),noEstimate=active.filter(d=>!hasAnyEstimate(d)),unfunded=active.filter(needsFunding),byId=new Map((s.attentionRequired||[]).map(x=>[x.demandId,{...x,reasons:[x.reason]}]));
      const add=(d,reason)=>{const existing=byId.get(d.id);if(existing){if(!existing.reasons.includes(reason))existing.reasons.push(reason)}else byId.set(d.id,{demandId:d.id,title:d.title,reasons:[reason]})};
      noEstimate.forEach(d=>add(d,'No ROM or full estimate'));
      unfunded.forEach(d=>add(d,`Forecast exists but billable funding is not confirmed (${fundingStatus(d)})`));
      active.filter(d=>allocationForecastStatus(d)==='Partial'&&estimateInfo(d).days>0).forEach(d=>add(d,`Allocation forecast is Partial; Current Forecast remains ${currentForecast(d).basis}-based`));
      active.filter(d=>allocationForecastStatus(d)==='Complete'&&!demandAllocations(d.id).length).forEach(d=>add(d,'Allocation forecast is marked Complete but has no allocation records'));
      active.filter(hasConfirmedFunding).forEach(d=>{const approved=finiteAmount(d.funding?.approvedAmount),f=currentForecast(d);if(approved!=null&&f.value!=null&&f.value>approved)add(d,`Current Forecast ${moneyCompact(f.value)} exceeds approved funding ${moneyCompact(approved)}`)});
      s.demandWithoutEstimate=noEstimate.length;s.unfundedDemand=unfunded.length;s.portfolioForecast=portfolioForecastSummary();s.financialOutlook=financialOutlook();s.attentionRequired=[...byId.values()].map(x=>({demandId:x.demandId,title:x.title,reason:x.reasons.join(' · ')}));return s
    }
  }
  if(typeof dashboardCardsHtml==='function')dashboardCardsHtml=function(snapshot){const cards=[['Active demand',snapshot.activeDemand,'Unresolved Architecture demand'],['Unallocated',snapshot.unallocated,'Needs resource allocation'],['Demand without Estimate',snapshot.demandWithoutEstimate||0,'No ROM or full estimate'],['Unfunded Demand',snapshot.unfundedDemand||0,'Forecast exists; funding not confirmed'],['In socialisation',snapshot.inSocialisation,'In Socialisation / Review'],['In governance',snapshot.inGovernance,'In Approval / Governance'],['Capacity conflicts',snapshot.capacityConflicts,'Person-period over-allocation']];return `<div class="grid kpis report-headline-kpis">${cards.map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('')}</div>`}
  if(typeof dashboardSnapshotHtml==='function'){const base=dashboardSnapshotHtml;dashboardSnapshotHtml=function(snapshot){const html=base(snapshot);return snapshot?.financialOutlook?html+portfolioForecastPanelHtml(snapshot)+allocationOutlookPanelHtml(snapshot):html}}
  if(typeof renderDashboard==='function'){
    const base=renderDashboard;renderDashboard=function(){const result=base(),snapshot=typeof dashboardHeadlineSnapshot==='function'?dashboardHeadlineSnapshot():null;if(snapshot){const grid=$('kpiGrid');if(grid)grid.innerHTML=dashboardCardsHtml(snapshot).replace(/^<div class="grid kpis report-headline-kpis">|<\/div>$/g,'');const attention=$('attentionList');if(attention)attention.innerHTML=snapshot.attentionRequired?.length?snapshot.attentionRequired.map(x=>`<li><strong>${escHtml(x.demandId)}</strong> — ${escHtml(x.title)}: ${escHtml(x.reason)}.</li>`).join(''):'<li>No immediate portfolio issues.</li>';let host=$('financialDashboardLive');if(!host){host=document.createElement('div');host.id='financialDashboardLive';grid?.after(host)}host.innerHTML=portfolioForecastPanelHtml(snapshot)+allocationOutlookPanelHtml(snapshot)}return result
    }
  }
  if(typeof renderResource==='function'){const base=renderResource;renderResource=function(){const result=base(),outlook=financialOutlook(),anchor=$('resourceSummaryTable')?.closest('.table-wrap');if(!anchor)return result;let host=$('resourceFinancialPosition');if(!host){host=document.createElement('div');host.id='resourceFinancialPosition';anchor.after(host)}host.innerHTML=allocationOutlookPanelHtml({financialOutlook:outlook}).replace('<div class="financial-dashboard">','<div class="financial-resource">');return result}}

  if(typeof renderAllocations==='function'){
    const base=renderAllocations;renderAllocations=function(){
      const result=base();if(allocationState.editing)return result;const table=$('allocationTable'),months=planningPeriods(),head=table?.tHead?.rows?.[0];if(!table||!head)return result;
      if(!head.querySelector('.allocation-value-head')){const th=document.createElement('th');th.className='allocation-value-head';th.textContent='Window £';head.appendChild(th)}
      const headers=[...head.cells],monthIndexes=new Map(months.map(m=>[m,headers.findIndex(c=>c.textContent.trim()===monthLabel(m))]));
      table.querySelectorAll('tbody tr.allocation-row[data-aid]').forEach(tr=>{const a=db.allocations.find(x=>x.id===tr.dataset.aid);if(!a)return;for(const m of months){const idx=monthIndexes.get(m),cell=idx>=0?tr.cells[idx]:null;if(cell&&!cell.querySelector('.allocation-value-sub'))cell.insertAdjacentHTML('beforeend',`<br><span class="muted allocation-value-sub">${moneyCompact(allocationValue(a,m))}</span>`)}if(!tr.querySelector('.allocation-window-value')){const td=document.createElement('td');td.className='allocation-window-value';td.innerHTML=`<strong>${moneyCompact(allocationPlanningWindowValue(a))}</strong>`;tr.appendChild(td)}});
      [...table.tHead.rows].slice(1).forEach(row=>{if(row.querySelector('.allocation-value-filter'))return;const spanCell=[...row.cells].find(c=>c.colSpan>1);if(spanCell)spanCell.colSpan=Number(spanCell.colSpan)+1;else{const th=document.createElement('th');th.className='allocation-value-filter';row.appendChild(th)}});
      table.querySelectorAll('.allocation-demand-header').forEach(row=>{const main=[...row.cells].find(c=>c.colSpan>1);if(main)main.colSpan=Math.max(1,head.cells.length-(row.cells.length-1));const d=demandById(row.dataset.demandHeader);if(!d)return;const heading=row.querySelector('.allocation-demand-heading');if(heading&&!heading.querySelector('.allocation-finance-summary')){const f=currentForecast(d),windowValue=demandPlanningWindowAllocationValue(d.id),futureValue=demandFutureAllocationValue(d.id),totalValue=demandAllocationTotalValue(d.id),approved=finiteAmount(d.funding?.approvedAmount),forecastText=f.value==null?`${f.basis} · £ not captured`:`Forecast ${f.basis==='ROM'?'~':''}${moneyCompact(f.value)} (${f.basis})`;heading.insertAdjacentHTML('beforeend',`<span class="muted allocation-finance-summary">${forecastText} · ${allocationForecastStatus(d)} · Window ${moneyCompact(windowValue)} · Future ${moneyCompact(futureValue)} · Allocation total ${moneyCompact(totalValue)} · ${fundingStatus(d)}${approved!=null?` ${moneyCompact(approved)}`:''}</span>`)}});
      return result
    }
  }

  if(!document.getElementById('financial-planning-styles')){const s=document.createElement('style');s.id='financial-planning-styles';s.textContent='.financial-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.financial-outlook-table{min-width:900px}.financial-outlook-table th:not(:first-child),.financial-outlook-table td:not(:first-child){text-align:right}.allocation-value-head,.allocation-window-value{text-align:right;white-space:nowrap}.allocation-value-sub{font-size:.66rem}.allocation-finance-summary{margin-left:auto;white-space:nowrap;font-size:.68rem}.report-headline-kpis{grid-template-columns:repeat(7,minmax(0,1fr))}.forecast-maturity{margin-top:8px;font-size:.76rem}.portfolio-forecast+.financial-dashboard{margin-top:18px}@media(max-width:1300px){.report-headline-kpis{grid-template-columns:repeat(4,1fr)}}@media(max-width:1000px){.financial-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.financial-kpis,.report-headline-kpis{grid-template-columns:1fr}.allocation-finance-summary{white-space:normal}}';document.head.appendChild(s)}
  if(workspaceHandle&&typeof refreshAll==='function')refreshAll();
})();
