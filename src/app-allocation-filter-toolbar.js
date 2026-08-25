/* Allocations Demand/Resource combobox filters.
   This module intentionally does not wrap renderAllocations. The allocation renderer has
   several historical wrappers/overrides, so the controls are maintained as a DOM enhancement
   and restored after every table render. Typing only narrows suggestions; selecting commits. */
(function initAllocationFilterToolbar(){
  if(window.__amoAllocationFilterToolbarInstalled)return;
  window.__amoAllocationFilterToolbarInstalled=true;

  const esc=v=>typeof escHtml==='function'?escHtml(v):String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  let scheduled=false,observer=null;

  function allocationSource(){return allocationState?.editing?(allocationState.draft||[]):((typeof db!=='undefined'&&db.allocations)||[])}
  function scopedDemands(){const base=typeof scopedDemand==='function'?scopedDemand():((typeof db!=='undefined'&&db.demand)||[]);return(base||[]).filter(d=>typeof isOpenDemand==='function'?isOpenDemand(d):true)}
  function personName(id){return typeof person==='function'?(person(id)?.name||''):(((typeof db!=='undefined'&&db.team)||[]).find(p=>p.id===id)?.name||'')}
  function filters(){allocationState.filters=allocationState.filters||{demand:'',person:''};return allocationState.filters}

  function demandOptions(){
    const selectedResource=String(filters().person||'').trim().toLowerCase(),allocs=allocationSource();
    return scopedDemands().filter(d=>!selectedResource||allocs.some(a=>a.demandId===d.id&&!allocationState.deleted?.has?.(a.id)&&personName(a.teamMemberId).toLowerCase()===selectedResource)).map(d=>({value:d.id,label:`${d.id} — ${d.title||''}`}));
  }
  function resourceOptions(){
    const selectedDemand=String(filters().demand||'').trim().toLowerCase(),allowed=new Set(scopedDemands().filter(d=>!selectedDemand||String(d.id).toLowerCase()===selectedDemand).map(d=>d.id)),names=new Set();
    allocationSource().forEach(a=>{if(allowed.has(a.demandId)&&!allocationState.deleted?.has?.(a.id)){const n=personName(a.teamMemberId);if(n)names.add(n)}});
    return[...names].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'})).map(n=>({value:n,label:n}));
  }
  function optionsFor(key){return key==='demand'?demandOptions():resourceOptions()}
  function displayFor(key,value){if(!value)return'';return optionsFor(key).find(o=>String(o.value).toLowerCase()===String(value).toLowerCase())?.label||String(value)}
  function matches(input){const q=String(input.value||'').trim().toLowerCase();return optionsFor(input.dataset.allocationHeaderFilter).filter(o=>!q||o.label.toLowerCase().includes(q)||String(o.value).toLowerCase().includes(q))}

  function close(input,restore=false){const list=input.parentElement?.querySelector('.allocation-filter-list');list?.classList.remove('open');input.setAttribute('aria-expanded','false');if(restore)sync(input)}
  function sync(input){const key=input.dataset.allocationHeaderFilter,value=filters()[key]||'';input.dataset.selectedValue=value;input.value=displayFor(key,value)}
  function show(input){
    const list=input.parentElement?.querySelector('.allocation-filter-list');if(!list)return;const found=matches(input);
    list.innerHTML=found.length?found.map(o=>`<button type="button" class="allocation-filter-option" role="option" data-filter-value="${esc(o.value)}"><strong>${esc(o.label)}</strong></button>`).join(''):'<div class="allocation-filter-empty">No matching values</div>';
    list.classList.add('open');input.setAttribute('aria-expanded','true');
    list.querySelectorAll('[data-filter-value]').forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault();commit(input,btn.dataset.filterValue)}));
  }
  function commit(input,value){const key=input.dataset.allocationHeaderFilter;filters()[key]=value;input.dataset.selectedValue=value;input.value=displayFor(key,value);close(input,false);if(typeof renderAllocations==='function')renderAllocations();scheduleEnsure()}
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
  function field(label,key,placeholder){const wrap=document.createElement('label');wrap.className='allocation-header-filter';wrap.innerHTML=`<span>${label}</span><div class="allocation-filter-combobox"><input class="allocation-filter-input" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="${placeholder}" data-allocation-header-filter="${key}"><div class="allocation-filter-list" role="listbox"></div></div>`;const input=wrap.querySelector('input');bind(input);sync(input);return wrap}

  function ensureActionRow(thead){
    let row=thead.querySelector('.list-action-row'),actions=row?.querySelector('.list-sticky-actions');
    if(actions)return actions;
    const toolbar=document.getElementById('allocationToolbar'),columns=Math.max(1,thead.rows[0]?.cells?.length||1);row=thead.insertRow(0);row.className='list-action-row';const cell=row.insertCell();cell.colSpan=columns;cell.className='list-action-cell';actions=document.createElement('div');actions.className='list-sticky-actions';
    [...toolbar?.querySelectorAll('button')||[]].forEach(original=>{const clone=document.createElement('button');clone.type='button';clone.className=original.className;clone.disabled=original.disabled;clone.textContent=original.textContent;clone.onclick=()=>{if(!original.disabled)original.click()};actions.appendChild(clone)});cell.appendChild(actions);return actions
  }
  function ensure(){
    scheduled=false;const table=document.getElementById('allocationTable'),thead=table?.tHead;if(!table||!thead)return;
    const actions=ensureActionRow(thead);if(!actions)return;
    let holder=actions.querySelector('.allocation-header-filters');
    if(!holder){holder=document.createElement('div');holder.className='allocation-header-filters';holder.append(field('Demand','demand','Find demand…'),field('Resource','person','Find resource…'));actions.appendChild(holder)}
    holder.querySelectorAll('[data-allocation-header-filter]').forEach(input=>{if(document.activeElement!==input)sync(input)});
    [...thead.rows].forEach(row=>{if(row!==actions.closest('tr')&&(row.classList.contains('filter-row')||row.classList.contains('allocation-demand-filter-row')))row.remove()});
  }
  function scheduleEnsure(){if(scheduled)return;scheduled=true;requestAnimationFrame(ensure)}

  function start(){
    const table=document.getElementById('allocationTable');if(!table){setTimeout(start,50);return}
    if(observer)observer.disconnect();observer=new MutationObserver(scheduleEnsure);observer.observe(table,{subtree:true,childList:true});scheduleEnsure();
    document.getElementById('allocationToolbar')&&new MutationObserver(scheduleEnsure).observe(document.getElementById('allocationToolbar'),{subtree:true,childList:true});
  }

  if(!document.getElementById('allocation-header-filter-styles')){const style=document.createElement('style');style.id='allocation-header-filter-styles';style.textContent=`
    #allocationTable .list-sticky-actions{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;flex-flow:row nowrap!important;overflow:visible!important}
    #allocationTable .allocation-header-filters{display:flex!important;align-items:center!important;gap:10px!important;flex-flow:row nowrap!important;margin-left:4px!important}
    #allocationTable .allocation-header-filter{display:flex!important;align-items:center;gap:5px;margin:0;font-size:.72rem;font-weight:700;color:var(--muted);white-space:nowrap}
    #allocationTable .allocation-filter-combobox{position:relative;width:190px;min-width:150px}
    #allocationTable .allocation-filter-input{display:block!important;width:100%;height:30px;box-sizing:border-box;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink);font:inherit}
    #allocationTable .allocation-filter-list{display:none;position:absolute;z-index:700;left:0;top:calc(100% + 3px);min-width:100%;width:max-content;max-width:430px;max-height:280px;overflow:auto;padding:4px;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow)}
    #allocationTable .allocation-filter-list.open{display:block}
    #allocationTable .allocation-filter-option{display:block;width:100%;padding:8px 10px;border:0;border-radius:6px;background:transparent;color:var(--ink);text-align:left;white-space:nowrap;cursor:pointer}
    #allocationTable .allocation-filter-option:hover,#allocationTable .allocation-filter-option:focus{background:var(--soft)}
    #allocationTable .allocation-filter-empty{padding:8px 10px;color:var(--muted);font-size:.75rem}
    @media(max-width:900px){#allocationTable .list-sticky-actions{overflow-x:auto!important}#allocationTable .allocation-header-filter>span{display:none}#allocationTable .allocation-filter-combobox{width:155px;min-width:135px}}
  `;document.head.appendChild(style)}
  start();
})();
