/* Move Allocations Demand/Resource filters into the sticky action row. */
(function initAllocationFilterToolbar(){
  if(typeof renderAllocations!=='function')return;

  function moveAllocationFiltersIntoHeader(){
    const table=document.getElementById('allocationTable');
    const thead=table?.tHead;
    if(!thead)return;

    const actions=thead.querySelector('.list-action-row .list-sticky-actions');
    const demandInput=document.getElementById('allocationDemandFilter');
    const resourceInput=document.getElementById('allocationPersonFilter');
    if(!actions||!demandInput||!resourceInput)return;

    let filters=actions.querySelector('.allocation-header-filters');
    if(!filters){
      filters=document.createElement('div');
      filters.className='allocation-header-filters';
      actions.appendChild(filters);
    }

    const field=(label,input)=>{
      const wrap=document.createElement('label');
      wrap.className='allocation-header-filter';
      const span=document.createElement('span');
      span.textContent=label;
      wrap.appendChild(span);
      wrap.appendChild(input);
      return wrap;
    };

    filters.replaceChildren(field('Demand',demandInput),field('Resource',resourceInput));

    /* The inputs keep their existing listeners when moved; remove now-empty filter rows. */
    [...thead.rows].forEach(row=>{
      if(row.classList.contains('allocation-demand-filter-row'))row.remove();
      else if(row.classList.contains('filter-row')&&!row.querySelector('input,select,textarea'))row.remove();
    });
  }

  const baseRenderAllocations=renderAllocations;
  renderAllocations=function(){
    const result=baseRenderAllocations.apply(this,arguments);
    moveAllocationFiltersIntoHeader();
    return result;
  };

  const style=document.createElement('style');
  style.id='allocation-header-filter-styles';
  style.textContent=`
    #allocationTable .list-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #allocationTable .allocation-header-filters{display:flex;align-items:center;gap:8px;margin-left:6px;flex-wrap:wrap}
    #allocationTable .allocation-header-filter{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;color:var(--muted);white-space:nowrap}
    #allocationTable .allocation-header-filter input{width:170px;max-width:24vw;min-width:110px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:.72rem}
    @media(max-width:760px){#allocationTable .allocation-header-filter span{display:none}#allocationTable .allocation-header-filter input{width:125px;max-width:34vw}}
  `;
  document.head.appendChild(style);

  renderAllocations();
})();
