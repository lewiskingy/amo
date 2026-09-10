/* Canonical management-control semantics for funded, tracked, resourced and recovered work.
   This module derives control state from Demand, Work Packages, Allocations and ReportingModel.
   It persists no duplicate RAG/status. A persisted named allocation with non-zero forecast is treated
   as a confirmed commitment in the current model; a separate Proposed/Confirmed state is deliberately
   not introduced until AMO has a real need to persist tentative allocations. */
(function initCommitmentHealth(){
  const COMMITTED_DEMAND_STATES=new Set(['Planned','In Progress']);
  const EXECUTION_WORK_PACKAGE_STATES=new Set(['Ready','In Progress','Blocked']);
  const clean=v=>String(v??'').trim();
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const demandRows=()=>typeof db!=='undefined'?(db.demand||[]):[];
  const allocationRows=()=>typeof db!=='undefined'?(db.allocations||[]):[];
  const workPackageRows=()=>window.WorkPackages?.state?.rows||[];
  const today=()=>new Date().toISOString().slice(0,10);
  const canonicalDemandState=d=>window.DefinedDemandModel?.canonicalState?.(d?.status)||clean(d?.status);
  const isOpen=d=>window.DefinedDemandModel?.isOpen?.(d)??(typeof isOpenDemand==='function'?isOpenDemand(d):true);
  const monthLabelSafe=m=>typeof monthLabel==='function'?monthLabel(`${m}-01`):m;
  const personName=id=>(db.team||[]).find(p=>p.id===id)?.name||id||'Unknown person';
  let activeFilter=null;

  function allocationHasCommitment(a){
    return !!clean(a?.teamMemberId)&&Object.values(a?.forecast||{}).some(v=>Number(v)>0)
  }
  function allocationInMonth(a,month){
    const rm=window.ReportingModel,key=rm?.monthStart?.(month)||`${String(month||'').slice(0,7)}-01`;
    return Number(a?.forecast?.[key]??a?.forecast?.[String(month||'').slice(0,7)]||0)>0
  }
  function committedDemand(d){return COMMITTED_DEMAND_STATES.has(canonicalDemandState(d))}
  function workPackageRequiresWorkItem(wp){
    const status=clean(wp?.status);
    if(EXECUTION_WORK_PACKAGE_STATES.has(status))return true;
    return status==='Planned'&&!!clean(wp?.targetStart)&&clean(wp.targetStart)<=today()
  }
  function demandAllocations(demandId){return allocationRows().filter(a=>a.demandId===demandId&&allocationHasCommitment(a))}
  function missingWorkItemsForDemand(demandId){return workPackageRows().filter(w=>w.demandId===demandId&&workPackageRequiresWorkItem(w)&&!clean(w.azureDevOpsWorkItemId))}
  function latestActualMonth(){const rm=window.ReportingModel;return rm?.ensureLoaded?.()?rm.latestActualMonth?.()||'':''}
  function missingActualAllocationsForDemand(demandId,month=latestActualMonth()){
    const rm=window.ReportingModel;if(!month||!rm?.actualsAvailable?.(month))return[];
    return demandAllocations(demandId).filter(a=>allocationInMonth(a,month)&&Number(rm.actualHours?.(a.teamMemberId,demandId,month)||0)<=0)
  }
  function demandControl(d){
    const rm=window.ReportingModel,month=latestActualMonth(),allocations=demandAllocations(d.id),missingActuals=missingActualAllocationsForDemand(d.id,month),missingWorkItems=missingWorkItemsForDemand(d.id),plannedFte=month&&rm?.actualsAvailable?.(month)?Number(rm.forecastFte?.(null,d.id,month)||0):0,actualFte=month&&rm?.actualsAvailable?.(month)?Number(rm.actualFte?.(null,d.id,month)||0):0;
    return{demand:d,committed:committedDemand(d),funded:!!clean(d.projectNumber),projectNumber:clean(d.projectNumber),allocations,resourced:allocations.length>0,missingWorkItems,deliveryTracked:missingWorkItems.length===0,actualMonth:month,actualsDue:!!month&&allocations.some(a=>allocationInMonth(a,month)),missingActuals,actualStatus:!month||!allocations.some(a=>allocationInMonth(a,month))?'not-due':missingActuals.length?'missing':'received',plannedFte,actualFte}
  }
  function unexpectedActuals(month=latestActualMonth()){
    const rm=window.ReportingModel;if(!month||!rm?.actualsAvailable?.(month))return[];
    const zero=rm.SIGNAL_THRESHOLDS?.zeroFte??.01,rows=[];
    for(const p of db.team||[]){
      if(p.active===false)continue;
      for(const r of rm.personDemandRows?.(p.id,month)||[]){
        if(r.demandId&&Number(r.plannedFte||0)<zero&&Number(r.actualFte||0)>=zero)rows.push({month,teamMemberId:p.id,person:p.name||p.id,demandId:r.demandId,actualFte:Number(r.actualFte||0)})
      }
    }
    return rows
  }
  function snapshot(){
    const active=demandRows().filter(isOpen),controls=active.map(demandControl),committed=controls.filter(c=>c.committed),missingWorkItems=[];
    for(const c of controls)for(const wp of c.missingWorkItems)missingWorkItems.push({demandId:c.demand.id,demandTitle:c.demand.title,workPackageId:wp.id,workPackageTitle:wp.title,status:wp.status});
    const missingActuals=[];for(const c of controls)for(const a of c.missingActuals)missingActuals.push({demandId:c.demand.id,demandTitle:c.demand.title,allocationId:a.id,teamMemberId:a.teamMemberId,person:personName(a.teamMemberId),month:c.actualMonth});
    const canonicalUnmet=typeof unresolvedWithoutAllocation==='function'?unresolvedWithoutAllocation():active.filter(d=>!demandAllocations(d.id).length);
    const month=latestActualMonth(),rm=window.ReportingModel,plannedFte=month?Number(rm?.forecastFte?.(null,null,month)||0):0,actualFte=month?Number(rm?.actualFte?.(null,null,month)||0):0;
    return{month,committed,committedWithoutProject:committed.filter(c=>c.resourced&&!c.funded),committedWithoutAllocation:committed.filter(c=>!c.resourced),missingWorkItems,missingActuals,unexpectedActuals:unexpectedActuals(month),unmetDemand:canonicalUnmet,plannedFte,actualFte}
  }
  function demandSummaryText(d){
    const c=demandControl(d),parts=[];
    if(c.committed)parts.push(c.funded?`Funded ${c.projectNumber}`:'Funding missing');else parts.push(c.funded?`Project ${c.projectNumber}`:'Not committed');
    parts.push(c.deliveryTracked?'Delivery tracked':`${c.missingWorkItems.length} WP untracked`);
    parts.push(c.resourced?'Resourced':'No allocation');
    parts.push(c.actualStatus==='missing'?'Actuals missing':c.actualStatus==='received'?'Actuals received':'Actuals not due');
    return parts.join(' · ')
  }
  function badge(label,state='neutral',title=''){return`<span class="commitment-badge ${state}"${title?` title="${esc(title)}"`:''}>${esc(label)}</span>`}
  function demandBadges(d){
    const c=demandControl(d),parts=[];
    parts.push(c.committed?(c.funded?badge(`Funded ${c.projectNumber}`,'good'):badge('Funding missing','bad')):(c.funded?badge(`Project ${c.projectNumber}`,'neutral'):badge('Not committed','neutral')));
    parts.push(c.deliveryTracked?badge('Delivery tracked','good'):badge(`${c.missingWorkItems.length} WP untracked`,'warn'));
    parts.push(c.resourced?badge('Resourced','good'):badge('No allocation',c.committed?'bad':'neutral'));
    parts.push(c.actualStatus==='missing'?badge('Actuals missing','bad'):c.actualStatus==='received'?badge('Actuals received','good'):badge('Actuals not due','neutral'));
    return`<div class="commitment-badges">${parts.join('')}</div>`
  }
  function filterLabel(kind){return({'no-project':'Committed without Project','no-allocation':'Committed without allocation','unmet-demand':'Unmet demand','missing-actuals':'Allocations without Actuals'}[kind]||kind)}
  function matchesDemandFilter(d){
    if(!activeFilter||activeFilter.view!=='demand')return true;const s=snapshot();
    if(activeFilter.kind==='no-project')return s.committedWithoutProject.some(c=>c.demand.id===d.id);
    if(activeFilter.kind==='no-allocation')return s.committedWithoutAllocation.some(c=>c.demand.id===d.id);
    if(activeFilter.kind==='unmet-demand')return s.unmetDemand.some(x=>x.id===d.id);
    return true
  }
  function matchesAllocationDemandFilter(d){
    if(!activeFilter||activeFilter.view!=='allocations')return true;const s=snapshot();
    if(activeFilter.kind==='missing-actuals')return s.missingActuals.some(x=>x.demandId===d.id);
    if(activeFilter.kind==='no-project')return s.committedWithoutProject.some(c=>c.demand.id===d.id);
    return true
  }
  function clearFilter(){activeFilter=null}
  function navigate(kind,detail={}){
    if(kind==='missing-work-item'&&detail.workPackageId){const wp=workPackageRows().find(w=>w.id===detail.workPackageId);if(wp){window.WorkPackages?.openEditor?.(wp);return}}
    if(kind==='unexpected-actuals'){activeFilter={view:'actuals',kind};if(typeof switchView==='function')switchView('actuals');renderActualsControl();return}
    const view=kind==='missing-actuals'?'allocations':'demand';activeFilter={view,kind};if(typeof switchView==='function')switchView(view);if(view==='demand'&&typeof renderGrid==='function')renderGrid('demand');if(view==='allocations'&&typeof renderAllocations==='function')renderAllocations()
  }

  function decorateDemandGrid(){
    const table=document.getElementById('demandTable');if(!table)return;
    const header=[...table.querySelectorAll('thead tr:first-child th')].findIndex(th=>/Commitment/i.test(th.textContent||''));if(header<0)return;
    table.querySelectorAll('tbody tr[data-row]').forEach(tr=>{const d=demandRows().find(x=>x.id===tr.dataset.row);const cell=tr.children[header];if(d&&cell&&!(typeof gridState!=='undefined'&&gridState.demand?.editing))cell.innerHTML=demandBadges(d)});
    if(activeFilter?.view==='demand'){const toolbar=document.getElementById('demandToolbar');if(toolbar&&!toolbar.querySelector('[data-clear-commitment-filter]'))toolbar.insertAdjacentHTML('beforeend',`<button class="btn" data-clear-commitment-filter>Control filter: ${esc(filterLabel(activeFilter.kind))} ×</button>`);toolbar?.querySelector('[data-clear-commitment-filter]')?.addEventListener('click',()=>{clearFilter();renderGrid('demand')})}
  }
  function decorateAllocations(){
    const table=document.getElementById('allocationTable');if(!table)return;const s=snapshot();
    table.querySelectorAll('.allocation-demand-header').forEach(row=>{const id=clean(row.querySelector('.allocation-demand-id')?.textContent),d=demandRows().find(x=>x.id===id),c=d&&demandControl(d),summary=row.querySelector('.allocation-demand-summary');if(!c||!summary||summary.querySelector('.commitment-inline'))return;const recovery=c.actualMonth?`${monthLabelSafe(c.actualMonth)} ${c.actualFte.toFixed(1)} / ${c.plannedFte.toFixed(1)} FTE actual / plan`:'Actuals not yet available';summary.insertAdjacentHTML('afterend',`<span class="commitment-inline">${c.projectNumber?badge(`Project ${c.projectNumber}`,'good'):badge('No Project',c.committed&&c.resourced?'bad':'neutral')}${badge(recovery,c.actualStatus==='missing'?'bad':c.actualStatus==='received'?'good':'neutral')}</span>`)});
    table.querySelectorAll('.allocation-wp-header').forEach(row=>{const strong=row.querySelector('strong');if(!strong||row.querySelector('.commitment-inline'))return;const id=clean(strong.textContent).split(' · ')[0],wp=workPackageRows().find(w=>w.id===id);if(!wp)return;const demand=demandRows().find(d=>d.id===wp.demandId),url=window.WorkPackages?.workItemUrl?.(wp,demand)||'';let html='';if(clean(wp.azureDevOpsWorkItemId))html=url?`<a class="commitment-work-item" href="${esc(url)}" target="_blank" rel="noopener">Azure DevOps #${esc(wp.azureDevOpsWorkItemId)} ↗</a>`:badge(`Work Item #${wp.azureDevOpsWorkItemId} · Azure DevOps not configured`,'warn');else if(workPackageRequiresWorkItem(wp))html=`<button type="button" class="commitment-link-button" data-open-missing-wp="${esc(wp.id)}">${badge('Work Item missing','bad')}</button>`;else html=badge('Work Item not yet required','neutral');strong.insertAdjacentHTML('afterend',`<span class="commitment-inline">${html}</span>`)});
    table.querySelectorAll('[data-open-missing-wp]').forEach(b=>b.addEventListener('click',()=>navigate('missing-work-item',{workPackageId:b.dataset.openMissingWp})));
    if(activeFilter?.view==='allocations'){const toolbar=document.getElementById('allocationToolbar');if(toolbar&&!toolbar.querySelector('[data-clear-commitment-filter]'))toolbar.insertAdjacentHTML('beforeend',`<button class="btn" data-clear-commitment-filter>Control filter: ${esc(filterLabel(activeFilter.kind))} ×</button>`);toolbar?.querySelector('[data-clear-commitment-filter]')?.addEventListener('click',()=>{clearFilter();renderAllocations()})}
  }
  function dashboardControlHtml(){
    const s=snapshot(),month=s.month?monthLabelSafe(s.month):'No imported period',ratio=s.plannedFte?Math.round(s.actualFte/s.plannedFte*100):0;
    const cards=[['Committed demand',s.committed.length,'Committed portfolio','committed'],['No Project',s.committedWithoutProject.length,'Committed and resourced','no-project'],['Unmet demand',s.unmetDemand.length,'No named allocation','unmet-demand'],['Work Items missing',s.missingWorkItems.length,'Execution tracking gap','missing-work-item-list'],['Actuals missing',s.missingActuals.length,`Due in ${month}`,'missing-actuals'],['Actual / plan',s.month?`${ratio}%`:'—',s.month?`${s.actualFte.toFixed(1)} / ${s.plannedFte.toFixed(1)} FTE · ${month}`:'No Actuals imported','recovery']];
    const exceptions=[];
    for(const c of s.committedWithoutProject)exceptions.push(`<li><button data-commitment-nav="no-project"><strong>${esc(c.demand.id)}</strong> — ${esc(c.demand.title)}: committed resource has no Project Number.</button></li>`);
    for(const c of s.committedWithoutAllocation)exceptions.push(`<li><button data-commitment-nav="no-allocation"><strong>${esc(c.demand.id)}</strong> — ${esc(c.demand.title)}: committed Demand has no named allocation.</button></li>`);
    for(const x of s.missingWorkItems)exceptions.push(`<li><button data-commitment-nav="missing-work-item" data-work-package-id="${esc(x.workPackageId)}"><strong>${esc(x.demandId)} / ${esc(x.workPackageId)}</strong> — ${esc(x.workPackageTitle)}: Work Item is not linked.</button></li>`);
    for(const x of s.missingActuals)exceptions.push(`<li><button data-commitment-nav="missing-actuals"><strong>${esc(x.demandId)}</strong> — ${esc(x.person)}: planned allocation has no Actuals in ${esc(monthLabelSafe(x.month))}.</button></li>`);
    if(s.unexpectedActuals.length)exceptions.push(`<li><button data-commitment-nav="unexpected-actuals"><strong>Recovery:</strong> ${s.unexpectedActuals.length} Actuals entr${s.unexpectedActuals.length===1?'y':'ies'} have no corresponding planned allocation in ${esc(month)}.</button></li>`);
    return`<section id="commitmentControlPanel" class="commitment-control-panel"><div class="section-title"><div><h2>Delivery &amp; Funding</h2><span class="muted">Derived controls over committed work, delivery tracking, funding, resource and Actual recovery</span></div></div><div class="grid kpis commitment-kpis">${cards.map(([label,value,sub,kind])=>`<button class="card commitment-kpi" data-commitment-nav="${kind}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${esc(sub)}</div></button>`).join('')}</div><div class="card commitment-attention"><div class="section-title" style="margin-top:0"><h3>Commitment controls requiring attention</h3></div>${exceptions.length?`<ul>${exceptions.join('')}</ul>`:'<span class="muted">No funding, delivery-tracking, allocation or recovery exceptions are currently identified.</span>'}</div></section>`
  }
  function renderDashboardControl(){
    const dashboard=document.getElementById('dashboard'),kpis=document.getElementById('kpiGrid');if(!dashboard||!kpis||!workspaceHandle)return;document.getElementById('commitmentControlPanel')?.remove();kpis.insertAdjacentHTML('afterend',dashboardControlHtml());dashboard.querySelectorAll('[data-commitment-nav]').forEach(el=>el.addEventListener('click',()=>{const kind=el.dataset.commitmentNav;if(kind==='committed'||kind==='recovery')return;if(kind==='missing-work-item-list'){const first=snapshot().missingWorkItems[0];if(first)navigate('missing-work-item',{workPackageId:first.workPackageId});return}navigate(kind,{workPackageId:el.dataset.workPackageId})}))
  }
  function renderActualsControl(){
    const host=document.getElementById('actualsAdminContent');if(!host||!workspaceHandle)return;document.getElementById('actualsCommitmentControl')?.remove();const s=snapshot(),month=s.month?monthLabelSafe(s.month):'latest imported period',panel=document.createElement('div');panel.id='actualsCommitmentControl';panel.className='card';panel.style.marginBottom='16px';const rows=s.unexpectedActuals;panel.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Allocation reconciliation</h2><span class="muted">Actuals with no corresponding planned allocation in ${esc(month)}</span></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Person</th><th>Demand</th><th>Actual FTE</th><th>Issue</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.person)}</td><td>${esc(r.demandId)}</td><td>${r.actualFte.toFixed(2)}</td><td><span class="pill amber">No planned allocation</span></td></tr>`).join('')}</tbody></table></div>`:'<span class="muted">No unexpected Actuals are identified for the latest imported period.</span>'}`;host.prepend(panel)
  }

  function install(){
    if(window.__amoCommitmentHealthInstalled)return true;
    if(typeof renderGrid!=='function'||typeof renderDashboard!=='function'||typeof dashboardHeadlineSnapshot!=='function')return false;
    window.__amoCommitmentHealthInstalled=true;
    if(typeof demandCols!=='undefined'&&!demandCols.some(c=>c.key==='_commitmentControl')){const at=Math.max(0,demandCols.findIndex(c=>c.key==='health'));demandCols.splice(at<0?demandCols.length:at,0,{key:'_commitmentControl',label:'Commitment',type:'text',editable:false,derived:true})}
    const baseDisplay=displayVal;displayVal=function(row,col){if(col?.key==='_commitmentControl')return demandSummaryText(row);return baseDisplay(row,col)};
    const baseGridRows=gridRows;gridRows=function(name){const rows=baseGridRows(name);return name==='demand'?rows.filter(matchesDemandFilter):rows};
    const baseRenderGrid=renderGrid;renderGrid=function(name){const r=baseRenderGrid(name);if(name==='demand')decorateDemandGrid();return r};
    const baseRenderAllocations=renderAllocations;renderAllocations=function(){const original=db.demand;if(activeFilter?.view==='allocations')db.demand=original.filter(matchesAllocationDemandFilter);try{const r=baseRenderAllocations.apply(this,arguments);decorateAllocations();return r}finally{db.demand=original}};
    window.renderAllocations=renderAllocations;
    const baseDashboard=renderDashboard;renderDashboard=function(){const r=baseDashboard.apply(this,arguments);renderDashboardControl();return r};
    const baseActuals=typeof renderActualsAdmin==='function'?renderActualsAdmin:null;if(baseActuals)renderActualsAdmin=function(){const r=baseActuals.apply(this,arguments);renderActualsControl();return r};
    window.addEventListener('amo:actuals-updated',()=>{renderDashboardControl();renderActualsControl();decorateAllocations()});window.addEventListener('amo:work-packages-updated',()=>{renderDashboardControl();decorateDemandGrid();decorateAllocations()});window.addEventListener('amo:reporting-model-updated',()=>{renderDashboardControl();renderActualsControl();decorateAllocations()});
    return true
  }
  function ensureInstalled(){if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>100)clearInterval(timer)},20)}
  window.CommitmentHealth={COMMITTED_DEMAND_STATES,EXECUTION_WORK_PACKAGE_STATES,allocationHasCommitment,committedDemand,workPackageRequiresWorkItem,demandAllocations,missingWorkItemsForDemand,missingActualAllocationsForDemand,demandControl,unexpectedActuals,snapshot,demandSummaryText,demandBadges,matchesDemandFilter,matchesAllocationDemandFilter,navigate,clearFilter,renderDashboardControl,renderActualsControl,decorateDemandGrid,decorateAllocations,install};
  ensureStyles();ensureInstalled();

  function ensureStyles(){if(document.getElementById('commitment-health-styles'))return;const s=document.createElement('style');s.id='commitment-health-styles';s.textContent=`
.commitment-control-panel{margin-top:16px}.commitment-kpis{grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:12px}.commitment-kpi{border:1px solid var(--line);text-align:left;color:inherit;cursor:pointer}.commitment-kpi[data-commitment-nav="committed"],.commitment-kpi[data-commitment-nav="recovery"]{cursor:default}.commitment-kpi:not([data-commitment-nav="committed"]):not([data-commitment-nav="recovery"]):hover{border-color:var(--accent)}.commitment-attention{box-shadow:none}.commitment-attention ul{margin:0;padding-left:0;list-style:none}.commitment-attention li+li{border-top:1px solid var(--line)}.commitment-attention li button{display:block;width:100%;padding:9px 0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.commitment-badges,.commitment-inline{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.commitment-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;font-size:.68rem;font-weight:750;background:color-mix(in srgb,var(--line) 55%,transparent)}.commitment-badge.good{background:color-mix(in srgb,#2f9e63 16%,transparent)}.commitment-badge.warn{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}.commitment-badge.bad{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}.commitment-inline{margin-left:6px}.commitment-work-item{font-size:.72rem;font-weight:750}.commitment-link-button{border:0;background:transparent;padding:0;cursor:pointer}@media(max-width:1200px){.commitment-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.commitment-kpis{grid-template-columns:1fr}}
`;document.head.appendChild(s)}
})();
