import {prepareDemandForSave} from '../../domain/demand/demand-record.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current??'')===String(value)?'selected':''}>${esc(label)}</option>`;

export async function editDemand(dialog,{demand,settings,people,onSave,isNew=false}){
  const working=structuredClone(demand);
  const initiatives=(settings.initiatives||[]).map(i=>typeof i==='string'?{name:i,businessArea:''}:i);
  dialog.innerHTML=`<form method="dialog" class="demand-editor"><header><div><h2>${isNew?'New Demand':esc(demand.id)}</h2><p>${isNew?`Create ${esc(demand.id)} in the canonical /demand slice.`:'Edit Defined Demand in the canonical /demand slice.'}</p></div><button class="btn" value="cancel">Close</button></header><div class="editor-grid">
    <label class="span-2">Title<input name="title" required value="${esc(demand.title||'')}"></label>
    <label>Business Area<select name="businessArea" required>${option('','Choose…',demand.businessArea)}${(settings.businessAreas||[]).map(x=>option(x,x,demand.businessArea)).join('')}</select></label>
    <label>Initiative<select name="initiative"></select></label>
    <label>Project Number<input name="projectNumber" inputmode="numeric" value="${esc(demand.projectNumber||'')}"></label>
    <label>State<select name="status">${(settings.statuses||[]).map(x=>option(x,x,demand.status)).join('')}</select></label>
    <label>Owner<select name="ownerId">${option('','Unallocated',demand.ownerId)}${people.map(p=>option(p.id,p.name||p.id,demand.ownerId)).join('')}</select></label>
    <label>Priority<select name="priority">${option('','—',demand.priority)}${(settings.priorities||[]).map(x=>option(x,x,demand.priority)).join('')}</select></label>
    <label>Health<select name="health">${option('','—',demand.health)}${(settings.healthStates||[]).map(x=>option(x,x,demand.health)).join('')}</select></label>
    <label class="span-2">Summary / Context<textarea name="context" rows="6">${esc(demand.context||demand.summary||'')}</textarea></label>
  </div><footer><span data-error class="editor-error" role="alert"></span><button type="button" class="btn primary" data-save>${isNew?'Create Demand':'Save Demand'}</button></footer></form>`;
  const form=dialog.querySelector('form'),business=form.elements.businessArea,initiative=form.elements.initiative;
  const renderInitiatives=()=>{const values=initiatives.filter(i=>!i.businessArea||i.businessArea===business.value);initiative.innerHTML=option('','—',working.initiative)+values.map(i=>option(i.name,i.name,working.initiative)).join('')};
  business.addEventListener('change',()=>{working.initiative='';renderInitiatives()});renderInitiatives();dialog.showModal();
  form.querySelector('[data-save]').addEventListener('click',async()=>{
    const error=form.querySelector('[data-error]');error.textContent='';
    try{
      const values=Object.fromEntries(new FormData(form).entries());
      const next=prepareDemandForSave({...demand,...values});
      form.querySelector('[data-save]').disabled=true;await onSave(next,{isNew});dialog.close('saved');
    }catch(e){error.textContent=e.message||String(e);form.querySelector('[data-save]').disabled=false}
  });
}
