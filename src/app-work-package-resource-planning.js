/* Canonical Work Package resource-planning UI.
   Demand provides planning context; named-person allocations are created against Work Packages.
   Existing Demand-only allocations remain visible as legacy undecomposed rows and can be explicitly
   assigned to a Work Package. Actuals remain Demand/Project-level and are not inferred here.

   This module also owns the rich month-cell editing experience. There is one renderer, one draft
   model and one save path: direct percentage entry, snapped vertical drag and directional fill all
   mutate allocationState.draft before refreshing the affected person's capacity visuals. */
(function initWorkPackageResourcePlanning(){
  const SNAP_VALUES=[0,10,20,40,60,80,100];
  const expandedDemandIds=new Set(),expandedWorkPackageIds=new Set();
  let activeAllocationRowId=null;
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'');
  const months=()=>typeof planningMonths==='function'?planningMonths():[];
  const wpRows=()=>window.WorkPackages?.state?.rows||[];
  const packagesForDemand=id=>window.WorkPackages?.forDemand?.(id)||[];
  const activePeople=()=>db.team.filter(p=>p.active!==false);
  const allocationSource=()=>allocationState.editing?allocationState.draft:db.allocations;
  const currentAllocation=aid=>allocationState.draft?.find(a=>a.id===aid);
  const isLegacy=a=>window.AllocationModel?.isLegacyUndecomposed?window.AllocationModel.isLegacyUndecomposed(a):!a.workPackageId;
  const allocationDays=(a,month)=>{const p=db.team.find(x=>x.id===a.teamMemberId),fraction=Number(a.forecast?.[month])||0,fte=Number(p?.fte)||0,days=window.ReportingModel?.workingDays?.(month)||0;return fraction*fte*days};
  const resourceDaysFor=predicate=>months().reduce((total,m)=>total+allocationSource().filter(a=>!allocationState.deleted.has(a.id)&&predicate(a)).reduce((n,a)=>n+allocationDays(a,m),0),0);
  const fmtDays=n=>`${Number(n||0).toFixed(Math.abs((n||0)%1)>.001?1:0)}d`;
  const monthPct=(a,m)=>Math.max(0,Math.min(100,Math.round((Number(a?.forecast?.[m])||0)*100)));

  function totalResourceFraction(resourceId,month){
    if(!resourceId)return 0;
    return allocationSource().filter(a=>a.teamMemberId===resourceId&&!allocationState.deleted.has(a.id)).reduce((n,a)=>n+(Number(a.forecast?.[month])||0),0)
  }
  function capacityState(resourceId,month){
    const usedPct=totalResourceFraction(resourceId,month)*100;
    if(usedPct>100.0001)return'red';
    if(usedPct>=80)return'amber';
    if(usedPct<=30.0001)return'blue';
    return'green'
  }
  function snapPercent(raw){return SNAP_VALUES.reduce((best,v)=>Math.abs(v-raw)<Math.abs(best-raw)?v:best,SNAP_VALUES[0])}
  function setPct(aid,month,value){const a=currentAllocation(aid);if(!a)return;a.forecast=a.forecast||{};a.forecast[month]=Math.max(0,Math.min(100,Number(value)||0))/100}

  function planningSummary(d){
    const wp=window.WorkPackages?.summaryForDemand?.(d.id)||{count:0,estimatedCount:0,estimatedEffortDays:0};
    const rom=d.initialEstimate?.estimatedDays==null?null:Number(d.initialEstimate.estimatedDays),budget=d.budgetForecast?.estimatedDays==null?null:Number(d.budgetForecast.estimatedDays),resource=resourceDaysFor(a=>a.demandId===d.id);
    return{rom,budget,wpCount:wp.count||0,wpEstimate:wp.estimatedCount?Number(wp.estimatedEffortDays):null,resource,legacyCount:allocationSource().filter(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&isLegacy(a)).length}
  }
  function packageSummary(wp){return{estimate:wp.estimatedEffortDays==null?null:Number(wp.estimatedEffortDays),resource:resourceDaysFor(a=>a.workPackageId===wp.id)}}
  function nextAllocationId(){const rows=[...db.allocations,...(allocationState.draft||[])],max=Math.max(0,...rows.map(a=>Number((a.id||'').match(/(\d+)$/)?.[1]||0)));return`ALLOC-${new Date().getFullYear()}-${String(max+1).padStart(4,'0')}`}
  function blankAllocation(demandId,workPackageId){return{id:nextAllocationId(),demandId,workPackageId,teamMemberId:'',forecast:Object.fromEntries(months().map(m=>[m,0])),version:1,_draft:true}}

  function addAllocation(workPackageId){if(!allocationState.editing)return;const wp=wpRows().find(x=>x.id===workPackageId);if(!wp)return;const a=blankAllocation(wp.demandId,wp.id);allocationState.draft.push(a);expandedDemandIds.add(wp.demandId);expandedWorkPackageIds.add(wp.id);activeAllocationRowId=a.id;renderAllocations();requestAnimationFrame(()=>document.querySelector(`[data-aid="${CSS.escape(a.id)}"] .alloc-resource-select`)?.focus())}
  function assignLegacy(aid,workPackageId){const a=currentAllocation(aid),wp=wpRows().find(x=>x.id===workPackageId);if(!a)return;if(!wp){a.workPackageId=null;return}if(wp.demandId!==a.demandId){alert('The selected Work Package does not belong to this Demand.');return}a.workPackageId=wp.id;renderAllocations()}
  function setPerson(aid,id){const a=currentAllocation(aid);if(!a)return;a.teamMemberId=id;for(const m of months())a.forecast[m]=id?(Number(a.forecast[m])||0):0;activeAllocationRowId=a.id;renderAllocations()}

  function monthCellHtml(a,month,index,editing){
    if(!a.teamMemberId)return`<td class="alloc-month-cell inactive" data-aid="${esc(a.id)}" data-month="${esc(month)}" data-month-index="${index}"><span class="muted">—</span></td>`;
    const pct=monthPct(a,month),state=capacityState(a.teamMemberId,month),style=`--alloc-pct:${pct}%;`;
    if(!editing)return`<td class="alloc-month-cell state-${state}" data-aid="${esc(a.id)}" data-month="${esc(month)}" data-month-index="${index}" style="${style}"><div class="alloc-bar"></div><span class="alloc-pct-label">${pct}%</span></td>`;
    return`<td class="alloc-month-cell editable state-${state}" data-aid="${esc(a.id)}" data-month="${esc(month)}" data-month-index="${index}" style="${style}"><div class="alloc-bar"></div><button type="button" class="alloc-fill-handle left" data-fill="left" aria-label="Fill ${esc(month)} allocation into earlier months" title="Drag left to fill earlier months"></button><button type="button" class="alloc-level-handle" aria-label="Adjust ${esc(month)} allocation" title="Drag vertically to adjust allocation"></button><input class="alloc-pct-text" inputmode="numeric" aria-label="Allocation percentage for ${esc(month)}" data-aid="${esc(a.id)}" data-month="${esc(month)}" value="${pct}%"><button type="button" class="alloc-fill-handle right" data-fill="right" aria-label="Fill ${esc(month)} allocation into later months" title="Drag right to fill later months"></button></td>`
  }
  function rowHtml(a,demandId,{legacy=false}={}){
    const editing=allocationState.editing,person=db.team.find(p=>p.id===a.teamMemberId),wpOptions=packagesForDemand(demandId);
    const resource=editing?`<select class="cell-input alloc-resource-select" data-aid="${esc(a.id)}"><option value="">Select resource…</option>${activePeople().map(p=>`<option value="${esc(p.id)}" ${p.id===a.teamMemberId?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`:(person?.name||a.teamMemberId||'Unallocated');
    const migrate=legacy?(editing?`<select class="cell-input legacy-wp-select" data-aid="${esc(a.id)}"><option value="">Unassigned to WP</option>${wpOptions.map(w=>`<option value="${esc(w.id)}">${esc(w.id)} · ${esc(w.title)}</option>`).join('')}</select>`:'<span class="pill amber">Unassigned to WP</span>'):'';
    return`<tr class="allocation-row${legacy?' allocation-legacy':''}${a.id===activeAllocationRowId?' active':''}" data-aid="${esc(a.id)}">${editing?`<td><button class="allocation-remove" data-remove-allocation="${esc(a.id)}" type="button">−</button></td>`:''}<td>${resource}${migrate?`<div class="allocation-migrate">${migrate}</div>`:''}</td>${months().map((m,i)=>monthCellHtml(a,m,i,editing)).join('')}</tr>`
  }
  function wpHtml(wp,demand){const open=expandedWorkPackageIds.has(wp.id),summary=packageSummary(wp),allocs=allocationSource().filter(a=>a.workPackageId===wp.id&&!allocationState.deleted.has(a.id));return`<tr class="allocation-wp-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><div class="allocation-wp-heading"><button type="button" class="allocation-tree-toggle" data-toggle-wp="${esc(wp.id)}">${open?'▾':'▸'}</button><strong>${esc(wp.id)} · ${esc(wp.title)}</strong><span class="muted">Estimate ${summary.estimate==null?'—':fmtDays(summary.estimate)} · Resource Plan ${fmtDays(summary.resource)}</span>${allocationState.editing?`<button type="button" class="btn allocation-add" data-add-wp="${esc(wp.id)}">＋ Allocate Person</button>`:''}</div></td></tr>${open?allocs.map(a=>rowHtml(a,demand.id)).join(''):''}`}
  function demandHtml(d){const open=expandedDemandIds.has(d.id),summary=planningSummary(d),wps=packagesForDemand(d.id),legacy=allocationSource().filter(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&isLegacy(a));return`<tr class="allocation-demand-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><div class="allocation-demand-heading"><button type="button" class="allocation-tree-toggle" data-toggle-demand="${esc(d.id)}">${open?'▾':'▸'}</button><div><span class="allocation-demand-id">${esc(d.id)}</span><strong>${esc(d.title)}</strong><span class="allocation-demand-summary">ROM ${summary.rom==null?'—':fmtDays(summary.rom)} · Budget Forecast ${summary.budget==null?'—':fmtDays(summary.budget)} · WP Estimate ${summary.wpEstimate==null?'—':fmtDays(summary.wpEstimate)} · Resource Plan ${fmtDays(summary.resource)}</span>${summary.legacyCount?`<span class="pill amber">${summary.legacyCount} undecomposed</span>`:''}</div></div></td></tr>${open?`${legacy.length?`<tr class="allocation-legacy-header"><td colspan="${1+months().length+(allocationState.editing?1:0)}"><strong>Legacy / unassigned to Work Package</strong><span class="muted"> Assign each existing allocation to a Work Package when known.</span></td></tr>${legacy.map(a=>rowHtml(a,d.id,{legacy:true})).join('')}`:''}${wps.map(w=>wpHtml(w,d)).join('')}${!wps.length?`<tr><td colspan="${1+months().length+(allocationState.editing?1:0)}" class="muted">No Work Packages. Create a Work Package before adding new resource allocations.</td></tr>`:''}`:''}`}

  function filteredDemands(){const demandFilter=String(allocationState.filters.demand||'').toLowerCase(),personFilter=String(allocationState.filters.person||'').toLowerCase();return db.demand.filter(isOpenDemand).filter(d=>!demandFilter||`${d.id} ${d.title}`.toLowerCase().includes(demandFilter)).filter(d=>!personFilter||allocationSource().some(a=>a.demandId===d.id&&!allocationState.deleted.has(a.id)&&(db.team.find(p=>p.id===a.teamMemberId)?.name||'').toLowerCase().includes(personFilter)))}

  function activateRow(row){activeAllocationRowId=row?.dataset.aid||null;document.querySelectorAll('#allocationTable .allocation-row').forEach(r=>r.classList.toggle('active',r.dataset.aid===activeAllocationRowId))}
  function refreshPerson(resourceId){
    if(!resourceId)return;
    document.querySelectorAll('#allocationTable .alloc-month-cell[data-aid][data-month]').forEach(cell=>{
      const a=currentAllocation(cell.dataset.aid)||allocationSource().find(x=>x.id===cell.dataset.aid);if(!a||a.teamMemberId!==resourceId)return;
      const pct=monthPct(a,cell.dataset.month),state=capacityState(resourceId,cell.dataset.month);
      cell.style.setProperty('--alloc-pct',`${pct}%`);cell.classList.remove('state-blue','state-green','state-amber','state-red');cell.classList.add(`state-${state}`);
      const input=cell.querySelector('.alloc-pct-text');if(input&&document.activeElement!==input)input.value=`${pct}%`;
      const label=cell.querySelector('.alloc-pct-label');if(label)label.textContent=`${pct}%`
    })
  }
  function cancelActivePercentageEdit(){
    const input=document.activeElement;if(!input?.classList?.contains('alloc-pct-text'))return;
    const a=currentAllocation(input.dataset.aid);input.dataset.cancelCommit='true';input.value=`${monthPct(a,input.dataset.month)}%`;input.blur();delete input.dataset.cancelCommit
  }
  function bindPctInputs(){
    document.querySelectorAll('#allocationTable .alloc-pct-text').forEach(input=>{
      input.addEventListener('focus',()=>{activateRow(input.closest('.allocation-row'));input.value=input.value.replace('%','');input.select()});
      const commit=()=>{if(input.dataset.cancelCommit==='true')return;const a=currentAllocation(input.dataset.aid);if(!a)return;const value=Math.max(0,Math.min(100,Number(String(input.value).replace('%','').trim())||0));setPct(a.id,input.dataset.month,value);input.value=`${Math.round(value)}%`;refreshPerson(a.teamMemberId)};
      input.addEventListener('change',commit);input.addEventListener('blur',commit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur()}if(e.key==='Escape'){e.preventDefault();input.dataset.cancelCommit='true';const a=currentAllocation(input.dataset.aid);input.value=`${monthPct(a,input.dataset.month)}%`;input.blur();delete input.dataset.cancelCommit}})
    })
  }
  function bindVerticalHandles(){
    document.querySelectorAll('#allocationTable .alloc-level-handle').forEach(handle=>handle.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();cancelActivePercentageEdit();
      const cell=handle.closest('.alloc-month-cell'),row=handle.closest('.allocation-row'),a=currentAllocation(cell?.dataset.aid);if(!cell||!a)return;activateRow(row);handle.setPointerCapture?.(e.pointerId);
      const update=clientY=>{const rect=cell.getBoundingClientRect(),raw=(rect.bottom-clientY)/Math.max(1,rect.height)*100,pct=snapPercent(raw);setPct(a.id,cell.dataset.month,pct);refreshPerson(a.teamMemberId)};
      update(e.clientY);const move=ev=>update(ev.clientY),finish=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish)};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish)
    }))
  }
  function clearFillPreview(aid){document.querySelectorAll(`#allocationTable .alloc-month-cell[data-aid="${CSS.escape(aid)}"]`).forEach(c=>c.classList.remove('fill-preview','fill-preview-edge','fill-preview-source'))}
  function bindFillHandles(){
    document.querySelectorAll('#allocationTable .alloc-fill-handle').forEach(handle=>handle.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();cancelActivePercentageEdit();
      const sourceCell=handle.closest('.alloc-month-cell'),row=handle.closest('.allocation-row'),aid=sourceCell?.dataset.aid,a=currentAllocation(aid);if(!sourceCell||!row||!a)return;activateRow(row);
      const visibleMonths=months(),sourceIndex=Number(sourceCell.dataset.monthIndex),direction=handle.dataset.fill,sourcePct=monthPct(a,sourceCell.dataset.month),resourceId=a.teamMemberId,original=Object.fromEntries(visibleMonths.map(m=>[m,Number(a.forecast?.[m])||0]));
      handle.setPointerCapture?.(e.pointerId);row.classList.add('fill-dragging');clearFillPreview(aid);sourceCell.classList.add('fill-preview-source');
      const applyTo=index=>{if(!Number.isFinite(index))return;index=Math.max(0,Math.min(visibleMonths.length-1,index));if(direction==='left')index=Math.min(index,sourceIndex);else index=Math.max(index,sourceIndex);for(const m of visibleMonths)a.forecast[m]=original[m];const lo=Math.min(index,sourceIndex),hi=Math.max(index,sourceIndex);for(let i=lo;i<=hi;i++)setPct(aid,visibleMonths[i],sourcePct);clearFillPreview(aid);for(let i=lo;i<=hi;i++)row.querySelector(`.alloc-month-cell[data-month-index="${i}"]`)?.classList.add('fill-preview');sourceCell.classList.add('fill-preview-source');row.querySelector(`.alloc-month-cell[data-month-index="${index}"]`)?.classList.add('fill-preview-edge');refreshPerson(resourceId)};
      applyTo(sourceIndex);
      const move=ev=>{const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest?.(`.alloc-month-cell[data-aid="${CSS.escape(aid)}"]`);if(target)applyTo(Number(target.dataset.monthIndex))};
      const finish=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);row.classList.remove('fill-dragging');clearFillPreview(aid);refreshPerson(resourceId)};
      window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true)
    }))
  }

  function bind(){
    document.querySelectorAll('[data-toggle-demand]').forEach(b=>b.onclick=()=>{expandedDemandIds.has(b.dataset.toggleDemand)?expandedDemandIds.delete(b.dataset.toggleDemand):expandedDemandIds.add(b.dataset.toggleDemand);renderAllocations()});
    document.querySelectorAll('[data-toggle-wp]').forEach(b=>b.onclick=()=>{expandedWorkPackageIds.has(b.dataset.toggleWp)?expandedWorkPackageIds.delete(b.dataset.toggleWp):expandedWorkPackageIds.add(b.dataset.toggleWp);renderAllocations()});
    document.querySelectorAll('[data-add-wp]').forEach(b=>b.onclick=()=>addAllocation(b.dataset.addWp));
    document.querySelectorAll('.alloc-resource-select').forEach(el=>el.onchange=()=>setPerson(el.dataset.aid,el.value));
    document.querySelectorAll('.legacy-wp-select').forEach(el=>el.onchange=()=>assignLegacy(el.dataset.aid,el.value));
    document.querySelectorAll('[data-remove-allocation]').forEach(el=>el.onclick=()=>{allocationState.deleted.add(el.dataset.removeAllocation);renderAllocations()});
    bindPctInputs();bindVerticalHandles();bindFillHandles()
  }

  window.renderAllocations=renderAllocations=function(){
    const editing=allocationState.editing,demands=filteredDemands();
    $('allocationToolbar').innerHTML=editing?'<button class="btn success" id="saveAllocations">Save Changes</button><button class="btn" id="cancelAllocations">Cancel</button><button class="btn" id="clearAllocationFilters">Clear Filters</button>':`<button class="btn" id="editAllocations" ${workspaceHandle?'':'disabled'}>Edit Resource Plan</button><button class="btn" id="clearAllocationFilters">Clear Filters</button>`;
    const legacyCount=allocationSource().filter(a=>!allocationState.deleted.has(a.id)&&isLegacy(a)).length,total=allocationSource().filter(a=>!allocationState.deleted.has(a.id)).length;
    $('allocationCount').textContent=workspaceHandle?`${total} allocations · ${legacyCount?`${legacyCount} legacy allocation${legacyCount===1?'':'s'} still need Work Package assignment`:'all allocations assigned to Work Packages'}`:'No workspace loaded';
    const colspan=1+months().length+(editing?1:0);
    $('allocationTable').innerHTML=`<thead><tr>${editing?'<th></th>':''}<th>Resource</th>${months().map(m=>`<th class="month">${monthLabel(m)}</th>`).join('')}</tr><tr class="filter-row">${editing?'<th></th>':''}<th><input id="allocationPersonFilter" value="${esc(allocationState.filters.person||'')}" placeholder="filter resource…"></th>${months().map(()=>'<th></th>').join('')}</tr><tr><th colspan="${colspan}"><input id="allocationDemandFilter" value="${esc(allocationState.filters.demand||'')}" placeholder="filter demand ID or title…"></th></tr></thead><tbody>${demands.map(demandHtml).join('')}</tbody>`;
    $('editAllocations')?.addEventListener('click',()=>{allocationState.editing=true;allocationState.draft=clone(db.allocations);allocationState.deleted=new Set();for(const d of db.demand)expandedDemandIds.add(d.id);renderAllocations()});
    $('cancelAllocations')?.addEventListener('click',()=>{allocationState.editing=false;allocationState.draft=null;allocationState.deleted=new Set();activeAllocationRowId=null;renderAllocations()});
    $('clearAllocationFilters').onclick=()=>{allocationState.filters={demand:'',person:''};renderAllocations()};
    $('saveAllocations')?.addEventListener('click',saveAllocations);bind();
    const bindFilter=(id,key)=>$(id)?.addEventListener('input',e=>{allocationState.filters[key]=e.target.value;renderAllocations()});bindFilter('allocationDemandFilter','demand');bindFilter('allocationPersonFilter','person')
  };

  window.saveAllocations=saveAllocations=function(){
    const pending=allocationState.draft.filter(a=>!allocationState.deleted.has(a.id));
    for(const a of pending){const result=window.AllocationModel?.validate?.(a,{demand:db.demand,team:db.team,workPackages:wpRows(),allowLegacy:true});if(result&&!result.valid){alert(result.errors.join('\n'));return}if(!a.teamMemberId){alert('Select a valid Resource for every allocation, or remove the incomplete row.');return}if(a._draft&&!a.workPackageId){alert('New allocations must be created against a Work Package.');return}}
    const finalIds=new Set(pending.map(a=>a.id)),oldMap=new Map(db.allocations.map(a=>[a.id,a]));for(const old of db.allocations)if(!finalIds.has(old.id))deletedAllocations.add(old.id);for(const a of pending){const old=oldMap.get(a.id);if(!old||JSON.stringify(old)!==JSON.stringify(a)){dirtyRecords.allocations.add(a.id);a.version=(Number(a.version)||0)+1;a.modifiedAt=new Date().toISOString()}}
    db.allocations=pending.map(a=>{const x=clone(a);delete x._draft;return x});allocationState.editing=false;allocationState.draft=null;allocationState.deleted=new Set();activeAllocationRowId=null;updateBanner();log('Work Package resource plan changes committed.');if(typeof requestAutosave==='function')requestAutosave();refreshAll()
  };

  const style=document.createElement('style');style.id='wp-resource-planning-styles';style.textContent=`
    #allocationTable .allocation-tree-toggle{border:0;background:transparent;color:var(--muted);font-weight:900;cursor:pointer;padding:2px 5px}
    #allocationTable .allocation-demand-heading,#allocationTable .allocation-wp-heading{display:flex;align-items:center;gap:8px}
    #allocationTable .allocation-demand-heading>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.allocation-demand-summary{font-size:.72rem;color:var(--muted)}
    #allocationTable .allocation-wp-header td{background:color-mix(in srgb,var(--panel) 92%,var(--line));padding-left:24px}.allocation-wp-heading .allocation-add{margin-left:auto}
    #allocationTable .allocation-legacy-header td{background:color-mix(in srgb,var(--warn) 10%,var(--panel));padding-left:34px}.allocation-legacy td:first-of-type{border-left:3px solid var(--warn)}.allocation-migrate{margin-top:5px}.legacy-wp-select{font-size:.72rem}.pill.amber{background:color-mix(in srgb,var(--warn) 16%,transparent);color:var(--warn)}
    #allocationTable .alloc-month-cell{position:relative;min-width:72px;height:44px;overflow:hidden;padding:0;text-align:center;vertical-align:middle}
    #allocationTable .alloc-month-cell .alloc-bar{position:absolute;left:3px;right:3px;bottom:3px;height:var(--alloc-pct,0%);max-height:calc(100% - 6px);border-radius:5px;pointer-events:none;transition:height .12s ease}
    #allocationTable .alloc-month-cell.state-blue .alloc-bar{background:color-mix(in srgb,#3182ce 34%,transparent)}
    #allocationTable .alloc-month-cell.state-green .alloc-bar{background:color-mix(in srgb,#2f9e63 34%,transparent)}
    #allocationTable .alloc-month-cell.state-amber .alloc-bar{background:color-mix(in srgb,#d99922 40%,transparent)}
    #allocationTable .alloc-month-cell.state-red .alloc-bar{background:color-mix(in srgb,var(--bad) 44%,transparent)}
    #allocationTable .alloc-pct-label,#allocationTable .alloc-pct-text{position:relative;z-index:2;font-weight:750}
    #allocationTable .alloc-pct-text{width:48px;text-align:center;border:1px solid transparent;border-radius:5px;background:transparent;color:inherit;padding:4px 2px}
    #allocationTable .alloc-pct-text:focus{background:var(--panel);border-color:var(--accent);outline:none}
    #allocationTable .alloc-level-handle{position:absolute;z-index:3;left:50%;bottom:2px;transform:translateX(-50%);width:24px;height:7px;border:0;border-radius:4px;background:color-mix(in srgb,var(--text) 40%,transparent);cursor:ns-resize;opacity:.55}
    #allocationTable .alloc-level-handle:hover{opacity:1;background:var(--accent)}
    #allocationTable .alloc-fill-handle{position:absolute;z-index:4;width:15px;height:18px;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--line));border-radius:5px;background:color-mix(in srgb,var(--panel) 92%,var(--accent));top:50%;transform:translateY(-50%);cursor:ew-resize;box-shadow:0 1px 2px rgba(0,0,0,.08)}
    #allocationTable .alloc-fill-handle.left{left:3px}#allocationTable .alloc-fill-handle.right{right:3px}
    #allocationTable .alloc-fill-handle::before{content:'';position:absolute;top:50%;transform:translateY(-50%);width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent}
    #allocationTable .alloc-fill-handle.left::before{left:3px;border-right:6px solid var(--accent)}#allocationTable .alloc-fill-handle.right::before{right:3px;border-left:6px solid var(--accent)}
    #allocationTable .alloc-fill-handle:hover{background:color-mix(in srgb,var(--accent) 14%,var(--panel));border-color:var(--accent)}
    #allocationTable .allocation-row.active .alloc-month-cell{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--accent) 28%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--accent) 28%,transparent)}
    #allocationTable .fill-dragging .alloc-month-cell,#allocationTable .fill-dragging .alloc-bar{transition:none}
    #allocationTable .alloc-month-cell.fill-preview{background:color-mix(in srgb,var(--accent) 7%,var(--panel));box-shadow:inset 0 2px 0 color-mix(in srgb,var(--accent) 42%,transparent),inset 0 -2px 0 color-mix(in srgb,var(--accent) 42%,transparent)}
    #allocationTable .alloc-month-cell.fill-preview-source{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 70%,transparent)}
    #allocationTable .alloc-month-cell.fill-preview-edge{box-shadow:inset 0 0 0 2px var(--accent)}
    @media(max-width:760px){#allocationTable .allocation-demand-heading>div{align-items:flex-start}.allocation-demand-summary{display:block;width:100%}.allocation-wp-heading{flex-wrap:wrap}.allocation-wp-heading .allocation-add{margin-left:0}#allocationTable .alloc-month-cell{min-width:68px}}
  `;document.head.appendChild(style);
  window.WorkPackageResourcePlanning={planningSummary,packageSummary,resourceDaysFor,totalResourceFraction,capacityState,snapPercent,SNAP_VALUES,expandedDemandIds,expandedWorkPackageIds};
})();
