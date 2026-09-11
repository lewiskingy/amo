import {demandInScope} from './demand-scope.js';
import {DemandControlService,DemandControlRules} from './demand-control-service.js';

const OPEN_STATES=new Set(['Assessing','Defined','Planned','In Progress','On Hold']);
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();

export class DemandQueryService{
  constructor({demands=[],workPackages=[],allocations=[],people=[],actuals=null,today=()=>new Date().toISOString().slice(0,10)}={}){
    this.demands=demands;this.workPackages=workPackages;this.allocations=allocations;this.people=people;this.today=today;
    this.controls=new DemandControlService({allocations,workPackages,actuals,today});
  }
  workPackagesFor(id){return this.controls.workPackagesFor(id)}
  allocationsFor(id){return this.controls.allocationsFor(id)}
  ownerName(id){return this.people.find(p=>p.id===id)?.name||id||'Unallocated'}
  controlPosition(demand){return this.controls.controlPosition(demand)}
  matchesControl(demand,control){return this.controls.matches(demand,control)}
  query(filters={},scope={mode:'all'}){
    return this.demands.filter(d=>{
      if(!demandInScope(d,scope))return false;
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
export const DemandLifecycle={OPEN_STATES,COMMITTED_STATES:DemandControlRules.COMMITTED_STATES,TRACKED_WP_STATES:DemandControlRules.TRACKED_WP_STATES};
