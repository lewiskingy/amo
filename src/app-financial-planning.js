/* Financial planning layer: estimates, funding, billable capacity and allocation value.
   Role is the rate-bearing concept. Unconfigured roles are non-billable (£0/day).
   Legacy flat-rate workspaces keep their old effective rate until explicit role rates are saved. */
(function initFinancialPlanning(){
  if(window.__amoFinancialPlanningLoaded)return;window.__amoFinancialPlanningLoaded=true;

  const FUNDING_STATUSES=['Funded','Funding Pending','Unfunded','Non-billable'];
  const LEGACY_DEFAULT_DAY_RATE=800;
  const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
  const moneyCompact=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
  const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);

  function distinctRoles(){return [...new Set((db.team||[]).map(p=>String(p.role||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
  function financialSettings(settings=db.settings){return settings?.financialPlanning||{}}
  function explicitRoleRates(settings=db.settings){const rates=financialSettings(settings).roleDayRates;return rates&&typeof rates==='object'&&!Array.isArray(rates)?rates:null}
  function legacyDefaultRate(settings=db.settings){const n=Number(financialSettings(settings).defaultDayRate);return Number.isFinite(n)&&n>=0?n:null}
  function roleDayRate(role,settings=db.settings){
    const name=String(role||'').trim(),rates=explicitRoleRates(settings);
    if(!name)return 0;
    if(rates&&hasOwn(rates,name)){const n=Number(rates[name]);return Number.isFinite(n)&&n>=0?n:0}
    /* Compatibility only: before explicit role rates exist, preserve the old flat-rate model. */
    if(!rates){const legacy=legacyDefaultRate(settings);if(legacy!=null)return legacy}
    return 0;
  }
  function personDayRate(p,settings=db.settings){return roleDayRate(p?.role,settings)}
  function workingDays(month){const m=normalizeMonthStart(month);if(!m)return 0;const [y,mo]=m.split('-').map(Number),last=new Date(Date.UTC(y,mo,0)).getUTCDate(),d=new Date(Date.UTC(y,mo-1,1));let days=0;for(let i=1;i<=last;i++){d.setUTCDate(i);const dow=d.getUTCDay();if(dow!==0&&dow!==6)days++}return days}
  function estimateInfo(d){const full=Number(d?.workPackage?.executionEstimateDays);if(Number.isFinite(full)&&full>0)return{days:full,kind:'Estimate'};const rom=Number(d?.triage?.romDays);if(Number.isFinite(rom)&&rom>0)return{days:rom,kind:'ROM'};return{days:0,kind:null}}
  function scopedPeopleForFinance(){return(typeof scopedPeople==='function'?scopedPeople():db.team).filter(p=>p.active!==false)}
  function scopedDemandForFinance(){return typeof scopedDemand==='function'?scopedDemand():db.demand}
  function scopedAllocationsForFinance(){return typeof scopedAllocations==='function'?scopedAllocations():db.allocations}
  function allocationPersonDays(a){return planningPeriods().reduce((sum,m)=>sum+(Number(a.forecast?.[m])||0)*workingDays(m),0)}
  function demandAllocationWeightedRate(demandId){
    const rows=db.allocations.filter(a=>a.demandId===demandId&&a.teamMemberId);let weightedValue=0,totalDays=0;
    for(const a of rows){const p=person(a.teamMemberId),days=allocationPersonDays(a);if(!p||days<=0)continue;weightedValue+=days*personDayRate(p);totalDays+=days}
    return totalDays>0?weightedValue/totalDays:null;
  }
  function estimatedValue(d){const e=estimateInfo(d);if(!e.days)return null;const rate=demandAllocationWeightedRate(d.id);return rate==null?null:e.days*rate}
  function fundingStatus(d){return FUNDING_STATUSES.includes(d?.funding?.status)?d.funding.status:'Unfunded'}
  function hasConfirmedFunding(d){return fundingStatus(d)==='Funded'}
  function needsFunding(d){if(!estimateInfo(d).days||hasConfirmedFunding(d)||fundingStatus(d)==='Non-billable')return false;const rate=demandAllocationWeightedRate(d.id);return rate!==0}
  function monthlyCapacityValue(month){const days=workingDays(month);return scopedPeopleForFinance().reduce((sum,p)=>sum+(Number(p.fte)||0)*days*personDayRate(p),0)}
  function allocationValue(a,month){const p=person(a.teamMemberId),fte=Number(a.forecast?.[month])||0;return p?fte*workingDays(month)*personDayRate(p):0}
  function monthlyAllocatedValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>sum+allocationValue(a,month),0)}
  function monthlyFundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&hasConfirmedFunding(d)?allocationValue(a,month):0)},0)}
  function monthlyUnfundedAllocationValue(month){return scopedAllocationsForFinance().reduce((sum,a)=>{const d=demandById(a.demandId);return sum+(d&&!hasConfirmedFunding(d)&&fundingStatus(d)!=='Non-billable'?allocationValue(a,month):0)},0)}
  function allocationWindowValue(a){return planningPeriods().reduce((sum,m)=>sum+allocationValue(a,m),0)}
  function demandWindowAllocationValue(demandId){return db.allocations.filter(a=>a.demandId===demandId).reduce((sum,a)=>sum+allocationWindowValue(a),0)}
  function financialOutlook(){const rows=planningPeriods().map(month=>{const capacity=monthlyCapacityValue(month),allocated=monthlyAllocatedValue(month),funded=monthlyFundedAllocationValue(month),unfunded=monthlyUnfundedAllocationValue(month);return{month,label:monthLabel(month),capacity,allocated,funded,unfunded,remaining:capacity-allocated}});const total=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);return{rows,totals:{capacity:total('capacity'),allocated:total('allocated'),funded:total('funded'),unfunded:total('unfunded'),remaining:total('remaining')}}}
  window.AmoFinance={FUNDING_STATUSES,distinctRoles,roleDayRate,personDayRate,workingDays,estimateInfo,demandAllocationWeightedRate,estimatedValue,fundingStatus,hasConfirmedFunding,needsFunding,monthlyCapacityValue,monthlyAllocatedValue,monthlyFundedAllocationValue,monthlyUnfundedAllocationValue,allocationValue,allocationWindowValue,demandWindowAllocationValue,financialOutlook,money,moneyCompact};

  /* Financial planning remains one System Config key for optimistic key-level merge. */
  if(window.AMO_CONFIG_SCOPES?.system&&!window.AMO_CONFIG_SCOPES.system.keys.includes('financialPlanning'))window.AMO_CONFIG_SCOPES.system.keys.push('financialPlanning');
  function materializeRoleRatesDraft(state){
    if(!state?.draft)return{};state.draft.financialPlanning=state.draft.financialPlanning||{};
    let rates=state.draft.financialPlanning.roleDayRates;
    if(!rates||typeof rates!=='object'||Array.isArray(rates)){
      const legacy=legacyDefaultRate(state.draft),seed=legacy!=null?legacy:0;rates=Object.fromEntries(distinctRoles().map(role=>[role,seed]));state.draft.financialPlanning.roleDayRates=rates;
    }else for(const role of distinctRoles())if(!hasOwn(rates,role))rates[role]=0;
    return rates;
  }
  if(typeof renderConfig==='function'){
    const baseRenderConfigFinance=renderConfig;
    renderConfig=function(){const result=baseRenderConfigFinance();const state=window.AMO_CONFIG_PAGE_STATE,content=$('configContent');if(!workspaceHandle||!state||state.activeTab!=='system'||!content)return result;if(content.querySelector('.financial-planning-card'))return result;const editing=state.editingTab==='system',settings=editing?state.draft:db.settings,grid=content.querySelector('.settings-grid');if(!grid)return result;const roles=distinctRoles(),rates=editing?materializeRoleRatesDraft(state):null,legacy=legacyDefaultRate(settings),explicit=explicitRoleRates(settings);const rows=roles.map(role=>{const rate=editing?Number(rates[role])||0:roleDayRate(role,settings);return `<tr><td><strong>${escHtml(role)}</strong></td><td>${editing?`<input class="cell-input role-day-rate-input" type="number" min="0" step="25" data-role-rate="${escHtml(role)}" value="${rate}">`:`${money(rate)} / day`}</td></tr>`}).join('');const card=document.createElement('div');card.className='card financial-planning-card';card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Financial Planning</h2><p class="muted config-description">Billable day rates are defined by role. A £0 role contributes delivery FTE but no billable capacity or allocation value.</p></div></div>${roles.length?`<div class="table-wrap"><table class="role-rate-table"><thead><tr><th>Role</th><th>Day Rate</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<span class="muted">No People roles exist yet. Add People/roles before configuring rates.</span>'}<div class="settings-note">Unconfigured/new roles default to £0/day.${!explicit&&legacy!=null?' This workspace is currently using the legacy flat rate until explicit role rates are saved.':''}</div>`;grid.appendChild(card);card.querySelectorAll('[data-role-rate]').forEach(input=>input.addEventListener('input',e=>{const role=e.target.dataset.roleRate;state.draft.financialPlanning=state.draft.financialPlanning||{};state.draft.financialPlanning.roleDayRates=state.draft.financialPlanning.roleDayRates||{};state.draft.financialPlanning.roleDayRates[role]=Math.max(0,Number(e.target.value)||0);delete state.draft.financialPlanning.defaultDayRate}));return result
    };
  }

  /* Demand list metadata. The live Demand register uses demandTailColumns from app-integrations. */
  const financialDemandColumns=()=>[
    {key:'workPackage.executionEstimateDays',label:'Estimate Days',type:'number',editable:true},
    {key:'_estimatedValue',label:'Est. £',type:'number',editable:false},
    {key:'funding.status',label:'Funding',type:'select',values:()=>FUNDING_STATUSES,editable:true}
  ];
  function addDemandFinancialColumns(cols){if(!Array.isArray(cols)||cols.some(c=>c.key==='workPackage.executionEstimateDays'))return;const romIndex=cols.findIndex(c=>c.key==='triage.romDays'),at=romIndex>=0?romIndex+1:cols.length;cols.splice(at,0,...financialDemandColumns())}
  if(typeof demandCols!=='undefined')addDemandFinancialColumns(demandCols);
  if(typeof demandTailColumns!=='undefined')addDemandFinancialColumns(demandTailColumns);

  if(typeof displayVal==='function'){
    const baseDisplayValFinance=displayVal;
    displayVal=function(row,col){if(col.key==='_estimatedValue')return estimatedValue(row);if(col.key==='funding.status')return fundingStatus(row);return baseDisplayValFinance(row,col)};
  }
  if(typeof integratedDemandValue==='function'){
    const baseIntegratedDemandValueFinance=integratedDemandValue;integratedDemandValue=function(row,col){if(col.key==='_estimatedValue')return estimatedValue(row);if(col.key==='funding.status')return fundingStatus(row);return baseIntegratedDemandValueFinance(row,col)};
  }
  if(typeof integratedDemandCell==='function'){
    const baseIntegratedDemandCellFinance=integratedDemandCell;integratedDemandCell=function(row,col){if(col.key==='_estimatedValue'){const e=estimateInfo(row),value=estimatedValue(row);return e.days&&value!=null?`<span class="nowrap">${e.kind==='ROM'?'~':''}${moneyCompact(value)}</span>`:(e.days?'<span class="muted">Awaiting allocation mix</span>':'<span class="muted">—</span>')}if(col.key==='funding.status'&&gridState.demand.editing){const current=fundingStatus(row);return `<select class="cell-input" data-edit-key="funding.status" data-row-id="${row.id}">${FUNDING_STATUSES.map(v=>`<option value="${escHtml(v)}" ${v===current?'selected':''}>${escHtml(v)}</option>`).join('')}</select>`}return baseIntegratedDemandCellFinance(row,col)};
  }
  if(typeof defaultDemandRecord==='function'){
    const baseDefaultDemandFinance=defaultDemandRecord;defaultDemandRecord=function(){const r=baseDefaultDemandFinance();r.workPackage=r.workPackage||{};r.workPackage.executionEstimateDays=null;r.funding={status:'Unfunded',approvedAmount:null};return r};
  }

  /* Record modal source fields. */
  if(typeof renderDemandModal==='function'){
    const baseRenderDemandFinance=renderDemandModal;
    renderDemandModal=function(r){let html=baseRenderDemandFinance(r);const e=estimateInfo(r),value=estimatedValue(r),rate=demandAllocationWeightedRate(r.id),estimateHtml=`<div class="field"><label>Estimated Value</label><div class="record-value ${e.days?'':'empty'}">${!e.days?'—':value==null?'Awaiting allocation role mix':`${e.kind==='ROM'?'~':''}${money(value)} (${e.kind} · weighted rate ${money(rate)}/day)`}</div></div>`;const extra=`${modalField('Estimate Days','workPackage.executionEstimateDays',r.workPackage?.executionEstimateDays??'','number')}${estimateHtml}${modalField('Funding Status','funding.status',fundingStatus(r),'select',FUNDING_STATUSES)}${modalField('Approved Funding (£)','funding.approvedAmount',r.funding?.approvedAmount??'','number')}`;return html.replace(/(<div class="field"><label>Start)/,extra+'$1')};
  }
  if(typeof saveDemandModal==='function'){
    const baseSaveDemandFinance=saveDemandModal;saveDemandModal=function(next){next.workPackage=next.workPackage||{};const est=next.workPackage.executionEstimateDays;next.workPackage.executionEstimateDays=est===''||est==null?null:Math.max(0,Number(est)||0);next.funding=next.funding||{};next.funding.status=FUNDING_STATUSES.includes(next.funding.status)?next.funding.status:'Unfunded';const amount=next.funding.approvedAmount;next.funding.approvedAmount=amount===''||amount==null?null:Math.max(0,Number(amount)||0);return baseSaveDemandFinance(next)};
  }

  function financialPanelHtml(snapshot){const outlook=snapshot?.financialOutlook||financialOutlook(),t=outlook.totals||{};return `<div class="financial-dashboard"><div class="section-title"><h2>Financial outlook</h2><span class="muted">Planning window · role-rated billable value</span></div><div class="grid kpis financial-kpis"><div class="card"><div class="kpi-label">Billable capacity</div><div class="kpi-value">${moneyCompact(t.capacity)}</div><div class="kpi-sub">Rate-bearing capacity across planning window</div></div><div class="card"><div class="kpi-label">Funded allocation</div><div class="kpi-value">${moneyCompact(t.funded)}</div><div class="kpi-sub">Allocated to confirmed funded Demand</div></div><div class="card"><div class="kpi-label">Unfunded planned</div><div class="kpi-value">${moneyCompact(t.unfunded)}</div><div class="kpi-sub">Billable allocation without confirmed funding</div></div><div class="card"><div class="kpi-label">Remaining capacity</div><div class="kpi-value">${moneyCompact(t.remaining)}</div><div class="kpi-sub">Billable capacity less billable planned allocations</div></div></div><div class="table-wrap" style="margin-top:12px"><table class="financial-outlook-table"><thead><tr><th>Metric</th>${outlook.rows.map(r=>`<th>${escHtml(r.label)}</th>`).join('')}<th>Window</th></tr></thead><tbody>${[['Billable capacity','capacity'],['Funded allocation','funded'],['Unfunded allocation','unfunded'],['Remaining / over capacity','remaining']].map(([label,key])=>`<tr><td><strong>${label}</strong></td>${outlook.rows.map(r=>`<td>${moneyCompact(r[key])}</td>`).join('')}<td><strong>${moneyCompact(t[key])}</strong></td></tr>`).join('')}</tbody></table></div></div>`}

  /* Dashboard counters, attention and immutable snapshot enrichment. */
  if(typeof dashboardHeadlineSnapshot==='function'){
    const baseHeadlineFinance=dashboardHeadlineSnapshot;dashboardHeadlineSnapshot=function(){const s=baseHeadlineFinance(),active=scopedDemandForFinance().filter(isOpenDemand),noEstimate=active.filter(d=>!estimateInfo(d).days),unfunded=active.filter(needsFunding);const byId=new Map((s.attentionRequired||[]).map(x=>[x.demandId,{...x,reasons:[x.reason]}]));const add=(d,reason)=>{const existing=byId.get(d.id);if(existing){if(!existing.reasons.includes(reason))existing.reasons.push(reason)}else byId.set(d.id,{demandId:d.id,title:d.title,reasons:[reason]})};noEstimate.forEach(d=>add(d,'No ROM or full estimate'));unfunded.forEach(d=>add(d,`Estimate exists but billable funding is not confirmed (${fundingStatus(d)})`));active.filter(hasConfirmedFunding).forEach(d=>{const approved=Number(d.funding?.approvedAmount)||0,planned=demandWindowAllocationValue(d.id);if(approved>0&&planned>approved)add(d,`Planning-window allocation ${moneyCompact(planned)} exceeds approved funding ${moneyCompact(approved)}`)});s.demandWithoutEstimate=noEstimate.length;s.unfundedDemand=unfunded.length;s.financialOutlook=financialOutlook();s.attentionRequired=[...byId.values()].map(x=>({demandId:x.demandId,title:x.title,reason:x.reasons.join(' · ')}));return s};
  }
  if(typeof dashboardCardsHtml==='function'){
    dashboardCardsHtml=function(snapshot){const cards=[['Active demand',snapshot.activeDemand,'Unresolved Architecture demand'],['Unallocated',snapshot.unallocated,'Needs resource allocation'],['Demand without Estimate',snapshot.demandWithoutEstimate||0,'No ROM or full estimate'],['Unfunded Demand',snapshot.unfundedDemand||0,'Billable estimate exists; funding not confirmed'],['In socialisation',snapshot.inSocialisation,'In Socialisation / Review'],['In governance',snapshot.inGovernance,'In Approval / Governance'],['Capacity conflicts',snapshot.capacityConflicts,'Person-period over-allocation']];return `<div class="grid kpis report-headline-kpis">${cards.map(k=>`<div class="card"><div class="kpi-label">${k[0]}</div><div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join('')}</div>`};
  }
  if(typeof dashboardSnapshotHtml==='function'){
    const baseDashboardSnapshotFinance=dashboardSnapshotHtml;dashboardSnapshotHtml=function(snapshot){const base=baseDashboardSnapshotFinance(snapshot);return snapshot?.financialOutlook?base+financialPanelHtml(snapshot):base};
  }
  if(typeof renderDashboard==='function'){
    const baseRenderDashboardFinance=renderDashboard;renderDashboard=function(){const result=baseRenderDashboardFinance(),snapshot=typeof dashboardHeadlineSnapshot==='function'?dashboardHeadlineSnapshot():null;if(snapshot){const grid=$('kpiGrid');if(grid)grid.innerHTML=dashboardCardsHtml(snapshot).replace(/^<div class="grid kpis report-headline-kpis">|<\/div>$/g,'');const attention=$('attentionList');if(attention)attention.innerHTML=snapshot.attentionRequired?.length?snapshot.attentionRequired.map(x=>`<li><strong>${escHtml(x.demandId)}</strong> — ${escHtml(x.title)}: ${escHtml(x.reason)}.</li>`).join(''):'<li>No immediate portfolio issues.</li>';let host=$('financialDashboardLive');if(!host){host=document.createElement('div');host.id='financialDashboardLive';grid?.after(host)}host.innerHTML=financialPanelHtml(snapshot)}return result};
  }

  /* Resource Plan: £ companion to the existing FTE view. */
  if(typeof renderResource==='function'){
    const baseRenderResourceFinance=renderResource;renderResource=function(){const result=baseRenderResourceFinance(),outlook=financialOutlook(),anchor=$('resourceSummaryTable')?.closest('.table-wrap');if(!anchor)return result;let host=$('resourceFinancialPosition');if(!host){host=document.createElement('div');host.id='resourceFinancialPosition';anchor.after(host)}host.innerHTML=financialPanelHtml({financialOutlook:outlook}).replace('<div class="financial-dashboard">','<div class="financial-resource">');return result};
  }

  /* Allocations: monthly/window £ comes from the allocated person's role rate. */
  if(typeof renderAllocations==='function'){
    const baseRenderAllocationsFinance=renderAllocations;renderAllocations=function(){const result=baseRenderAllocationsFinance();if(allocationState.editing)return result;const table=$('allocationTable'),months=planningPeriods(),head=table?.tHead?.rows?.[0];if(!table||!head)return result;if(!head.querySelector('.allocation-value-head')){const th=document.createElement('th');th.className='allocation-value-head';th.textContent='Window £';head.appendChild(th)}const headerCells=[...head.cells],monthIndexes=new Map(months.map(m=>[m,headerCells.findIndex(c=>c.textContent.trim()===monthLabel(m))]));table.querySelectorAll('tbody tr.allocation-row[data-aid]').forEach(tr=>{const a=db.allocations.find(x=>x.id===tr.dataset.aid);if(!a)return;for(const m of months){const idx=monthIndexes.get(m),cell=idx>=0?tr.cells[idx]:null;if(cell&&!cell.querySelector('.allocation-value-sub'))cell.insertAdjacentHTML('beforeend',`<br><span class="muted allocation-value-sub">${moneyCompact(allocationValue(a,m))}</span>`)}if(!tr.querySelector('.allocation-window-value')){const td=document.createElement('td');td.className='allocation-window-value';td.innerHTML=`<strong>${moneyCompact(allocationWindowValue(a))}</strong>`;tr.appendChild(td)}});[...table.tHead.rows].slice(1).forEach(row=>{if(row.querySelector('.allocation-value-filter'))return;const spanCell=[...row.cells].find(c=>c.colSpan>1);if(spanCell)spanCell.colSpan=Number(spanCell.colSpan)+1;else{const th=document.createElement('th');th.className='allocation-value-filter';row.appendChild(th)}});table.querySelectorAll('.allocation-demand-header').forEach(row=>{const main=[...row.cells].find(c=>c.colSpan>1);if(main)main.colSpan=Math.max(1,head.cells.length-(row.cells.length-1));const d=demandById(row.dataset.demandHeader);if(!d)return;const heading=row.querySelector('.allocation-demand-heading');if(heading&&!heading.querySelector('.allocation-finance-summary')){const e=estimateInfo(d),value=estimatedValue(d),allocated=demandWindowAllocationValue(d.id),approved=Number(d.funding?.approvedAmount)||0,estimateText=!e.days?'No estimate':value==null?`${e.kind} ${e.days}d · awaiting role mix`:`${e.kind} ${e.days}d · ${e.kind==='ROM'?'~':''}${moneyCompact(value)}`;heading.insertAdjacentHTML('beforeend',`<span class="muted allocation-finance-summary">${estimateText} · Allocated ${moneyCompact(allocated)} · ${fundingStatus(d)}${approved?` ${moneyCompact(approved)}`:''}</span>`)}});return result};
  }

  if(!document.getElementById('financial-planning-styles')){const s=document.createElement('style');s.id='financial-planning-styles';s.textContent=`.financial-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.financial-outlook-table{min-width:900px}.financial-outlook-table th:not(:first-child),.financial-outlook-table td:not(:first-child){text-align:right}.allocation-value-head,.allocation-window-value{text-align:right;white-space:nowrap}.allocation-value-sub{font-size:.66rem}.allocation-finance-summary{margin-left:auto;white-space:nowrap;font-size:.68rem}.report-headline-kpis{grid-template-columns:repeat(7,minmax(0,1fr))}.role-rate-table{min-width:420px}.role-rate-table th:last-child,.role-rate-table td:last-child{text-align:right}.role-day-rate-input{max-width:150px;text-align:right}@media(max-width:1300px){.report-headline-kpis{grid-template-columns:repeat(4,1fr)}}@media(max-width:1000px){.financial-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.financial-kpis,.report-headline-kpis{grid-template-columns:1fr}.allocation-finance-summary{white-space:normal}}`;document.head.appendChild(s)}

  if(workspaceHandle&&typeof refreshAll==='function')refreshAll();
})();
