/* Canonical Work Package resource-planning UI.
   Demand provides planning context; named-person allocations are created against Work Packages.
   Existing Demand-only allocations remain visible as legacy undecomposed rows and can be explicitly
   assigned to a Work Package. Actuals remain Demand/Project-level and are not inferred here. */
(function initWorkPackageResourcePlanning(){
  const expandedDemandIds=new Set(),expandedWorkPackageIds=new Set();
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'');
  const months=()=>typeof planningMonths==='function'?planningMonths():[];
  const wpRows=()=>window.WorkPackages?.state?.rows||[];
  const packagesForDemand=id=>window.WorkPackages?.forDemand?.(id)||[];
  const activePeople=()=>db.team.filter(p=>p.active!==false);
  const allocationSource=()=>allocationState.editing?allocationState.draft:db.allocations;
  const isLegacy=a=>window.AllocationModel?.isLegacyUndecomposed?window.AllocationModel.isLegacyUndecomposed(a):!a.workPackageId;
  const allocationDays=(a,month)=>{const p=db.team.find(x=>x.id===a.teamMemberId),fraction=Number(a.forecast?.[month])||0,fte=Number(p?.fte)||0,days=window.ReportingModel?.workingDays?.(month)||0;return fraction*fte*days};
  const resourceDaysFor=predicate=>months().reduce((total,m)=>total+allocationSource().filter(a=>!allocationState.deleted.has(a.id)&&predicate(a)).reduce((n,a)=>n+allocationDays(a,m),0),0);
  const fmtDays=n=>`${Number(n||0).toFixed(Math.abs((n||0)%1)>.001?1:0)}d`;

  function planningSummary(d){
    const wp=window.WorkPackages?.summaryForDemand?.(d.id)||{count:0,estimatedCount:0,estimatedEffortDays:0};
    const rom=d.initialEstimate?.estimatedDays==null?null:Number(d.initialEstimate.estimatedDays),budget=d.budgetForecast?.estimatedDays==null?null:Number(d.budgetForecast.estimatedDays),resource=resourceDaysFor(a=>a.demandId===d.id);
    return{rom,budget,wpCount:wp.count||0,wpEstimate:wp.estimatedCount?Number(wp.estimatedEffortDays):null,resource,legacyCount:allocationSource().filter(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&isLegacy(a)).length}
  }
  function packageSummary(wp){return{estimate:wp.estimatedEffortDays==null?null:Number(wp.estimatedEffortDays),resource:resourceDaysFor(a=>a.workPackageId===wp.id)}}
  function nextAllocationId(){const rows=[...db.allocations,...(allocationState.draft||[])],max=Math.max(0,...rows.map(a=>Number((a.id||'').match(/(\d+)$/)?.[1]||0)));return`ALLOC-${new Date().getFullYear()}-${String(max+1).padStart(4,'0')}`}
  function blankAllocation(demandId,workPackageId){return{id:nextAllocationId(),demandId,workPackageId,teamMemberId:'',forecast:Object.fromEntries(months().map(m=>[m,0])),version:1,_draft:true}}

  function addAllocation(workPackageId){if(!allocationState.editing)return;const wp=wpRows().find(x=>x.id===workPackageId);if(!wp)return;const a=blankAllocation(wp.demandId,wp.id);allocationState.draft.push(a);expandedDemandIds.add(wp.demandId);expandedWorkPackageIds.add(wp.id);renderAllocations();requestAnimationFrame(()=>document.querySelector(`[data-aid="${CSS.escape(a.id)}"] .alloc-resource-select`)?.focus())}
  function assignLegacy(aid,workPackageId){const a=allocationState.draft.find(x=>x.id===aid),wp=wpRows().find(x=>x.id===workPackageId);if(!a)return;if(!wp){a.workPackageId=null;return}if(wp.demandId!==a.demandId){alert('The selected Work Package does not belong to this Demand.');return}a.workPackageId=wp.id;renderAllocations()}
  function setPerson(aid,id){const a=allocationState.draft.find(x=>x.id===aid);if(!a)return;a.teamMemberId=id;for(const m of months())a.forecast[m]=id?(Number(a.forecast[m])||0):0;renderAllocations()}
  function setPct(aid,month,value){const a=allocationState.draft.find(x=>x.id===aid);if(a)a.forecast[month]=Math.max(0,Math.min(100,Number(value)||0))/100}

  function rowHtml(a,demandId,{legacy=false}={}){
    const editing=allocationState.editing,person=db.team.find(p=>p.id===a.teamMemberId),wpOptions=packagesForDemand(demandId);
    const resource=editing?`<select class="cell-input alloc-resource-select" data-aid="${esc(a.id)}"><option value="">Select resource…</option>${activePeople().map(p=>`<option value="${esc(p.id)}" ${p.id===a.teamMemberId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`:(person?.name||a.teamMemberId||'Unallocated');
    const migrate=legacy?(editing?`<select class="cell-input legacy-wp-select" data-aid="${esc(a.id)}"><option value="">Unassigned to WP</option>${wpOptions.map(w=>`<option value="${esc(w.id)}">${esc(w.id)} · ${esc(w.title)}</option>`).join('')}</select>`:'<span class="pill amber">Unassigned to WP</span>'):'';
    return`<tr class="allocation-row${legacy?' allocation-legacy':''}" data-aid="${esc(a.id)}">${editing?`<td><button class="allocation-remove" data-remove-allocation="${esc(a.id)}" type="button">−</button></td>`:''}<td>${resource}${migrate?`<div class="allocation-migrate">${migrate}</div>`:''}</td>${months().map(m=>`<td>${editing&&a.teamMemberId?`<input class="cell-input compact alloc-pct" type="number" min="0" max="100" step="5" data-aid="${esc(a.id)}" data-month="${esc(m)}" value="${Math.round((Number(a.forecast?.[m])||0)*100)}">`:(a.teamMemberId?`${Math.round((Number(a.forecast?.[m])||0)*100)}%`:'—')}</td>`).join('')}</tr>`
  }
  function wpHtml(wp,demand){const open=expandedWorkPackageIds.has(wp.id),summary=packageSummary(wp),allocs=allocationSource().filter(a=>a.workPackageId===wp.id&&!allocationState.deleted.has(a.id));return`<tr class="allocation-wp-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><div class="allocation-wp-heading"><button type="button" class="allocation-tree-toggle" data-toggle-wp="${esc(wp.id)}">${open?'▾':'▸'}</button><strong>${esc(wp.id)} · ${esc(wp.title)}</strong><span class="muted">Estimate ${summary.estimate==null?'—':fmtDays(summary.estimate)} · Resource Plan ${fmtDays(summary.resource)}</span>${allocationState.editing?`<button type="button" class="btn allocation-add" data-add-wp="${esc(wp.id)}">＋ Allocate Person</button>`:''}</div></td></tr>${open?allocs.map(a=>rowHtml(a,demand.id)).join(''):''}`}
  function demandHtml(d){const open=expandedDemandIds.has(d.id),summary=planningSummary(d),wps=packagesForDemand(d.id),legacy=allocationSource().filter(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&isLegacy(a));return`<tr class="allocation-demand-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><div class="allocation-demand-heading"><button type="button" class="allocation-tree-toggle" data-toggle-demand="${esc(d.id)}">${open?'▾':'▸'}</button><div><span class="allocation-demand-id">${esc(d.id)}</span><strong>${esc(d.title)}</strong><span class="allocation-demand-summary">ROM ${summary.rom==null?'—':fmtDays(summary.rom)} · Budget Forecast ${summary.budget==null?'—':fmtDays(summary.budget)} · WP Estimate ${summary.wpEstimate==null?'—':fmtDays(summary.wpEstimate)} · Resource Plan ${fmtDays(summary.resource)}</span>${summary.legacyCount?`<span class="pill amber">${summary.legacyCount} undecomposed</span>`:''}</div></div></td></tr>${open?`${legacy.length?`<tr class="allocation-legacy-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><strong>Legacy / unassigned to Work Package</strong><span class="muted"> Assign each existing allocation to a Work Package when known.</span></td></tr>${legacy.map(a=>rowHtml(a,d.id,{legacy:true})).join('')}`:''}${wps.map(w=>wpHtml(w,d)).join('')}${!wps.length?`<tr><td colspan="${1+months().length+(allocationState.editing?1:0)}" class="muted">No Work Packages. Create a Work Package before adding new resource allocations.</td></tr>`:''}`:''}`}

  function filteredDemands(){const demandFilter=String(allocationState.filters.demand||'').toLowerCase(),personFilter=String(allocationState.filters.person||'').toLowerCase();return db.demand.filter(isOpenDemand).filter(d=>!demandFilter||`${d.id} ${d.title}`.toLowerCase().includes(demandFilter)).filter(d=>!personFilter||allocationSource().some(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&(db.team.find(p=>p.id===a.teamMemberId)?.name||'').toLowerCase().includes(personFilter)))}
  function bind(){
    document.querySelectorAll('[data-toggle-demand]').forEach(b=>b.onclick=()=>{expandedDemandIds.has(b.dataset.toggleDemand)?expandedDemandIds.delete(b.dataset.toggleDemand):expandedDemandIds.add(b.dataset.toggleDemand);renderAllocations()});
    document.querySelectorAll('[data-toggle-wp]').forEach(b=>b.onclick=()=>{expandedWorkPackageIds.has(b.dataset.toggleWp)?expandedWorkPackageIds.delete(b.dataset.toggleWp):expandedWorkPackageIds.add(b.dataset.toggleWp);renderAllocations()});
    document.querySelectorAll('[data-add-wp]').forEach(b=>b.onclick=()=>addAllocation(b.dataset.addWp));
    document.querySelectorAll('.alloc-resource-select').forEach(el=>el.onchange=()=>setPerson(el.dataset.aid,el.value));
    document.querySelectorAll('.legacy-wp-select').forEach(el=>el.onchange=()=>assignLegacy(el.dataset.aid,el.value));
    document.querySelectorAll('.alloc-pct').forEach(el=>el.onchange=()=>setPct(el.dataset.aid,el.dataset.month,el.value));
    document.querySelectorAll('[data-remove-allocation]').forEach(el=>el.onclick=()=>{allocationState.deleted.add(el.dataset.removeAllocation);renderAllocations()});
  }

  window.renderAllocations=renderAllocations=function(){
    const editing=allocationState.editing,demands=filteredDemands();
    $('allocationToolbar').innerHTML=editing?'<button class="btn success" id="saveAllocations">Save Changes</button><button class="btn" id="cancelAllocations">Cancel</button><button class="btn" id="clearAllocationFilters">Clear Filters</button>':`<button class="btn" id="editAllocations" ${workspaceHandle?'':'disabled'}>Edit Resource Plan</button><button class="btn" id="clearAllocationFilters">Clear Filters</button>`;
    const legacyCount=allocationSource().filter(a=>!allocationState.deleted.has(a.id)&&isLegacy(a)).length,total=allocationSource().filter(a=>!allocationState.deleted.has(a.id)).length;
    $('allocationCount').textContent=workspaceHandle?`${total} allocations · ${legacyCount?`${legacyCount} legacy allocation${legacyCount===1?'':'s'} still need Work Package assignment`:'all allocations assigned to Work Packages'}`:'No workspace loaded';
    const colspan=1+months().length+(editing?1:0);
    $('allocationTable').innerHTML=`<thead><tr>${editing?'<th></th>':''}<th>Resource</th>${months().map(m=>`<th class="month">${monthLabel(m)}</th>`).join('')}</tr><tr class="filter-row">${editing?'<th></th>':''}<th><input id="allocationPersonFilter" value="${esc(allocationState.filters.person||'')}" placeholder="filter resource…"></th>${months().map(()=>'<th></th>').join('')}</tr><tr><th colspan="${colspan}"><input id="allocationDemandFilter" value="${esc(allocationState.filters.demand||'')}" placeholder="filter demand ID or title…"></th></tr></thead><tbody>${demands.map(demandHtml).join('')}</tbody>`;
    $('editAllocations')?.addEventListener('click',()=>{allocationState.editing=true;allocationState.draft=clone(db.allocations);allocationState.deleted=new Set();for(const d of db.demand)expandedDemandIds.add(d.id);renderAllocations()});
    $('cancelAllocations')?.addEventListener('click',()=>{allocationState.editing=false;allocationState.draft=null;allocationState.deleted=new Set();renderAllocations()});
    $('clearAllocationFilters').onclick=()=>{allocationState.filters={demand:'',person:''};renderAllocations()};
    $('saveAllocations')?.addEventListener('click',saveAllocations);
    bind();
    const bindFilter=(id,key)=>$(id)?.addEventListener('input',e=>{allocationState.filters[key]=e.target.value;renderAllocations()});bindFilter('allocationDemandFilter','demand');bindFilter('allocationPersonFilter','person')
  };

  window.saveAllocations=saveAllocations=function(){
    const pending=allocationState.draft.filter(a=>!allocationState.deleted.has(a.id));
    for(const a of pending){const result=window.AllocationModel?.validate?.(a,{demand:db.demand,team:db.team,workPackages:wpRows(),allowLegacy:true});if(result&&!result.valid){alert(result.errors.join('\n'));return}if(!a.teamMemberId){alert('Select a valid Resource for every allocation, or remove the incomplete row.');return}if(a._draft&&!a.workPackageId){alert('New allocations must be created against a Work Package.');return}}
    const finalIds=new Set(pending.map(a=>a.id)),oldMap=new Map(db.allocations.map(a=>[a.id,a]));for(const old of db.allocations)if(!finalIds.has(old.id))deletedAllocations.add(old.id);for(const a of pending){const old=oldMap.get(a.id);if(!old||JSON.stringify(old)!==JSON.stringify(a)){dirtyRecords.allocations.add(a.id);a.version=(Number(a.version)||0)+1;a.modifiedAt=new Date().toISOString()}}
    db.allocations=pending.map(a=>{const x=clone(a);delete x._draft;return x});allocationState.editing=false;allocationState.draft=null;allocationState.deleted=new Set();updateBanner();log('Work Package resource plan changes committed.');if(typeof requestAutosave==='function')requestAutosave();refreshAll()
  };

  const style=document.createElement('style');style.id='wp-resource-planning-styles';style.textContent=`#allocationTable .allocation-tree-toggle{border:0;background:transparent;color:var(--muted);font-weight:900;cursor:pointer;padding:2px 5px}#allocationTable .allocation-demand-heading,#allocationTable .allocation-wp-heading{display:flex;align-items:center;gap:8px}#allocationTable .allocation-demand-heading>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.allocation-demand-summary{font-size:.72rem;color:var(--muted)}#allocationTable .allocation-wp-header td{background:color-mix(in srgb,var(--panel) 92%,var(--line));padding-left:24px}.allocation-wp-heading .allocation-add{margin-left:auto}.allocation-legacy-header td{background:color-mix(in srgb,var(--warn) 10%,var(--panel));padding-left:34px}.allocation-legacy td:first-of-type{border-left:3px solid var(--warn)}.allocation-migrate{margin-top:5px}.legacy-wp-select{font-size:.72rem}.pill.amber{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}@media(max-width:760px){#allocationTable .allocation-demand-heading>div{align-items:flex-start}.allocation-demand-summary{display:block;width:100%}.allocation-wp-heading{flex-wrap:wrap}.allocation-wp-heading .allocation-add{margin-left:0}}`;document.head.appendChild(style);
  window.WorkPackageResourcePlanning={planningSummary,packageSummary,resourceDaysFor,expandedDemandIds,expandedWorkPackageIds};
})();
