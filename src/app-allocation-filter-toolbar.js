/* Allocations sticky Demand/Resource filters.
   Deliberately mirrors the proven allocation-row Resource combobox: typing only narrows
   the popup; the grid is filtered only after an option is explicitly selected. */
(function initAllocationFilterToolbar(){
  function install(){
    if(typeof renderAllocations!=='function'||!document.getElementById('allocation-interaction-styles')){setTimeout(install,25);return}
    if(window.__amoAllocationFilterToolbarInstalled)return;window.__amoAllocationFilterToolbarInstalled=true;

    const esc=v=>typeof escHtml==='function'?escHtml(v):String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const allocationSource=()=>allocationState.editing?(allocationState.draft||[]):((typeof db!=='undefined'&&db.allocations)||[]);
    const scopedDemands=()=>{const base=typeof scopedDemand==='function'?scopedDemand():((typeof db!=='undefined'&&db.demand)||[]);return(base||[]).filter(d=>typeof isOpenDemand==='function'?isOpenDemand(d):true)};
    const personName=id=>typeof person==='function'?(person(id)?.name||''):(((typeof db!=='undefined'&&db.team)||[]).find(p=>p.id===id)?.name||'');

    function demandOptions(){
      const resource=String(allocationState.filters?.person||'').trim().toLowerCase(),allocs=allocationSource();
      return scopedDemands().filter(d=>!resource||allocs.some(a=>a.demandId===d.id&&!allocationState.deleted?.has?.(a.id)&&personName(a.teamMemberId).toLowerCase()===resource)).map(d=>({value:d.id,label:`${d.id} — ${d.title||''}`}));
    }
    function resourceOptions(){
      const demand=String(allocationState.filters?.demand||'').trim().toLowerCase(),ids=new Set(scopedDemands().filter(d=>!demand||String(d.id).toLowerCase()===demand).map(d=>d.id)),names=new Set();
      allocationSource().forEach(a=>{if(ids.has(a.demandId)&&!allocationState.deleted?.has?.(a.id)){const n=personName(a.teamMemberId);if(n)names.add(n)}});
      return[...names].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(n=>({value:n,label:n}));
    }
    const optionsFor=key=>key==='demand'?demandOptions():resourceOptions();
    function displayFor(key,value){if(!value)return'';return optionsFor(key).find(o=>String(o.value).toLowerCase()===String(value).toLowerCase())?.label||String(value)}
    function matches(input){const q=String(input.value||'').trim().toLowerCase();return optionsFor(input.dataset.allocationHeaderFilter).filter(o=>!q||o.label.toLowerCase().includes(q)||String(o.value).toLowerCase().includes(q))}

    function makeField(label,key,placeholder){
      const wrap=document.createElement('label');wrap.className='allocation-header-filter';
      const caption=document.createElement('span');caption.textContent=label;
      const combo=document.createElement('div');combo.className='alloc-combobox allocation-filter-combobox';
      const input=document.createElement('input');input.className='alloc-resource-input allocation-filter-input';input.type='text';input.autocomplete='off';input.placeholder=placeholder;input.dataset.allocationHeaderFilter=key;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
      const list=document.createElement('div');list.className='alloc-combo-list allocation-filter-list';list.setAttribute('role','listbox');
      combo.append(input,list);wrap.append(caption,combo);bind(input);sync(input);return wrap
    }
    function sync(input){const key=input.dataset.allocationHeaderFilter,value=allocationState.filters?.[key]||'';input.dataset.selectedValue=value;input.value=displayFor(key,value)}
    function close(input,restore=false){input.parentElement?.querySelector('.alloc-combo-list')?.classList.remove('open');input.setAttribute('aria-expanded','false');if(restore)sync(input)}
    function show(input){
      const list=input.parentElement?.querySelector('.alloc-combo-list');if(!list)return;const found=matches(input);
      list.innerHTML=found.length?found.map(o=>`<button type="button" role="option" class="alloc-combo-option" data-filter-value="${esc(o.value)}"><strong>${esc(o.label)}</strong></button>`).join(''):'<div class="alloc-combo-empty">No matching values</div>';
      list.classList.add('open');input.setAttribute('aria-expanded','true');
      list.querySelectorAll('[data-filter-value]').forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault();commit(input,btn.dataset.filterValue)}));
    }
    function commit(input,value){
      const key=input.dataset.allocationHeaderFilter;allocationState.filters=allocationState.filters||{demand:'',person:''};allocationState.filters[key]=value;input.dataset.selectedValue=value;input.value=displayFor(key,value);close(input,false);
      /* Selection is the ONLY point at which the grid rerenders/applies a filter. */
      renderAllocations();
    }
    function bind(input){
      input.addEventListener('focus',()=>show(input));
      input.addEventListener('input',()=>{input.dataset.selectedValue='';show(input)});
      input.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();close(input,true);input.blur();return}
        if(e.key==='Enter'){const found=matches(input),q=String(input.value).trim().toLowerCase(),exact=found.filter(o=>o.label.toLowerCase()===q||String(o.value).toLowerCase()===q),choice=exact.length===1?exact[0]:(found.length===1?found[0]:null);if(choice){e.preventDefault();commit(input,choice.value)}return}
        if(e.key==='ArrowDown'){const first=input.parentElement?.querySelector('[data-filter-value]');if(first){e.preventDefault();first.focus()}}
      });
      input.addEventListener('blur',()=>setTimeout(()=>{if(!input.dataset.selectedValue)close(input,true);else close(input,false)},120));
    }

    function ensureFilters(){
      const thead=document.getElementById('allocationTable')?.tHead,actions=thead?.querySelector('.list-action-row .list-sticky-actions');if(!actions)return;
      let holder=actions.querySelector('.allocation-header-filters');if(!holder){holder=document.createElement('div');holder.className='allocation-header-filters';holder.append(makeField('Demand','demand','find demand…'),makeField('Resource','person','find resource…'));actions.appendChild(holder)}
      holder.querySelectorAll('[data-allocation-header-filter]').forEach(input=>{if(document.activeElement!==input)sync(input)});
      [...thead.rows].forEach(row=>{if(row.classList.contains('allocation-demand-filter-row')||row.classList.contains('filter-row'))row.remove()});
    }

    const baseRender=renderAllocations;renderAllocations=function(){const result=baseRender.apply(this,arguments);ensureFilters();return result};
    /* No MutationObserver here: rebuilding suggestion rows must never disturb input focus. */
    if(!document.getElementById('allocation-header-filter-styles')){const style=document.createElement('style');style.id='allocation-header-filter-styles';style.textContent=`
      #allocationTable .list-sticky-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #allocationTable .allocation-header-filters{display:flex;align-items:center;gap:10px;margin-left:6px;flex-wrap:wrap}
      #allocationTable .allocation-header-filter{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;color:var(--muted);white-space:nowrap}
      #allocationTable .allocation-filter-combobox{position:relative;width:210px}
      #allocationTable .allocation-filter-input{width:100%;box-sizing:border-box}
      #allocationTable .allocation-filter-list{z-index:200;min-width:100%;width:max-content;max-width:430px;max-height:280px;overflow:auto}
      #allocationTable .allocation-filter-list .alloc-combo-option{min-width:100%;white-space:nowrap}
      @media(max-width:760px){#allocationTable .allocation-header-filter>span{display:none}#allocationTable .allocation-filter-combobox{width:150px}#allocationTable .allocation-filter-list{max-width:78vw}}
    `;document.head.appendChild(style)}
    renderAllocations();
  }
  install();
})();
