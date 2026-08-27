/* Shared semantic filtering for Demand, People and Ideas.
   Filter semantics are deliberately independent of edit control types. */
(function initSemanticFilters(){
  if(window.__amoSemanticFiltersLoaded)return;window.__amoSemanticFiltersLoaded=true;

  const esc=v=>typeof escHtml==='function'?escHtml(v):String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const debounce={};
  const FILTER_OVERRIDES={
    demand:{
      id:'text',businessArea:'lookup',initiative:'lookup',title:'text',costCentreOrProjectCode:'text',priority:'enum',service:'enum',phase:'enum',status:'enum',
      'workPackage.architectureOwner':'lookup','triage.romDays':'number','workPackage.targetStart':'date','workPackage.targetEnd':'date',health:'enum',
      _source:'text',_work:'text','source.url':'text','source.title':'text','azureDevOps.url':'text','azureDevOps.title':'text'
    },
    team:{id:'text',name:'text',role:'lookup',fte:'number',active:'boolean'},
    ideas:{id:'text',raisedBy:'text',raisedDate:'date',title:'text',description:'text',status:'enum'}
  };

  function kind(context,col){return col.filter?.type||FILTER_OVERRIDES[context]?.[col.key]||({date:'date',number:'number',select:'enum'}[col.type]||'text')}
  function stateActive(value,type){if(type==='text'||type==='boolean')return String(value||'').trim()!=='';if(type==='enum'||type==='lookup')return Array.isArray(value)&&value.length>0;if(type==='date')return !!(value?.from||value?.to);if(type==='number')return value?.min!==''&&value?.min!=null||value?.max!==''&&value?.max!=null;return false}
  function optionRows(context,col){
    let rows=[];
    if(context==='demand'&&col.key==='initiative')rows=(typeof normalizeInitiatives==='function'?normalizeInitiatives(db.settings.initiatives||[]):[]).map(x=>({value:x.name,label:x.name}));
    else if(context==='team'&&col.key==='role')rows=[...new Set((db.team||[]).map(x=>String(x.role||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(v=>({value:v,label:v}));
    else rows=(col.values?.()||[]).map(v=>typeof v==='object'?{value:String(v.value??''),label:String(v.label??v.value??'')}:{value:String(v),label:String(v)});
    if(context==='demand'&&col.key==='workPackage.architectureOwner')rows=rows.map(x=>({value:x.label,label:x.label}));
    return [...new Map(rows.filter(x=>x.label!=='—').map(x=>[x.label,{value:x.label,label:x.label}])).values()];
  }
  function summary(value,type){
    if(!stateActive(value,type))return'All';
    if(type==='enum'||type==='lookup')return value.length===1?value[0]:`${value.length} selected`;
    if(type==='date'){if(value.from&&value.to)return`${value.from} → ${value.to}`;return value.from?`From ${value.from}`:`To ${value.to}`}
    if(type==='number'){if(value.min!==''&&value.min!=null&&value.max!==''&&value.max!=null)return`${value.min} – ${value.max}`;return value.min!==''&&value.min!=null?`≥ ${value.min}`:`≤ ${value.max}`}
    return String(value||'');
  }
  function multiControl(context,col,value,type){
    const selected=Array.isArray(value)?value:[],options=optionRows(context,col),search=type==='lookup'&&options.length>5;
    return `<details class="semantic-filter semantic-filter-multi" data-sem-wrap="${esc(col.key)}"><summary title="${esc(summary(selected,type))}">${esc(summary(selected,type))}</summary><div class="semantic-filter-popover">${search?`<input class="semantic-filter-search" data-sem-search type="search" placeholder="Find…">`:''}<div class="semantic-filter-options">${options.map(o=>`<label data-sem-option-label="${esc(o.label.toLowerCase())}"><input type="checkbox" data-sem-choice="${esc(col.key)}" value="${esc(o.value)}" ${selected.includes(o.value)?'checked':''}> <span>${esc(o.label)}</span></label>`).join('')||'<span class="muted">No values</span>'}</div><button type="button" class="semantic-filter-clear" data-sem-clear="${esc(col.key)}">Clear</button></div></details>`;
  }
  function control(context,col,value){
    const type=kind(context,col),key=esc(col.key),v=value??'';
    if(type==='enum'||type==='lookup')return multiControl(context,col,v,type);
    if(type==='date'){const range=v&&typeof v==='object'?v:{};return `<details class="semantic-filter semantic-filter-range"><summary>${esc(summary(range,type))}</summary><div class="semantic-filter-popover semantic-range-fields"><label>From<input type="date" data-sem-date="${key}" data-bound="from" value="${esc(range.from||'')}"></label><label>To<input type="date" data-sem-date="${key}" data-bound="to" value="${esc(range.to||'')}"></label><button type="button" class="semantic-filter-clear" data-sem-clear="${key}">Clear</button></div></details>`}
    if(type==='number'){const range=v&&typeof v==='object'?v:{};return `<details class="semantic-filter semantic-filter-range"><summary>${esc(summary(range,type))}</summary><div class="semantic-filter-popover semantic-range-fields"><label>Min<input type="number" step="any" data-sem-number="${key}" data-bound="min" value="${esc(range.min??'')}"></label><label>Max<input type="number" step="any" data-sem-number="${key}" data-bound="max" value="${esc(range.max??'')}"></label><button type="button" class="semantic-filter-clear" data-sem-clear="${key}">Clear</button></div></details>`}
    if(type==='boolean')return `<select data-sem-boolean="${key}"><option value="">All</option><option value="Yes" ${v==='Yes'?'selected':''}>Active</option><option value="No" ${v==='No'?'selected':''}>Inactive</option></select>`;
    return `<input type="search" data-sem-text="${key}" value="${esc(v)}" placeholder="contains…">`;
  }
  function matches(value,filter,type){
    if(!stateActive(filter,type))return true;
    const text=String(value??'');
    if(type==='text')return text.toLowerCase().includes(String(filter).toLowerCase());
    if(type==='enum'||type==='lookup')return filter.some(v=>String(v).toLowerCase()===text.toLowerCase());
    if(type==='boolean')return text===filter;
    if(type==='date'){const date=text.slice(0,10);if(!date)return false;return(!filter.from||date>=filter.from)&&(!filter.to||date<=filter.to)}
    if(type==='number'){const n=Number(value);if(!Number.isFinite(n))return false;const min=filter.min===''||filter.min==null?null:Number(filter.min),max=filter.max===''||filter.max==null?null:Number(filter.max);return(min==null||n>=min)&&(max==null||n<=max)}
    return true;
  }
  function rowMatches(context,row,cols,filters,valueGetter){return cols.every(col=>matches(valueGetter(row,col),filters[col.key],kind(context,col)))}
  function schedule(context,key,state,render,value){state.filters[key]=value;clearTimeout(debounce[`${context}:${key}`]);debounce[`${context}:${key}`]=setTimeout(render,260)}
  function wire(root,context,cols,state,render){
    if(!root)return;
    root.querySelectorAll('[data-sem-text]').forEach(el=>el.oninput=e=>{const pos=e.target.selectionStart,key=e.target.dataset.semText;schedule(context,key,state,()=>{render();requestAnimationFrame(()=>{const n=document.querySelector(`[data-sem-text="${CSS.escape(key)}"]`);n?.focus({preventScroll:true});n?.setSelectionRange?.(pos,pos)})},e.target.value)});
    root.querySelectorAll('[data-sem-boolean]').forEach(el=>el.onchange=e=>{const key=e.target.dataset.semBoolean;if(e.target.value)state.filters[key]=e.target.value;else delete state.filters[key];render()});
    root.querySelectorAll('[data-sem-choice]').forEach(el=>el.onchange=e=>{const key=e.target.dataset.semChoice,wrap=e.target.closest('[data-sem-wrap]'),checked=[...wrap.querySelectorAll(`[data-sem-choice="${CSS.escape(key)}"]:checked`)].map(x=>x.value);if(checked.length)state.filters[key]=checked;else delete state.filters[key];render()});
    root.querySelectorAll('[data-sem-search]').forEach(el=>el.oninput=e=>{const q=e.target.value.trim().toLowerCase();e.target.closest('.semantic-filter-popover').querySelectorAll('[data-sem-option-label]').forEach(label=>label.hidden=!!q&&!label.dataset.semOptionLabel.includes(q))});
    root.querySelectorAll('[data-sem-date]').forEach(el=>el.onchange=e=>{const key=e.target.dataset.semDate,current=state.filters[key]&&typeof state.filters[key]==='object'?{...state.filters[key]}:{from:'',to:''};current[e.target.dataset.bound]=e.target.value;if(current.from||current.to)state.filters[key]=current;else delete state.filters[key];render()});
    root.querySelectorAll('[data-sem-number]').forEach(el=>el.onchange=e=>{const key=e.target.dataset.semNumber,current=state.filters[key]&&typeof state.filters[key]==='object'?{...state.filters[key]}:{min:'',max:''};current[e.target.dataset.bound]=e.target.value;if(current.min!==''||current.max!=='')state.filters[key]=current;else delete state.filters[key];render()});
    root.querySelectorAll('[data-sem-clear]').forEach(el=>el.onclick=()=>{delete state.filters[el.dataset.semClear];render()});
  }
  window.AmoFilters={kind,control,matches,rowMatches,wire,optionRows,stateActive};

  /* People: replace generic contains filtering with semantic controls. */
  if(typeof gridRows==='function'&&typeof filterControl==='function'){
    gridRows=function(name){const s=gridState[name],base=s.editing?s.draft:(name==='demand'?db.demand:db.team),cols=name==='demand'?demandCols:teamCols,context=name==='team'?'team':'demand';let rows=base.filter(r=>(!s.editing||!s.deleted.has(r.id))&&rowMatches(context,r,cols,s.filters,(row,col)=>displayVal(row,col)));if(s.sort){const c=cols.find(x=>x.key===s.sort);rows=[...rows].sort((a,b)=>{const av=displayVal(a,c),bv=displayVal(b,c);return typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'})});if(s.direction==='desc')rows.reverse()}return rows};
    filterControl=function(name,col){return control(name==='team'?'team':'demand',col,gridState[name].filters[col.key])};
    const priorRenderGrid=renderGrid;
    renderGrid=function(name){const result=priorRenderGrid(name);if(name==='team')wire($('teamTable'),'team',teamCols,gridState.team,()=>renderGrid('team'));return result};
  }

  /* Demand: integrated register owns display values, so prefilter before its legacy renderer. */
  if(typeof integratedDemandFilter==='function'&&typeof renderIntegratedDemandGrid==='function'){
    integratedDemandFilter=function(col){return control('demand',col,gridState.demand.filters[col.key])};
    const priorIntegratedDemandGrid=renderIntegratedDemandGrid;
    renderIntegratedDemandGrid=function(){
      const s=gridState.demand,cols=integratedDemandCols(),allDemand=db.demand,allDraft=s.draft,filters=s.filters;
      const source=s.editing?(allDraft||[]):allDemand,visible=source.filter(r=>(!s.editing||!s.deleted.has(r.id))&&rowMatches('demand',r,cols,filters,(row,col)=>integratedDemandValue(row,col)));
      db.demand=s.editing?allDemand:visible;if(s.editing)s.draft=visible;s.filters={};
      try{priorIntegratedDemandGrid()}finally{db.demand=allDemand;s.draft=allDraft;s.filters=filters}
      const row=$('demandTable')?.tHead?.querySelector('.filter-row');if(row){const cells=[...row.cells];cols.forEach((c,i)=>{if(cells[i])cells[i].innerHTML=integratedDemandFilter(c)})}
      wire($('demandTable'),'demand',cols,s,()=>renderGrid('demand'));
      const count=$('demandCount');if(count&&workspaceHandle)count.textContent=`Showing ${visible.length} of ${source.length-(s.editing?s.deleted.size:0)} records`;
    };
  }

  /* Ideas: reuse the same semantic control and matcher rather than its bespoke contains implementation. */
  if(typeof ideaRows==='function'&&typeof ideaFilterControl==='function'&&typeof renderIdeas==='function'){
    ideaRows=function(){const source=ideaState.editing?ideaState.draft:db.ideas;let rows=source.filter(r=>!ideaState.deleted.has(r.id)&&rowMatches('ideas',r,ideaCols,ideaState.filters,(row,col)=>row[col.key]??''));if(ideaState.sort){const k=ideaState.sort;rows=[...rows].sort((a,b)=>String(a[k]??'').localeCompare(String(b[k]??''),undefined,{numeric:true,sensitivity:'base'}));if(ideaState.direction==='desc')rows.reverse()}return rows};
    ideaFilterControl=function(col){return control('ideas',col,ideaState.filters[col.key])};
    const priorRenderIdeas=renderIdeas;
    renderIdeas=function(){const result=priorRenderIdeas();wire($('ideaTable'),'ideas',ideaCols,ideaState,renderIdeas);return result};
  }

  if(!document.getElementById('semantic-filter-styles')){const style=document.createElement('style');style.id='semantic-filter-styles';style.textContent=`
    .filter-row .semantic-filter{position:relative;min-width:92px}.filter-row .semantic-filter summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:5px 7px;background:var(--panel);color:var(--ink);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}.filter-row .semantic-filter summary::-webkit-details-marker{display:none}
    .filter-row .semantic-filter-popover{position:absolute;z-index:650;top:calc(100% + 4px);left:0;min-width:205px;max-width:320px;max-height:310px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:9px;box-shadow:var(--shadow);padding:7px}.filter-row .semantic-filter-search{width:100%;margin-bottom:5px}.filter-row .semantic-filter-options label{display:flex;gap:7px;align-items:center;padding:5px 3px;white-space:nowrap;font-size:.75rem}.filter-row .semantic-filter-clear{margin-top:5px;border:0;background:transparent;color:var(--accent2);cursor:pointer;font-weight:700;font-size:.72rem;padding:4px}
    .filter-row .semantic-range-fields{display:grid;gap:7px;min-width:225px}.filter-row .semantic-range-fields label{display:grid;grid-template-columns:42px 1fr;gap:7px;align-items:center;font-size:.72rem;color:var(--muted)}.filter-row .semantic-range-fields input{min-width:150px}.filter-row input[data-sem-text],.filter-row select[data-sem-boolean]{min-width:92px;max-width:150px}
  `;document.head.appendChild(style)}
})();
