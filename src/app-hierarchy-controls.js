/* Shared presentation-only hierarchy controls for Demand and Allocation views.
   Canonical hierarchy state remains owned by WorkPackages and WorkPackageResourcePlanning. */
(function initHierarchyControls(){
  if(window.__amoHierarchyControlsInstalled)return;window.__amoHierarchyControlsInstalled=true;
  let scheduled=false,observer=null,autoExpanding=false;
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'');
  const visibleDemandIds=()=>[...document.querySelectorAll('#demandTable tbody tr[data-row]')].map(r=>r.dataset.row).filter(Boolean);
  const visibleAllocationDemandIds=()=>[...document.querySelectorAll('#allocationTable .allocation-demand-id')].map(el=>String(el.textContent||'').trim()).filter(Boolean);
  const packagesFor=id=>window.WorkPackages?.forDemand?.(id)||[];

  function hierarchyButtons(view){return`<span class="hierarchy-bulk-controls" data-hierarchy-controls="${view}" aria-label="Hierarchy display"><button type="button" class="btn" data-hierarchy-expand title="Expand all visible ${view==='demand'?'Demand Work Packages':'Demand, Work Packages and Allocations'}">Expand all</button><button type="button" class="btn" data-hierarchy-collapse title="Collapse all visible ${view==='demand'?'Demand Work Packages':'Demand and Work Packages'}">Collapse all</button></span>`}
  function demandSet(expanded){const ids=visibleDemandIds();if(!ids.length)return;window.WorkPackages?.setDemandExpansion?.(ids,expanded)}
  function allocationSet(expanded){
    const planning=window.WorkPackageResourcePlanning,ids=visibleAllocationDemandIds();if(!planning||!ids.length)return;
    for(const id of ids){
      if(expanded)planning.expandedDemandIds.add(id);else planning.expandedDemandIds.delete(id);
      for(const wp of packagesFor(id)){if(expanded)planning.expandedWorkPackageIds.add(wp.id);else planning.expandedWorkPackageIds.delete(wp.id)}
    }
    if(typeof renderAllocations==='function')renderAllocations()
  }
  function bindGroup(group,view){group.querySelector('[data-hierarchy-expand]').onclick=()=>view==='demand'?demandSet(true):allocationSet(true);group.querySelector('[data-hierarchy-collapse]').onclick=()=>view==='demand'?demandSet(false):allocationSet(false)}
  function ensureDemandControls(){
    const bar=document.querySelector('#demandManagementFilters .management-filter-bar');if(!bar||bar.querySelector('[data-hierarchy-controls="demand"]'))return;
    bar.insertAdjacentHTML('afterbegin',hierarchyButtons('demand'));bindGroup(bar.querySelector('[data-hierarchy-controls="demand"]'),'demand')
  }
  function ensureAllocationControls(){
    const actions=document.querySelector('#allocationTable .list-sticky-actions')||document.getElementById('allocationToolbar');if(!actions||actions.querySelector('[data-hierarchy-controls="allocations"]'))return;
    const holder=actions.querySelector('.allocation-header-filters')||actions.querySelector('[data-allocation-control-wrap]');const shell=document.createElement('span');shell.innerHTML=hierarchyButtons('allocations');const group=shell.firstElementChild;if(holder)actions.insertBefore(group,holder);else actions.appendChild(group);bindGroup(group,'allocations')
  }
  function autoExpandDrillThrough(){
    if(autoExpanding)return;
    const commitment=window.CommitmentHealth,planning=window.WorkPackageResourcePlanning;if(!commitment)return;
    if(commitment.demandFilters?.control==='work-item-missing'){
      const ids=visibleDemandIds(),collapsed=window.WorkPackages?.collapsedDemandIds;if(ids.length&&collapsed&&ids.some(id=>collapsed.has(id))){autoExpanding=true;window.WorkPackages.setDemandExpansion(ids,true);queueMicrotask(()=>{autoExpanding=false});return}
    }
    if(commitment.allocationFilters?.control==='actuals-missing'&&planning){
      const ids=visibleAllocationDemandIds();let changed=false;
      for(const id of ids){if(!planning.expandedDemandIds.has(id)){planning.expandedDemandIds.add(id);changed=true}for(const wp of packagesFor(id))if(!planning.expandedWorkPackageIds.has(wp.id)){planning.expandedWorkPackageIds.add(wp.id);changed=true}}
      if(changed){autoExpanding=true;if(typeof renderAllocations==='function')renderAllocations();queueMicrotask(()=>{autoExpanding=false})}
    }
  }
  function ensure(){scheduled=false;ensureDemandControls();ensureAllocationControls();autoExpandDrillThrough()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensure)}
  function start(){observer?.disconnect();observer=new MutationObserver(schedule);observer.observe(document.querySelector('.content')||document.body,{subtree:true,childList:true});window.addEventListener('amo:work-packages-updated',schedule);window.addEventListener('amo:actuals-updated',schedule);document.addEventListener('click',()=>setTimeout(schedule,0));schedule()}

  const style=document.createElement('style');style.id='amo-hierarchy-control-styles';style.textContent=`.hierarchy-bulk-controls{display:inline-flex;gap:5px;align-items:center;padding-right:8px;margin-right:2px;border-right:1px solid var(--line)}.hierarchy-bulk-controls .btn{white-space:nowrap;padding:5px 8px;font-size:.72rem}@media(max-width:760px){.hierarchy-bulk-controls{width:auto;flex:0 0 auto}.hierarchy-bulk-controls .btn{padding:5px 7px}}`;document.head.appendChild(style);
  window.HierarchyControls={visibleDemandIds,visibleAllocationDemandIds,demandSet,allocationSet,ensure};start()
})();