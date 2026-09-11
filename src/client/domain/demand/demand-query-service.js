const OPEN_STATES=new Set(['Assessing','Defined','Planned','In Progress','On Hold']);
const COMMITTED_STATES=new Set(['Planned','In Progress']);
const TRACKED_WP_STATES=new Set(['Ready','In Progress','Blocked']);
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();

function inScope(demand,scope){
  if(!scope||scope.mode==='all')return true;
  if(scope.mode==='team')return clean(demand.owningTeamId)===clean(scope.teamId);
  if(scope.mode==='department')return (scope.teamIds||[]).map(clean).includes(clean(demand.owningTeamId));
  return true;
}
function workItemRequired(wp,today){
  if(TRACKED_WP_STATES.has(clean(wp.status)))return true;
  if(clean(wp.status)!=='Planned'||!wp.targetStart)return false;
  return clean(wp.targetStart)<=today;
}
export class DemandQueryService{
  constructor({demands=[],workPackages=[],allocations=[],people=[],today=()=>new Date().toISOString().slice(0,10)}={}){
    this.demands=demands;this.workPackages=workPackages;this.allocations=allocations;this.people=people;this.today=today;
  }
  workPackagesFor(id){return this.workPackages.filter(w=>w.demandId===id)}
  allocationsFor(id){return this.allocations.filter(a=>a.demandId===id&&a.teamMemberId&&Object.values(a.forecast||a.months||{}).some(v=>Number(v)>0))}
  ownerName(id){return this.people.find(p=>p.id===id)?.name||id||'Unallocated'}
  controlPosition(demand){
    const committed=COMMITTED_STATES.has(clean(demand.status));
    const allocations=this.allocationsFor(demand.id);
    const wps=this.workPackagesFor(demand.id);
    const missingWorkItem=wps.some(w=>workItemRequired(w,this.today())&&!clean(w.azureDevOpsWorkItemId));
    return {
      fundingMissing:committed&&allocations.length>0&&!clean(demand.projectNumber),
      resourceMissing:committed&&allocations.length===0,
      workItemMissing:missingWorkItem
    };
  }
  matchesControl(demand,control){const c=this.controlPosition(demand);return control==='funding-missing'?c.fundingMissing:control==='resource-missing'?c.resourceMissing:control==='work-item-missing'?c.workItemMissing:true}
  query(filters={},scope={mode:'all'}){
    return this.demands.filter(d=>{
      if(!inScope(d,scope))return false;
      if(filters.show==='active'&&!OPEN_STATES.has(clean(d.status)))return false;
      if(filters.businessArea&&clean(d.businessArea)!==filters.businessArea)return false;
      if(filters.initiative&&clean(d.initiative)!==filters.initiative)return false;
      if(filters.ownerId&&clean(d.ownerId)!==filters.ownerId)return false;
      if(filters.projectNumber==='present'&&!clean(d.projectNumber))return false;
      if(filters.projectNumber==='missing'&&clean(d.projectNumber))return false;
      if(filters.control&&!this.matchesControl(d,filters.control))return false;
      if(filters.search){const hay=lower(`${d.id} ${d.title} ${d.projectNumber} ${d.businessArea} ${d.initiative} ${this.ownerName(d.ownerId)}`);if(!hay.includes(lower(filters.search)))return false}
      return true;
    });
  }
}
export const DemandLifecycle={OPEN_STATES,COMMITTED_STATES,TRACKED_WP_STATES};
