import {buildWorkItemReference} from '../../domain/work-packages/work-item-reference.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current??'')===String(value)?'selected':''}>${esc(label)}</option>`;
const interactiveTarget=target=>!!target?.closest?.('button,a,input,select,textarea,label');

function workItem(demand,wp,settings){
  const reference=buildWorkItemReference(wp,demand,settings);
  if(!reference.id)return'<span class="control-badge danger">Work Item missing</span>';
  if(!reference.url)return`<span class="work-item-id">#${esc(reference.id)}</span>`;
  return`<a href="${reference.url}" target="_blank" rel="noopener">#${esc(reference.id)}</a>`;
}
function controlBadges(control){
  const badges=[];
  if(control.fundingMissing)badges.push('<span class="control-badge danger">Funding missing</span>');
  if(control.resourceMissing)badges.push('<span class="control-badge danger">Resource missing</span>');
  if(control.workItemMissing)badges.push('<span class="control-badge danger">Work Item missing</span>');
  if(control.actualsMissing)badges.push('<span class="control-badge danger">Actuals missing</span>');
  if(!badges.length)badges.push('<span class="control-badge neutral">No exception</span>');
  return badges.join(' ');
}
function demandCellEditors(demand,settings,people){
  const initiatives=(settings.initiatives||[]).map(i=>typeof i==='string'?{name:i,businessArea:''}:i).filter(i=>!i.businessArea||i.businessArea===demand.businessArea);
  return {
    title:`<strong>${esc(demand.id)}</strong><input class="list-cell-input row-title-input" data-inline-entity="demand" data-field="title" value="${esc(demand.title||'')}" aria-label="${esc(demand.id)} title">`,
    businessArea:`<select class="list-cell-input" data-inline-entity="demand" data-field="businessArea" aria-label="${esc(demand.id)} business area">${option('','Choose…',demand.businessArea)}${(settings.businessAreas||[]).map(x=>option(x,x,demand.businessArea)).join('')}</select>`,
    initiative:`<select class="list-cell-input" data-inline-entity="demand" data-field="initiative" aria-label="${esc(demand.id)} initiative">${option('','—',demand.initiative)}${initiatives.map(i=>option(i.name,i.name,demand.initiative)).join('')}</select>`,
    projectNumber:`<input class="list-cell-input" data-inline-entity="demand" data-field="projectNumber" inputmode="numeric" value="${esc(demand.projectNumber||'')}" aria-label="${esc(demand.id)} project number">`,
    status:`<select class="list-cell-input" data-inline-entity="demand" data-field="status" aria-label="${esc(demand.id)} state">${(settings.statuses||[]).map(x=>option(x,x,demand.status)).join('')}</select>`,
    owner:`<select class="list-cell-input" data-inline-entity="demand" data-field="ownerId" aria-label="${esc(demand.id)} owner">${option('','Unallocated',demand.ownerId)}${people.map(p=>option(p.id,p.name||p.id,demand.ownerId)).join('')}</select>`
  };
}
function workPackageEditors(wp,settings){
  return {
    title:`<span class="wp-indent">↳ <strong>${esc(wp.id)}</strong></span><input class="list-cell-input wp-title-input" data-inline-entity="workPackage" data-field="title" value="${esc(wp.title||'')}" aria-label="${esc(wp.id)} title">`,
    service:`<select class="list-cell-input" data-inline-entity="workPackage" data-field="service" aria-label="${esc(wp.id)} service">${option('','Choose…',wp.service||wp.architectureService)}${(settings.services||[]).map(x=>option(x,x,wp.service||wp.architectureService)).join('')}</select>`,
    workItem:`<input class="list-cell-input" data-inline-entity="workPackage" data-field="azureDevOpsWorkItemId" inputmode="numeric" value="${esc(wp.azureDevOpsWorkItemId||'')}" aria-label="${esc(wp.id)} Azure DevOps work item reference">`,
    status:`<select class="list-cell-input" data-inline-entity="workPackage" data-field="status" aria-label="${esc(wp.id)} state">${(settings.workPackageStatuses||[]).map(x=>option(x,x,wp.status)).join('')}</select>`,
    dates:`<div class="wp-date-editors"><input class="list-cell-input" data-inline-entity="workPackage" data-field="targetStart" type="date" value="${esc(wp.targetStart||'')}" aria-label="${esc(wp.id)} target start"><span>→</span><input class="list-cell-input" data-inline-entity="workPackage" data-field="targetEnd" type="date" value="${esc(wp.targetEnd||'')}" aria-label="${esc(wp.id)} target end"></div>`
  };
}

export function renderDemandTable(host,{demands,queryService,settings,people=[],expanded,onToggle,onEdit,onEditWorkPackage,editMode=false,demandDraftFor=d=>d,workPackageDraftFor=w=>w,onInlineChange}){
  host.innerHTML=`<thead><tr><th></th><th>Demand</th><th>Business Area</th><th>Initiative</th><th>Project Number</th><th>State</th><th>Owner</th><th>Control Position</th><th></th></tr></thead><tbody></tbody>`;
  const body=host.tBodies[0];
  for(const sourceDemand of demands){
    const demand=editMode?demandDraftFor(sourceDemand):sourceDemand,workPackages=queryService.workPackagesFor(sourceDemand.id),isExpanded=expanded.has(sourceDemand.id),editors=editMode?demandCellEditors(demand,settings,people):null;
    const row=document.createElement('tr');row.dataset.demandId=sourceDemand.id;row.className='demand-row';
    row.innerHTML=`<td><button type="button" class="tree-toggle" aria-expanded="${isExpanded}" ${workPackages.length?'':'disabled'}>${workPackages.length?(isExpanded?'−':'+'):'·'}</button></td><td>${editMode?editors.title:`<strong>${esc(demand.id)}</strong><span class="row-title">${esc(demand.title)}</span>`}</td><td>${editMode?editors.businessArea:esc(demand.businessArea||'—')}</td><td>${editMode?editors.initiative:esc(demand.initiative||'—')}</td><td>${editMode?editors.projectNumber:esc(demand.projectNumber||'—')}</td><td>${editMode?editors.status:esc(demand.status||'—')}</td><td>${editMode?editors.owner:esc(queryService.ownerName(demand.ownerId))}</td><td>${controlBadges(queryService.controlPosition(sourceDemand))}</td><td><button type="button" class="btn compact" data-edit>View / edit</button></td>`;
    row.querySelector('.tree-toggle')?.addEventListener('click',()=>onToggle(sourceDemand.id));row.querySelector('[data-edit]')?.addEventListener('click',()=>onEdit(sourceDemand));
    row.addEventListener('dblclick',event=>{if(!interactiveTarget(event.target))onEdit(sourceDemand)});
    row.querySelectorAll('[data-inline-entity="demand"]').forEach(control=>control.addEventListener('change',()=>onInlineChange?.('demand',sourceDemand.id,control.dataset.field,control.value)));
    body.appendChild(row);
    if(isExpanded){
      for(const sourceWp of workPackages){
        const wp=editMode?workPackageDraftFor(sourceWp):sourceWp,wpEditors=editMode?workPackageEditors(wp,settings):null,child=document.createElement('tr');child.className='work-package-row';child.dataset.workPackageId=sourceWp.id;
        child.innerHTML=`<td></td><td colspan="2">${editMode?wpEditors.title:`<span class="wp-indent">↳ <strong>${esc(wp.id)}</strong> ${esc(wp.title||'Untitled Work Package')}</span>`}</td><td>${editMode?wpEditors.service:esc(wp.service||wp.architectureService||'—')}</td><td>${editMode?wpEditors.workItem:workItem(sourceDemand,wp,settings)}</td><td>${editMode?wpEditors.status:esc(wp.status||'—')}</td><td colspan="2">${editMode?wpEditors.dates:(wp.targetStart||wp.targetEnd?`${esc(wp.targetStart||'—')} → ${esc(wp.targetEnd||'—')}`:'')}</td><td><button type="button" class="btn compact" data-edit-work-package>View / edit</button></td>`;
        child.querySelector('[data-edit-work-package]')?.addEventListener('click',()=>onEditWorkPackage?.(sourceWp,sourceDemand));child.addEventListener('dblclick',event=>{if(!interactiveTarget(event.target))onEditWorkPackage?.(sourceWp,sourceDemand)});
        child.querySelectorAll('[data-inline-entity="workPackage"]').forEach(control=>control.addEventListener('change',()=>onInlineChange?.('workPackage',sourceWp.id,control.dataset.field,control.value)));
        body.appendChild(child)
      }
    }
  }
  if(!demands.length){const empty=document.createElement('tr');empty.innerHTML='<td colspan="9" class="empty-state">No Demand matches the current filters.</td>';body.appendChild(empty)}
}
