/* Shared Arrange By presentation for Demand, Status Report and Allocations.
   This capability changes only view composition. It never mutates Demand, Status Report or Allocation data.
   Arrangement preference is browser-local and stored per view. */
(function initListArrangement(){
  if(window.AmoArrange)return;

  const OPTIONS=[
    {value:'demand',label:'Demand'},
    {value:'businessArea',label:'Business Area'},
    {value:'initiative',label:'Initiative'},
    {value:'owner',label:'Owner'}
  ];
  const PREF_PREFIX='amo:arrange:';
  const statusFilters={businessArea:'',initiative:''};
  const clean=v=>String(v??'').trim();
  const esc=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function stored(view){try{const v=localStorage.getItem(PREF_PREFIX+view);return OPTIONS.some(o=>o.value===v)?v:'demand'}catch(_e){return'demand'}}
  function remember(view,value){try{localStorage.setItem(PREF_PREFIX+view,value)}catch(_e){}}
  function valueFor(view){return stored(view)}
  function setValue(view,value){if(!OPTIONS.some(o=>o.value===value))value='demand';remember(view,value)}
  function demandById(id){return(db?.demand||[]).find(d=>String(d.id)===String(id))||null}
  function ownerFor(d){return typeof ownerName==='function'?ownerName(d):(db?.team||[]).find(p=>p.id===d?.ownerId)?.name||''}
  function groupValue(d,key){if(!d)return'Unassigned';const value=key==='businessArea'?d.businessArea:key==='initiative'?d.initiative:key==='owner'?ownerFor(d):d.title||d.id;return clean(value)||'Unassigned'}
  function compareGroups(a,b){if(a==='Unassigned'&&b!=='Unassigned')return 1;if(b==='Unassigned'&&a!=='Unassigned')return-1;return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})}
  function colspan(table){return Math.max(1,table?.tHead?.rows?.[0]?.cells?.length||table?.rows?.[0]?.cells?.length||1)}
  function groupRow(table,label,count){const tr=document.createElement('tr');tr.className='amo-arrange-group';const td=document.createElement('td');td.colSpan=colspan(table);td.innerHTML=`<div class="amo-arrange-group-inner"><strong>${esc(label)}</strong><span>${count}</span></div>`;tr.appendChild(td);return tr}
  function blocksFromRows(tbody,selector,idOf){
    const rows=[...tbody.children].filter(r=>!r.classList.contains('amo-arrange-group')),blocks=[];let current=null;
    for(const row of rows){if(row.matches(selector)){current={id:idOf(row),rows:[row]};blocks.push(current)}else if(current)current.rows.push(row)}
    return blocks
  }
  function regroup(table,blocks,key){
    const tbody=table?.tBodies?.[0];if(!tbody)return;
    tbody.querySelectorAll(':scope > .amo-arrange-group').forEach(r=>r.remove());
    if(key==='demand')return;
    const groups=new Map();
    blocks.forEach(block=>{const label=groupValue(demandById(block.id),key);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(block)});
    for(const label of [...groups.keys()].sort(compareGroups)){
      const grouped=groups.get(label);tbody.appendChild(groupRow(table,label,grouped.length));grouped.forEach(block=>block.rows.forEach(row=>tbody.appendChild(row)))
    }
  }

  function control(view,onChange){const wrap=document.createElement('label');wrap.className='amo-arrange-control';wrap.innerHTML=`<span>Arrange by</span><select data-amo-arrange="${view}">${OPTIONS.map(o=>`<option value="${o.value}" ${o.value===valueFor(view)?'selected':''}>${o.label}</option>`).join('')}</select>`;wrap.querySelector('select').addEventListener('change',e=>{setValue(view,e.target.value);onChange?.()});return wrap}
  function ensureControl(toolbar,view,onChange){if(!toolbar)return;let existing=toolbar.querySelector(`[data-amo-arrange="${view}"]`);if(existing){existing.value=valueFor(view);return}toolbar.appendChild(control(view,onChange))}

  function arrangeDemand(){
    const table=document.getElementById('demandTable'),toolbar=document.getElementById('demandToolbar');if(!table)return;
    ensureControl(toolbar,'demand',()=>typeof renderGrid==='function'&&renderGrid('demand'));
    const tbody=table.tBodies?.[0];if(!tbody)return;
    const blocks=blocksFromRows(tbody,'tr[data-row]',row=>row.dataset.row);regroup(table,blocks,valueFor('demand'))
  }

  function statusFilterOptions(key){return [...new Set((db?.demand||[]).filter(d=>typeof isOpenDemand==='function'?isOpenDemand(d):true).map(d=>clean(d?.[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}))}
  function ensureStatusFilters(toolbar){
    if(!toolbar||toolbar.querySelector('.amo-status-scope-filters'))return;
    const wrap=document.createElement('div');wrap.className='amo-status-scope-filters';
    const field=(label,key)=>`<label><span>${label}</span><select data-amo-status-filter="${key}"><option value="">All</option>${statusFilterOptions(key).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`;
    wrap.innerHTML=field('Business Area','businessArea')+field('Initiative','initiative');toolbar.appendChild(wrap);
    wrap.querySelectorAll('[data-amo-status-filter]').forEach(select=>{select.value=statusFilters[select.dataset.amoStatusFilter]||'';select.addEventListener('change',e=>{statusFilters[e.target.dataset.amoStatusFilter]=e.target.value;if(typeof renderStatusReporting==='function')renderStatusReporting()})})
  }
  function statusVisible(d){return(!statusFilters.businessArea||clean(d?.businessArea)===statusFilters.businessArea)&&(!statusFilters.initiative||clean(d?.initiative)===statusFilters.initiative)}
  function arrangeStatus(){
    const table=document.getElementById('statusReportTable'),toolbar=document.getElementById('statusReportToolbar');if(!table)return;
    ensureStatusFilters(toolbar);ensureControl(toolbar,'status-report',()=>typeof renderStatusReporting==='function'&&renderStatusReporting());
    const tbody=table.tBodies?.[0];if(!tbody)return;
    [...tbody.querySelectorAll('tr[data-status-demand]')].forEach(row=>{row.hidden=!statusVisible(demandById(row.dataset.statusDemand))});
    const blocks=blocksFromRows(tbody,'tr[data-status-demand]',row=>row.dataset.statusDemand).filter(block=>!block.rows[0].hidden);regroup(table,blocks,valueFor('status-report'))
  }

  function allocationDemandId(row){return clean(row.querySelector('.allocation-demand-id')?.textContent)}
  function arrangeAllocations(){
    const table=document.getElementById('allocationTable'),toolbar=document.getElementById('allocationToolbar');if(!table)return;
    const rerender=()=>typeof renderAllocations==='function'&&renderAllocations();
    ensureControl(toolbar,'allocations',rerender);
    requestAnimationFrame(()=>ensureControl(table.querySelector('.list-sticky-actions'),'allocations',rerender));
    const tbody=table.tBodies?.[0];if(!tbody)return;
    const blocks=blocksFromRows(tbody,'tr.allocation-demand-header',allocationDemandId);regroup(table,blocks,valueFor('allocations'))
  }

  function after(fn,decorate){return function(...args){const result=fn.apply(this,args);decorate();return result}}
  const demandContribution={id:'list-arrangement',priority:30,afterRender:()=>arrangeDemand()};
  if(window.AmoDemandGrid?.register)window.AmoDemandGrid.register(demandContribution);else(window.AmoDemandGridPending=window.AmoDemandGridPending||[]).push(demandContribution);
  if(typeof renderStatusReporting==='function'){const base=renderStatusReporting;renderStatusReporting=after(base,arrangeStatus)}
  if(typeof renderAllocations==='function'){const base=renderAllocations;renderAllocations=after(base,arrangeAllocations)}

  const style=document.createElement('style');style.id='amo-list-arrangement-styles';style.textContent=`
    .amo-arrange-control,.amo-status-scope-filters label{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:700;color:var(--muted);white-space:nowrap}
    .amo-arrange-control select,.amo-status-scope-filters select{height:30px;padding:4px 8px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink);font:inherit}
    .amo-status-scope-filters{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
    .amo-arrange-group td{padding:8px 12px!important;background:var(--soft)!important;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .amo-arrange-group-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;text-transform:uppercase;letter-spacing:.04em;font-size:.72rem;color:var(--muted)}
    .amo-arrange-group-inner strong{color:var(--ink);font-size:.76rem}.amo-arrange-group-inner span{font-variant-numeric:tabular-nums}
    @media(max-width:900px){.amo-arrange-control>span,.amo-status-scope-filters label>span{display:none}.amo-arrange-control select,.amo-status-scope-filters select{max-width:155px}}
  `;document.head.appendChild(style);

  window.AmoArrange={OPTIONS,valueFor,setValue,groupValue,compareGroups,arrangeDemand,arrangeStatus,arrangeAllocations,statusFilters};
  arrangeDemand();arrangeStatus();arrangeAllocations();
})();
