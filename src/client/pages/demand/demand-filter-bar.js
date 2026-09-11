const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;

export function renderDemandFilterBar(host,{filters,settings,people,onChange,onClear}){
  const businessAreas=[...new Set((settings.businessAreas||[]).filter(Boolean))];
  const initiatives=[...new Set((settings.initiatives||[]).map(i=>typeof i==='string'?i:i.name).filter(Boolean))];
  host.className='demand-filter-bar';
  host.innerHTML=`
    <label>Show<select data-filter="show">${option('active','Active',filters.show)}${option('all','All',filters.show)}</select></label>
    <label>Business Area<select data-filter="businessArea">${option('','All',filters.businessArea)}${businessAreas.map(x=>option(x,x,filters.businessArea)).join('')}</select></label>
    <label>Initiative<select data-filter="initiative">${option('','All',filters.initiative)}${initiatives.map(x=>option(x,x,filters.initiative)).join('')}</select></label>
    <label>Owner<select data-filter="ownerId">${option('','All',filters.ownerId)}${people.map(p=>option(p.id,p.name||p.id,filters.ownerId)).join('')}</select></label>
    <label>Project<select data-filter="projectNumber">${option('any','All',filters.projectNumber)}${option('present','Has Project Number',filters.projectNumber)}${option('missing','No Project Number',filters.projectNumber)}</select></label>
    <label>Control<select data-filter="control">${option('','All',filters.control)}${option('funding-missing','Funding missing',filters.control)}${option('resource-missing','Resource missing',filters.control)}${option('work-item-missing','Work Item missing',filters.control)}</select></label>
    <label class="filter-search">Search<input data-filter="search" value="${esc(filters.search)}" placeholder="ID, title, Project Number…"></label>
    <button type="button" class="btn" data-clear>Clear</button>`;
  host.querySelectorAll('[data-filter]').forEach(control=>{
    const event=control.tagName==='INPUT'?'input':'change';
    control.addEventListener(event,()=>onChange(control.dataset.filter,control.value));
  });
  host.querySelector('[data-clear]').addEventListener('click',onClear);
}
