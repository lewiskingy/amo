import {prepareWorkPackageForSave} from '../../domain/work-packages/work-package-record.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current??'')===String(value)?'selected':''}>${esc(label)}</option>`;

export async function editWorkPackage(dialog,{workPackage,demand,settings,onSave}){
  dialog.setAttribute('aria-labelledby','work-package-editor-title');
  dialog.innerHTML=`<form method="dialog" class="demand-editor work-package-editor"><header><div><h2 id="work-package-editor-title">${esc(workPackage.id)}</h2><p>Child of ${esc(demand?.id||workPackage.demandId)} · ${esc(demand?.title||'Defined Demand')}</p></div><button class="btn" value="cancel">Close</button></header><div class="editor-grid">
    <label>Work Package ID<input name="id" value="${esc(workPackage.id)}" readonly></label>
    <label>Service<select name="service">${option('','Choose…',workPackage.service||workPackage.architectureService)}${(settings.services||[]).map(x=>option(x,x,workPackage.service||workPackage.architectureService)).join('')}</select></label>
    <label>State<select name="status">${(settings.workPackageStatuses||[]).map(x=>option(x,x,workPackage.status)).join('')}</select></label>
    <label>Estimated Effort (days)<input name="estimatedEffortDays" type="number" min="0" step="0.5" value="${esc(workPackage.estimatedEffortDays??workPackage.romDays??'')}"></label>
    <label class="span-2">Title<input name="title" required value="${esc(workPackage.title||'')}"></label>
    <label>Target Start<input name="targetStart" type="date" value="${esc(workPackage.targetStart||'')}"></label>
    <label>Target End<input name="targetEnd" type="date" value="${esc(workPackage.targetEnd||'')}"></label>
    <label class="span-2">Azure DevOps Work Item Reference<input name="azureDevOpsWorkItemId" inputmode="numeric" value="${esc(workPackage.azureDevOpsWorkItemId||'')}"></label>
  </div><footer><span data-error class="editor-error" role="alert" aria-live="polite"></span><button type="button" class="btn primary" data-save>Save Work Package</button></footer></form>`;
  const form=dialog.querySelector('form');dialog.showModal();form.elements.title.focus();
  form.querySelector('[data-save]').addEventListener('click',async()=>{
    const error=form.querySelector('[data-error]');error.textContent='';
    try{const values=Object.fromEntries(new FormData(form).entries());const next=prepareWorkPackageForSave({...workPackage,...values},{settings});form.querySelector('[data-save]').disabled=true;await onSave(next);dialog.close('saved')}
    catch(e){error.textContent=e.message||String(e);form.querySelector('[data-save]').disabled=false}
  });
}
