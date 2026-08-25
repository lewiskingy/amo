/* Keep Allocations Demand/Resource filters persistently in the sticky action row.
   These are searchable comboboxes: typing narrows available values, while selecting an
   option (or Enter when there is a single match) commits the actual view filter. */
(function initAllocationFilterToolbar(){
  function install(){
    if(typeof renderAllocations!=='function'||!document.getElementById('allocation-interaction-styles')){setTimeout(install,25);return}
    if(window.__amoAllocationFilterToolbarInstalled)return;window.__amoAllocationFilterToolbarInstalled=true;

    let applying=false;
    const esc=v=>typeof escHtml==='function'?escHtml(v):String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const allocationSource=()=>allocationState.editing?(allocationState.draft||[]):((typeof db!=='undefined'&&db.allocations)||[]);
    const scopedDemands=()=>{
      const base=typeof scopedDemand==='function'?scopedDemand():((typeof db!=='undefined'&&db.demand)||[]);
      return(base||[]).filter(d=>typeof isOpenDemand==='function'?isOpenDemand(d):true)
    };
    const personName=id=>typeof person==='function'?(person(id)?.name||''):(((typeof db!=='undefined'&&db.team)||[]).find(p=>p.id===id)?.name||'');

    function availableDemandOptions(){
      const resourceFilter=String(allocationState.filters?.person||'').trim().toLowerCase();
      const allocations=allocationSource();
      return scopedDemands().filter(d=>{
        if(!resourceFilter)return true;
        return allocations.some(a=>a.demandId===d.id&&!allocationState.deleted?.has?.(a.id)&&personName(a.teamMemberId).toLowerCase().includes(resourceFilter))
      }).map(d=>({value:d.id,label:`${d.id} — ${d.title||''}`.trim()}))
    }
    function availableResourceOptions(){
      const demandFilter=String(allocationState.filters?.demand||'').trim().toLowerCase();
      const demands=scopedDemands().filter(d=>!demandFilter||`${d.id} ${d.title||''}`.toLowerCase().includes(demandFilter));
      const demandIds=new Set(demands.map(d=>d.id)),names=new Set();
      allocationSource().forEach(a=>{if(demandIds.has(a.demandId)&&!allocationState.deleted?.has?.(a.id)){const name=personName(a.teamMemberId);if(name)names.add(name)}});
      return[...names].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(name=>({value:name,label:name}))
    }
    function optionsFor(key){return key==='demand'?availableDemandOptions():availableResourceOptions()}
    function displayFor(key,value){
      if(!value)return'';
      const match=optionsFor(key).find(o=>String(o.value).toLowerCase()===String(value).toLowerCase());
      return match?.label||String(value)
    }

    function field(label,key,value,placeholder){
      const wrap=document.createElement('div');wrap.className='allocation-header-filter';
      const span=document.createElement('span');span.textContent=label;
      const combo=document.createElement('div');combo.className='allocation-filter-combobox';
      const input=document.createElement('input');input.type='text';input.value=displayFor(key,value);input.placeholder=placeholder;input.dataset.allocationHeaderFilter=key;input.dataset.selectedValue=value||'';input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-label',`${label} filter`);
      const list=document.createElement('div');list.className='allocation-filter-options';list.setAttribute('role','listbox');
      combo.append(input,list);wrap.append(span,combo);return wrap
    }

    function closeList(input,restore=false){
      const list=input.parentElement?.querySelector('.allocation-filter-options');list?.classList.remove('open');input.setAttribute('aria-expanded','false');
      if(restore){const selected=allocationState.filters?.[input.dataset.allocationHeaderFilter]||'';input.dataset.selectedValue=selected;input.value=displayFor(input.dataset.allocationHeaderFilter,selected)}
    }
    function matchesFor(input){
      const key=input.dataset.allocationHeaderFilter,q=String(input.value||'').trim().toLowerCase();
      return optionsFor(key).filter(o=>!q||String(o.label).toLowerCase().includes(q)||String(o.value).toLowerCase().includes(q))
    }
    function renderOptions(input){
      const list=input.parentElement?.querySelector('.allocation-filter-options');if(!list)return;
      const matches=matchesFor(input);
      list.innerHTML=matches.length?matches.map(o=>`<button type="button" class="allocation-filter-option" role="option" data-filter-value="${esc(o.value)}"><strong>${esc(o.label)}</strong></button>`).join(''):'<div class="allocation-filter-empty">No matching values</div>';
      list.classList.add('open');input.setAttribute('aria-expanded','true');
      list.querySelectorAll('[data-filter-value]').forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault();selectOption(input,btn.dataset.filterValue)}))
    }
    function selectOption(input,value){
      const key=input.dataset.allocationHeaderFilter;
      allocationState.filters=allocationState.filters||{demand:'',person:''};allocationState.filters[key]=value;input.dataset.selectedValue=value;input.value=displayFor(key,value);closeList(input,false);
      renderAllocations();
      requestAnimationFrame(()=>{const next=document.querySelector(`#allocationTable [data-allocation-header-filter="${key}"]`);if(next){next.value=displayFor(key,value);next.dataset.selectedValue=value;next.focus({preventScroll:true});next.select?.()}})
    }

    function bindInput(input,key){
      input.addEventListener('focus',()=>{input.select?.();renderOptions(input)});
      input.addEventListener('input',()=>{input.dataset.selectedValue='';renderOptions(input)});
      input.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();closeList(input,true);input.blur();return}
        if(e.key==='Enter'){
          const matches=matchesFor(input),exact=matches.filter(o=>String(o.label).toLowerCase()===String(input.value).trim().toLowerCase()||String(o.value).toLowerCase()===String(input.value).trim().toLowerCase()),choice=exact.length===1?exact[0]:(matches.length===1?matches[0]:null);
          if(choice){e.preventDefault();selectOption(input,choice.value)}
          return
        }
        if(e.key==='ArrowDown'){const first=input.parentElement?.querySelector('[data-filter-value]');if(first){e.preventDefault();first.focus()}}
      });
      input.addEventListener('blur',()=>setTimeout(()=>{if(!input.dataset.selectedValue)closeList(input,true);else closeList(input,false)},120))
    }

    function ensureFilters(){
      if(applying)return;applying=true;
      try{
        const table=document.getElementById('allocationTable'),thead=table?.tHead;if(!thead)return;
        const actions=thead.querySelector('.list-action-row .list-sticky-actions');if(!actions)return;
        let filters=actions.querySelector('.allocation-header-filters');if(!filters){filters=document.createElement('div');filters.className='allocation-header-filters';actions.appendChild(filters)}

        let demand=filters.querySelector('[data-allocation-header-filter="demand"]'),resource=filters.querySelector('[data-allocation-header-filter="person"]');
        if(!demand){const node=field('Demand','demand',allocationState.filters?.demand||'','find demand…');demand=node.querySelector('input');bindInput(demand,'demand');filters.appendChild(node)}
        if(!resource){const node=field('Resource','person',allocationState.filters?.person||'','find resource…');resource=node.querySelector('input');bindInput(resource,'person');filters.appendChild(node)}

        if(document.activeElement!==demand){const v=allocationState.filters?.demand||'';demand.dataset.selectedValue=v;demand.value=displayFor('demand',v)}
        if(document.activeElement!==resource){const v=allocationState.filters?.person||'';resource.dataset.selectedValue=v;resource.value=displayFor('person',v)}

        [...thead.rows].forEach(row=>{if(row.classList.contains('allocation-demand-filter-row')||row.classList.contains('filter-row'))row.remove()});
      }finally{applying=false}
    }

    const baseRenderAllocations=renderAllocations;
    renderAllocations=function(){const result=baseRenderAllocations.apply(this,arguments);ensureFilters();return result};
    const table=document.getElementById('allocationTable');if(table)new MutationObserver(()=>requestAnimationFrame(ensureFilters)).observe(table,{subtree:true,childList:true});

    if(!document.getElementById('allocation-header-filter-styles')){const style=document.createElement('style');style.id='allocation-header-filter-styles';style.textContent=`
      #allocationTable .list-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #allocationTable .allocation-header-filters{display:flex;align-items:center;gap:8px;margin-left:6px;flex-wrap:wrap}
      #allocationTable .allocation-header-filter{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;color:var(--muted);white-space:nowrap}
      #allocationTable .allocation-filter-combobox{position:relative}
      #allocationTable .allocation-header-filter input{width:190px;max-width:26vw;min-width:120px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:.72rem}
      #allocationTable .allocation-filter-options{display:none;position:absolute;z-index:90;left:0;top:calc(100% + 3px);width:max(100%,270px);max-width:420px;max-height:260px;overflow:auto;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow)}
      #allocationTable .allocation-filter-options.open{display:block}
      #allocationTable .allocation-filter-option{display:block;width:100%;border:0;border-radius:6px;background:transparent;color:var(--ink);padding:7px 8px;text-align:left;cursor:pointer;font-size:.72rem}
      #allocationTable .allocation-filter-option:hover,#allocationTable .allocation-filter-option:focus{background:var(--soft);outline:none}
      #allocationTable .allocation-filter-option strong{font-weight:700}
      #allocationTable .allocation-filter-empty{padding:8px;color:var(--muted);font-size:.72rem}
      @media(max-width:760px){#allocationTable .allocation-header-filter span{display:none}#allocationTable .allocation-header-filter input{width:145px;max-width:38vw}#allocationTable .allocation-filter-options{width:250px;max-width:78vw}}
    `;document.head.appendChild(style)}

    renderAllocations();ensureFilters()
  }
  install();
})();
