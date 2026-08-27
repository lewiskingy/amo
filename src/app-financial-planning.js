/* Financial planning layer: estimates, funding, billable capacity and allocation value.
   Keeps commercial rules deliberately simple: weekday planning days and a configurable default day rate,
   with optional person-level overrides. All £ figures are planning values, not payroll/accounting actuals. */
(function initFinancialPlanning(){
  if(window.__amoFinancialPlanningLoaded)return;window.__amoFinancialPlanningLoaded=true;

  const FUNDING_STATUSES=['Funded','Funding Pending','Unfunded','Non-billable'];
  const DEFAULT_DAY_RATE=800;
  const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
  const moneyCompact=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  function defaultDayRate(settings=db.settings){const n=Number(settings?.financialPlanning?.defaultDayRate);return Number.isFinite(n)&&n>0?n:DEFAULT_DAY_RATE}
  function personDayRate(p){const n=Number(p?.billingDayRate);return Number.isFinite(n)&&n>0?n:defaultDayRate()}
  function workingDays(month){const m=normalizeMonthStart(month);if(!m)return 0;const [y,mo]=m.split('-').map(Number),last=new Date(Date.UTC(y,mo,0)).getUTCDate(),d=new Date(Date.UTC(y,mo-1,1));let days=0;for(let i=1;i<=last;i++){d.setUTCDate(i);const dow=d.getUTCDay();if(dow!==0&&dow!==6)days++}return days}
  function estimateInfo(d){const full=Number(d?.workPackage?.executionEstimateDays);if(Number.isFinite(full)&&full>0)return{days:full,kind:'Estimate'};const rom=Number(d?.triage?.romDays);if(Number.isFinite(rom)&&rom>0)return{days:rom,kind:'ROM'};return{days:0,kind:null}}
  function estimatedValue(d){const e=estimateInfo(d);return e.days*defaultDayRate()}
  function fundingStatus(d){return FUNDING_STATUSES.includes(d?.funding?.status)?d.funding.status:'Unfunded'}
  function hasConfirmedFunding(d){return fundingStatus(d)==='Funded'}
  function needsFunding(d){return estimateInfo(d).days>0&&!hasConfirmedFunding(d)&&fundingStatus(d)!=='Non-billable'}
  function scopedPeopleForFinance(){return(typeof scopedPeople==='function'?scopedPeople():db.team).filter(p=>p.active!==false)}
  function scopedDemandForFinance(){return typeof scopedDemand==='function'?scopedDemand():db.demand}
  function scopedAllocationsForFinance(){return typeof scopedAllocations==='function'?scopedAllocations():db.allocations}
  function monthlyCapacityValue(month){const days=workingDays(month);return scopedPeopleForFinance().reduce((sum,p)=>sum+(Number(p.fte)||0)*days*personDayRate(p),0)}
  function allocationValue(a,month){const p=person(a.teamMemberId),fte=Number(a.forecast?.[month])||0;return p?fte*workingDays(month)*personDayRate(p):0}
  function monthlyAllocatedValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>sum+allocationValue(a,month),0)}
  function monthlyFundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&hasConfirmedFunding(d)?allocationValue(a,month):0)},0)}
  function monthlyUnfundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&!hasConfirmedFunding(d)&&fundingStatus(d)!=='Non-billable'?allocationValue(a,month):0)},0)}
  function allocationWindowValue(a){return planningPeriods().reduce((sum,m)=>sum+allocationValue(a,m),0)}
  function financialOutlook(){const rows=planningPeriods().map(month=>{const capacity=monthlyCapacityValue(month),allocated=monthlyAllocatedValue(month),funded=monthlyFundedAllocationValue(month),unfunded=monthlyUnfundedAllocationValue(month);return{month,label:monthLabel(month),capacity,allocated,funded,unfunded,remaining:capacity-allocated}});const total=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);return{rows,totals:{capacity:total('capacity'),allocated:total('allocated'),funded:total('funded'),unfunded:total('unfunded'),remaining:total('remaining')}}}
  window.AmoFinance={FUNDING_STATUSES,defaultDayRate,personDayRate,workingDays,estimateInfo,estimatedValue,fundingStatus,hasConfirmedFunding,needsFunding,monthlyCapacityValue,monthlyAllocatedValue,monthlyFundedAllocationValue,monthlyUnfundedAllocationValue,allocationValue,allocationWindowValue,financialOutlook,money,moneyCompact};

  /* Make financialPlanning part of the authoritative System Config optimistic-merge scope. */
  if(window.AMO_CONFIG_SCOPES?.system&&!window.AMO_CONFIG_SCOPES.system.keys.includes('financialPlanning'))window.AMO_CONFIG_SCOPES.system.keys.push('financialPlanning');
  if(typeof renderConfig==='function'){
    const baseRenderConfigFinance=renderConfig;
    renderConfig=function(){const result=baseRenderConfigFinance();const state=window.AMO_CONFIG_PAGE_STATE,content=$('configContent');if(!workspaceHandle||!state||state.activeTab!=='system'||!content)return result;if(content.querySelector('.financial-planning-card'))return result;const editing=state.editingTab==='system',settings=editing?state.draft:db.settings,rate=defaultDayRate(settings),grid=content.querySelector('.settings-grid');if(!grid)return result;const card=document.createElement('div');card.className='card financial-planning-card';card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Financial Planning</h2><p class="muted config-description">Planning charge rate used to convert estimates and FTE allocations into indicative £ values.</p></div></div><div class="settings-field"><label>Default billable day rate (£)</label>${editing?`<input class="cell-input" id="settingsDefaultDayRate" type="number" min="0" step="25" value="${rate}">`:`<strong>${money(rate)} / day</strong>`}</div><div class="settings-note">People may optionally carry their own day-rate override. Planning months use Monday–Friday working days.</div>`;grid.appendChild(card);$('settingsDefaultDayRate')?.addEventListener('input',e=>{state.draft.financialPlanning=state.draft.financialPlanning||{};state.draft.financialPlanning.defaultDayRate=Math.max(0,Number(e.target.value)||0)});return result
    };
  }

  /* Demand and People list metadata. */
  if(typeof demandCols!=='undefined'){
    const romIndex=demandCols.findIndex(c=>c.key==='triage.romDays');
    if(!demandCols.some(c=>c.key==='workPackage.executionEstimateDays'))demandCols.splice(romIndex+1,0,{key:'workPackage.executionEstimateDays',label:'Estimate Days',type:'number',editable:true});
    if(!demandCols.some(c=>c.key==='_estimatedValue'))demandCols.splice(romIndex+2,0,{key:'_estimatedValue',label:'Est. £',type:'number',editable:false});
    if(!demandCols.some(c=>c.key==='funding.status'))demandCols.splice(romIndex+3,0,{key:'funding.status',label:'Funding',type:'select',values:()=>FUNDING_STATUSES,editable:true});
  }
  if(typeof teamCols!=='undefined'&&!teamCols.some(c=>c.key==='billingDayRate')){
    const fteIndex=teamCols.findIndex(c=>c.key==='fte');teamCols.splice(Math.max(0,fteIndex+1),0,{key:'billingDayRate',label:'Day Rate £',type:'number',editable:true});
  }
  if(typeof displayVal==='function'){
    const baseDisplayValFinance=displayVal;
    displayVal=function(row,col){if(col.key==='_estimatedValue')return estimatedValue(row);if(col.key==='funding.status')return fundingStatus(row);if(col.key==='billingDayRate')return Number(row.billingDayRate)||defaultDayRate();return baseDisplayValFinance(row,col)};
  }
  if(typeof defaultDemandRecord==='function'){
    const baseDefaultDemandFinance=defaultDemandRecord;defaultDemandRecord=function(){const r=baseDefaultDemandFinance();r.workPackage=r.workPackage||{};r.workPackage.executionEstimateDays=null;r.funding={status:'Unfunded',approvedAmount:null};return r};
  }
  if(typeof defaultTeamRecord==='function'){
    const baseDefaultTeamFinance=defaultTeamRecord;defaultTeamRecord=function(){const r=baseDefaultTeamFinance();r.billingDayRate=null;return r};
  }

  /* Record modal source fields. */
  if(typeof renderDemandModal==='function'){
    const baseRenderDemandFinance=renderDemandModal;
    renderDemandModal=function(r){let html=baseRenderDemandFinance(r);const e=estimateInfo(r),estimateHtml=`<div class="field"><label>Estimated Value</label><div class="record-value ${e.days?'':'empty'}">${e.days?`${e.kind==='ROM'?'~':''}${money(estimatedValue(r))} (${e.kind})`:'—'}</div></div>`;const extra=`${modalField('Estimate Days','workPackage.executionEstimateDays',r.workPackage?.executionEstimateDays??'','number')}${estimateHtml}${modalField('Funding Status','funding.status',fundingStatus(r),'select',FUNDING_STATUSES)}${modalField('Approved Funding (£)','funding.approvedAmount',r.funding?.approvedAmount??'','number')}`;return html.replace(/(<div class="field"><label>Start)/,extra+'$1')};
  }
  if(typeof renderTeamModal==='function'){
    const baseRenderTeamFinance=renderTeamModal;renderTeamModal=function(r){let html=baseRenderTeamFinance(r);return html.replace(/(<div class="field"><label>Active)/,modalField('Day Rate Override (£)','billingDayRate',r.billingDayRate??'','number')+'$1')};
  }
  if(typeof saveDemandModal==='function'){
    const baseSaveDemandFinance=saveDemandModal;saveDemandModal=function(next){next.workPackage=next.workPackage||{};const est=next.workPackage.executionEstimateDays;next.workPackage.executionEstimateDays=est===''||est==null?null:Math.max(0,Number(est)||0);next.funding=next.funding||{};next.funding.status=FUNDING_STATUSES.includes(next.funding.status)?next.funding.status:'Unfunded';const amount=next.funding.approvedAmount;next.funding.approvedAmount=amount===''||amount==null?null:Math.max(0,Number(amount)||0);return baseSaveDemandFinance(next)};
  }
  if(typeof saveTeamModal==='function'){
    const baseSaveTeamFinance=saveTeamModal;saveTeamModal=function(next){const rate=next.billingDayRate;next.billingDayRate=rate===''||rate==null?null:Math.max(0,Number(rate)||0);return baseSaveTeamFinance(next)};
  }

  function decorateDemandFinancialCells(){const table=$('demandTable');if(!table)return;const headers=[...table.querySelectorAll('thead tr:first-child th')],idx=headers.findIndex(th=>/Est\. £/.test(th.textContent));if(idx<0)return;table.querySelectorAll('tbody tr[data-row]').forEach(tr=>{const d=demandById(tr.dataset.row);if(!d||!tr.cells[idx])return;const e=estimateInfo(d);if(!gridState.demand.editing)tr.cells[idx].textContent=e.days?`${e.kind==='ROM'?'~':''}${moneyCompact(estimatedValue(d))}`:'—'})}
  if(typeof renderGrid==='function'){
    const baseRenderGridFinance=renderGrid;renderGrid=function(name){const r=baseRenderGridFinance(name);if(name==='demand')decorateDemandFinancialCells();return r};
  }

  function financialPanelHtml(snapshot){const outlook=snapshot?.financialOutlook||financialOutlook(),t=outlook.totals||{};return `<div class="financial-dashboard"><div class="section-title"><h2>Financial outlook</h2><span class="muted">Planning window · indicative billable value</span></div><div class="grid kpis financial-kpis"><div class="card"><div class="kpi-label">Billable capacity</div><div class="kpi-value">${moneyCompact(t.capacity)}</div><div class="kpi-sub">Available capacity across planning window</div></div><div class="card"><div class="kpi-label">Funded allocation</div><div class="kpi-value">${moneyCompact(t.funded)}</div><div class="kpi-sub">Allocated to confirmed funded Demand</div></div><div class="card"><div class="kpi-label">Unfunded planned</div><div class="kpi-value">${moneyCompact(t.unfunded)}</div><div class="kpi-sub">Allocated without confirmed funding</div></div><div class="card"><div class="kpi-label">Remaining capacity</div><div class="kpi-value">${moneyCompact(t.remaining)}</div><div class="kpi-sub">Capacity less all planned allocations</div></div></div><div class="table-wrap" style="margin-top:12px"><table class="financial-outlook-table"><thead><tr><th>Metric</th>${outlook.rows.map(r=>`<th>${escHtml(r.label)}</th>`).join('')}<th>Window</th></tr></thead><tbody>${[['Billable capacity','capacity'],['Funded allocation','funded'],['Unfunded allocation','unfunded'],['Remaining / over capacity','remaining']].map(([label,key])=>`<tr><td><strong>${label}</strong></td>${outlook.rows.map(r=>`<td>${moneyCompact(r[key])}</td>`).join('')}<td><strong>${moneyCompact(t[key])}</strong></td></tr>`).join('')}</tbody></table></div></div>`}

  /* Dashboard counters, attention and immutable snapshot enrichment. */
  if(typeof dashboardHeadlineSnapshot==='function'){
    const baseHeadlineFinance=dashboardHeadlineSnapshot;dashboardHeadlineSnapshot=function(){const s=baseHeadlineFinance(),active=scopedDemandForFinance().filter(isOpenDemand),noEstimate=active.filter(d=>!estimateInfo(d).days),unfunded=active.filter(needsFunding);const byId=new Map((s.attentionRequired||[]).map(x=>[x.demandId,{...x,reasons:[x.reason]}]));const add=(d,reason)=>{const existing=byId.get(d.id);if(existing){if(!existing.reasons.includes(reason))existing.reasons.push(reason)}else byId.set(d.id,{demandId:d.id,title:d.title,reasons:[reason]})};noEstimate.forEach(d=>add(d,'No ROM or full estimate'));unfunded.forEach(d=>add(d,`Estimate exists but funding is not confirmed (${fundingStatus(d)})`));s.demandWithoutEstimate=noEstimate.length;s.unfundedDemand=unfunded.length;s.financialOutlook=financialOutlook();s.attentionRequired=[...byId.values()].map(x=>({demandId:x.demandId,title:x.title,reason:x.reasons.join(' · ')}));return s};
  }
  if(typeof dashboardCardsHtml==='function'){
    dashboardCardsHtml=function(snapshot){const cards=[['Active demand',snapshot.activeDemand,'Unresolved Architecture demand'],['Unallocated',snapshot.unallocated,'Needs resource allocation'],['Demand without Estimate',snapshot.demandWithoutEstimate||0,'No ROM or full estimate'],['Unfunded Demand',snapshot.unfundedDemand||0,'Estimate exists; funding not confirmed'],['In socialisation',snapshot.inSocialisation,'In Socialisation / Review'],['In governance',snapshot.inGovernance,'In Approval / Governance'],['Capacity conflicts',snapshot.capacityConflicts,'Person-period over-allocation']];return `<div class="grid kpis report-headline-kpis">${cards.map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('')}</div>`};
  }
  if(typeof dashboardSnapshotHtml==='function'){
    const baseDashboardSnapshotFinance=dashboardSnapshotHtml;dashboardSnapshotHtml=function(snapshot){return baseDashboardSnapshotFinance(snapshot)+financialPanelHtml(snapshot)};
  }
  if(typeof renderDashboard==='function'){
    const baseRenderDashboardFinance=renderDashboard;renderDashboard=function(){const result=baseRenderDashboardFinance(),snapshot=typeof dashboardHeadlineSnapshot==='function'?dashboardHeadlineSnapshot():null,active=scopedDemandForFinance().filter(isOpenDemand);if(snapshot){const grid=$('kpiGrid');if(grid)grid.innerHTML=dashboardCardsHtml(snapshot).replace(/^<div class="grid kpis report-headline-kpis">|<\/div>$/g,'');const attention=$('attentionList');if(attention)attention.innerHTML=snapshot.attentionRequired?.length?snapshot.attentionRequired.map(x=>`<li><strong>${escHtml(x.demandId)}</strong> — ${escHtml(x.title)}: ${escHtml(x.reason)}.</li>`).join(''):'<li>No immediate portfolio issues.</li>';let host=$('financialDashboardLive');if(!host){host=document.createElement('div');host.id='financialDashboardLive';grid?.after(host)}host.innerHTML=financialPanelHtml(snapshot)}return result};
  }

  /* Resource Plan: £ companion to the existing FTE view. */
  if(typeof renderResource==='function'){
    const baseRenderResourceFinance=renderResource;renderResource=function(){const result=baseRenderResourceFinance(),outlook=financialOutlook(),anchor=$('resourceSummaryTable')?.closest('.table-wrap');if(!anchor)return result;let host=$('resourceFinancialPosition');if(!host){host=document.createElement('div');host.id='resourceFinancialPosition';anchor.after(host)}host.innerHTML=financialPanelHtml({financialOutlook:outlook}).replace('<div class="financial-dashboard">','<div class="financial-resource">');return result};
  }

  /* Allocations: show monthly and planning-window £ value in read-only mode. */
  if(typeof renderAllocations==='function'){
    const baseRenderAllocationsFinance=renderAllocations;renderAllocations=function(){const result=baseRenderAllocationsFinance();if(allocationState.editing)return result;const table=$('allocationTable'),months=planningPeriods();if(!table)return result;const head=table.tHead?.rows?.[0];if(head&&!head.querySelector('.allocation-value-head')){const th=document.createElement('th');th.className='allocation-value-head';th.textContent='Window £';head.appendChild(th)}table.querySelectorAll('tbody tr.allocation-row[data-aid]').forEach(tr=>{const a=db.allocations.find(x=>x.id===tr.dataset.aid);if(!a)return;for(let i=0;i<months.length;i++){const cell=tr.cells[1+i];if(cell&&!cell.querySelector('.allocation-value-sub'))cell.insertAdjacentHTML('beforeend',`<br><span class="muted allocation-value-sub">${moneyCompact(allocationValue(a,months[i]))}</span>`)}if(!tr.querySelector('.allocation-window-value')){const td=document.createElement('td');td.className='allocation-window-value';td.innerHTML=`<strong>${moneyCompact(allocationWindowValue(a))}</strong>`;tr.appendChild(td)}});table.querySelectorAll('.allocation-demand-header td').forEach(td=>td.colSpan=Number(td.colSpan||1)+1);table.tHead&&[...table.tHead.rows].slice(1).forEach(row=>{const cell=[...row.cells].find(c=>c.colSpan>1);if(cell)cell.colSpan=Number(cell.colSpan)+1});table.querySelectorAll('.allocation-demand-header').forEach(row=>{const d=demandById(row.dataset.demandHeader);if(!d)return;const heading=row.querySelector('.allocation-demand-heading');if(heading&&!heading.querySelector('.allocation-finance-summary')){const e=estimateInfo(d),allocated=db.allocations.filter(a=>a.demandId===d.id).reduce((n,a)=>n+allocationWindowValue(a),0),approved=Number(d.funding?.approvedAmount)||0;heading.insertAdjacentHTML('beforeend',`<span class="muted allocation-finance-summary">${e.days?`${e.kind} ${e.days}d · ${e.kind==='ROM'?'~':''}${moneyCompact(estimatedValue(d))}`:'No estimate'} · Allocated ${moneyCompact(allocated)} · ${fundingStatus(d)}${approved?` ${moneyCompact(approved)}`:''}</span>`)}});return result};
  }

  if(!document.getElementById('financial-planning-styles')){const s=document.createElement('style');s.id='financial-planning-styles';s.textContent=`.financial-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.financial-outlook-table{min-width:900px}.financial-outlook-table th:not(:first-child),.financial-outlook-table td:not(:first-child){text-align:right}.allocation-value-head,.allocation-window-value{text-align:right;white-space:nowrap}.allocation-value-sub{font-size:.66rem}.allocation-finance-summary{margin-left:auto;white-space:nowrap;font-size:.68rem}.report-headline-kpis{grid-template-columns:repeat(7,minmax(0,1fr))}@media(max-width:1300px){.report-headline-kpis{grid-template-columns:repeat(4,1fr)}}@media(max-width:1000px){.financial-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.financial-kpis,.report-headline-kpis{grid-template-columns:1fr}.allocation-finance-summary{white-space:normal}}`;document.head.appendChild(s)}

  if(workspaceHandle&&typeof refreshAll==='function')refreshAll();
})();
