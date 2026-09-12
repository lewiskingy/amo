const COMMITTED_STATES=new Set(['Planned','In Progress']);
const TRACKED_WP_STATES=new Set(['Ready','In Progress','Blocked']);
const clean=value=>String(value??'').trim();
const positive=value=>Number(value)>0;

function monthKey(value){const match=clean(value).match(/^(\d{4})-(\d{2})/);return match?`${match[1]}-${match[2]}`:''}
function allocationHasCommitment(allocation){return !!clean(allocation?.teamMemberId)&&Object.values(allocation?.forecast||allocation?.months||{}).some(positive)}
function allocationInMonth(allocation,month){const key=monthKey(month),start=key?`${key}-01`:'';return positive(allocation?.forecast?.[start]??allocation?.forecast?.[key]??allocation?.months?.[start]??allocation?.months?.[key]??0)}
function workItemRequired(workPackage,today){const status=clean(workPackage?.status);if(TRACKED_WP_STATES.has(status))return true;return status==='Planned'&&!!clean(workPackage?.targetStart)&&clean(workPackage.targetStart)<=today}

export class DemandControlService{
  constructor({allocations=[],workPackages=[],actuals=null,today=()=>new Date().toISOString().slice(0,10)}={}){
    this.allocations=allocations;this.workPackages=workPackages;this.actuals=actuals;this.today=today;
  }
  allocationsFor(demandId){return this.allocations.filter(a=>a.demandId===demandId&&allocationHasCommitment(a))}
  workPackagesFor(demandId){return this.workPackages.filter(w=>w.demandId===demandId)}
  latestActualMonth(){return monthKey(this.actuals?.month)}
  actualFacts(){return Array.isArray(this.actuals?.facts)?this.actuals.facts:[]}
  missingActualAllocations(demandId){
    const month=this.latestActualMonth();if(!month)return[];
    return this.allocationsFor(demandId).filter(allocation=>{
      if(!allocationInMonth(allocation,month))return false;
      const hours=this.actualFacts().filter(f=>clean(f.teamMemberId)===clean(allocation.teamMemberId)&&clean(f.demandId)===clean(demandId)).reduce((sum,f)=>sum+(Number(f.actualHours)||0),0);
      return hours<=0;
    });
  }
  controlPosition(demand){
    const committed=COMMITTED_STATES.has(clean(demand?.status));
    const allocations=this.allocationsFor(demand?.id);
    const workPackages=this.workPackagesFor(demand?.id);
    const missingWorkItems=workPackages.filter(w=>workItemRequired(w,this.today())&&!clean(w.azureDevOpsWorkItemId));
    const missingActuals=this.missingActualAllocations(demand?.id);
    const actualMonth=this.latestActualMonth();
    const periodDue=!!actualMonth&&allocations.some(a=>allocationInMonth(a,actualMonth));
    return {
      committed,
      fundingMissing:committed&&allocations.length>0&&!clean(demand?.projectNumber),
      resourceMissing:committed&&allocations.length===0,
      workItemMissing:missingWorkItems.length>0,
      actualsMissing:missingActuals.length>0,
      missingWorkItems,
      missingActuals,
      actualMonth,
      actualStatus:!periodDue?'not-due':missingActuals.length?'partial':'received'
    };
  }
  matches(demand,control){const position=this.controlPosition(demand);if(!control)return true;if(control==='funding-missing')return position.fundingMissing;if(control==='resource-missing')return position.resourceMissing;if(control==='work-item-missing')return position.workItemMissing;if(control==='actuals-missing')return position.actualsMissing;return true}
}

export const DemandControlRules={COMMITTED_STATES,TRACKED_WP_STATES,allocationHasCommitment,allocationInMonth,workItemRequired};
