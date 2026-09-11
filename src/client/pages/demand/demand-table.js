const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function azdoContext(demand,settings){
  const team=(settings.teams||[]).find(t=>t.id===demand.owningTeamId)||{};
  const department=(settings.departments||[]).find(d=>d.id===team.departmentId)||{};
  const organization=team.azureDevOps?.organization||team.azureDevOpsOrganization||department.azureDevOps?.organization||department.azureDevOpsOrganization||settings.azureDevOps?.defaultOrganization||settings.defaultOrganization||'';
  const project=team.azureDevOps?.project||team.azureDevOpsProject||department.azureDevOps?.project||department.azureDevOpsProject||'';
  return{organization,project};
}
function workItem(demand,wp,settings){
  const id=String(wp.azureDevOpsWorkItemId||'').trim();if(!id)return'<span class="control-badge danger">Work Item missing</span>';
  const {organization,project}=azdoContext(demand,settings);
  if(!organization||!project)return`<span class="work-item-id">#${esc(id)}</span>`;
  const href=`https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${encodeURIComponent(id)}`;
  return`<a href="${href}" target="_blank" rel="noopener">#${esc(id)}</a>`;
}
function controlBadges(control){
  const badges=[];
  if(control.fundingMissing)badges.push('<span class="control-badge danger">Funding missing</span>');
  if(control.resourceMissing)badges.push('<span class="control-badge danger">Resource missing</span>');
  if(control.workItemMissing)badges.push('<span class="control-badge danger">Work Item missing</span>');
  if(!badges.length)badges.push('<span class="control-badge neutral">No exception</span>');
  return badges.join(' ');
}

export function renderDemandTable(host,{demands,queryService,settings,expanded,onToggle,onEdit}){
  host.innerHTML=`<thead><tr><th></th><th>Demand</th><th>Business Area</th><th>Initiative</th><th>Project Number</th><th>State</th><th>Owner</th><th>Control Position</th><th></th></tr></thead><tbody></tbody>`;
  const body=host.tBodies[0];
  for(const demand of demands){
    const workPackages=queryService.workPackagesFor(demand.id);
    const isExpanded=expanded.has(demand.id);
    const row=document.createElement('tr');row.dataset.demandId=demand.id;row.className='demand-row';
    row.innerHTML=`<td><button type="button" class="tree-toggle" aria-expanded="${isExpanded}" ${workPackages.length?'':'disabled'}>${workPackages.length?(isExpanded?'−':'+'):'·'}</button></td><td><strong>${esc(demand.id)}</strong><span class="row-title">${esc(demand.title)}</span></td><td>${esc(demand.businessArea||'—')}</td><td>${esc(demand.initiative||'—')}</td><td>${esc(demand.projectNumber||'—')}</td><td>${esc(demand.status||'—')}</td><td>${esc(queryService.ownerName(demand.ownerId))}</td><td>${controlBadges(queryService.controlPosition(demand))}</td><td><button type="button" class="btn compact" data-edit>View / edit</button></td>`;
    row.querySelector('.tree-toggle')?.addEventListener('click',()=>onToggle(demand.id));
    row.querySelector('[data-edit]')?.addEventListener('click',()=>onEdit(demand));
    body.appendChild(row);
    if(isExpanded){
      for(const wp of workPackages){const child=document.createElement('tr');child.className='work-package-row';child.dataset.workPackageId=wp.id;child.innerHTML=`<td></td><td colspan="2"><span class="wp-indent">↳ <strong>${esc(wp.id)}</strong> ${esc(wp.title||'Untitled Work Package')}</span></td><td>${esc(wp.architectureService||wp.service||'—')}</td><td>${workItem(demand,wp,settings)}</td><td>${esc(wp.status||'—')}</td><td colspan="3">${wp.targetStart||wp.targetEnd?`${esc(wp.targetStart||'—')} → ${esc(wp.targetEnd||'—')}`:''}</td>`;body.appendChild(child)}
    }
  }
  if(!demands.length){const empty=document.createElement('tr');empty.innerHTML='<td colspan="9" class="empty-state">No Demand matches the current filters.</td>';body.appendChild(empty)}
}
