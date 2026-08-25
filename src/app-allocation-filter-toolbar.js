/* Keep Allocations Demand/Resource filters persistently in the sticky action row. */
(function initAllocationFilterToolbar(){
  function install(){
    if(typeof renderAllocations!=='function'||!document.getElementById('allocation-interaction-styles')){setTimeout(install,25);return}
    if(window.__amoAllocationFilterToolbarInstalled)return;window.__amoAllocationFilterToolbarInstalled=true;

    let applying=false;
    function field(label,key,value,placeholder){
      const wrap=document.createElement('label');wrap.className='allocation-header-filter';
      const span=document.createElement('span');span.textContent=label;
      const input=document.createElement('input');input.type='text';input.value=value||'';input.placeholder=placeholder;input.dataset.allocationHeaderFilter=key;input.setAttribute('aria-label',`${label} filter`);
      wrap.append(span,input);return wrap
    }

    function bindInput(input,key){
      input.addEventListener('input',e=>{
        allocationState.filters=allocationState.filters||{demand:'',person:''};
        allocationState.filters[key]=e.target.value;
        const pos=e.target.selectionStart;
        clearTimeout(debounceTimers[`alloc-header-${key}`]);
        debounceTimers[`alloc-header-${key}`]=setTimeout(()=>{
          renderAllocations();
          requestAnimationFrame(()=>{
            const next=document.querySelector(`#allocationTable [data-allocation-header-filter="${key}"]`);
            next?.focus({preventScroll:true});next?.setSelectionRange?.(pos,pos)
          })
        },250)
      })
    }

    function ensureFilters(){
      if(applying)return;applying=true;
      try{
        const table=document.getElementById('allocationTable'),thead=table?.tHead;if(!thead)return;
        const actions=thead.querySelector('.list-action-row .list-sticky-actions');if(!actions)return;

        let filters=actions.querySelector('.allocation-header-filters');
        if(!filters){filters=document.createElement('div');filters.className='allocation-header-filters';actions.appendChild(filters)}

        let demand=filters.querySelector('[data-allocation-header-filter="demand"]');
        let resource=filters.querySelector('[data-allocation-header-filter="person"]');
        if(!demand){const node=field('Demand','demand',allocationState.filters?.demand||'','filter demand…');demand=node.querySelector('input');bindInput(demand,'demand');filters.appendChild(node)}
        if(!resource){const node=field('Resource','person',allocationState.filters?.person||'','filter resource…');resource=node.querySelector('input');bindInput(resource,'person');filters.appendChild(node)}

        if(document.activeElement!==demand)demand.value=allocationState.filters?.demand||'';
        if(document.activeElement!==resource)resource.value=allocationState.filters?.person||'';

        /* The core renderer still creates legacy filter rows. Remove them after every render; the
           sticky-toolbar fields above are the canonical controls and survive via state. */
        [...thead.rows].forEach(row=>{if(row.classList.contains('allocation-demand-filter-row')||row.classList.contains('filter-row'))row.remove()});
      }finally{applying=false}
    }

    const baseRenderAllocations=renderAllocations;
    renderAllocations=function(){const result=baseRenderAllocations.apply(this,arguments);ensureFilters();return result};

    const table=document.getElementById('allocationTable');
    if(table)new MutationObserver(()=>requestAnimationFrame(ensureFilters)).observe(table,{subtree:true,childList:true});

    if(!document.getElementById('allocation-header-filter-styles')){const style=document.createElement('style');style.id='allocation-header-filter-styles';style.textContent=`
      #allocationTable .list-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #allocationTable .allocation-header-filters{display:flex;align-items:center;gap:8px;margin-left:6px;flex-wrap:wrap}
      #allocationTable .allocation-header-filter{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;color:var(--muted);white-space:nowrap}
      #allocationTable .allocation-header-filter input{width:170px;max-width:24vw;min-width:110px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:.72rem}
      @media(max-width:760px){#allocationTable .allocation-header-filter span{display:none}#allocationTable .allocation-header-filter input{width:125px;max-width:34vw}}
    `;document.head.appendChild(style)}

    renderAllocations();ensureFilters()
  }
  install();
})();
