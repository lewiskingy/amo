const clean=value=>String(value??'').trim();
const numberOrNull=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);

export function prepareWorkPackageForSave(record,{settings={},now=()=>new Date().toISOString()}={}){
  const next={...record};
  next.id=clean(next.id);next.demandId=clean(next.demandId);next.title=clean(next.title);next.service=clean(next.service||next.architectureService);next.status=clean(next.status);next.targetStart=clean(next.targetStart);next.targetEnd=clean(next.targetEnd);next.azureDevOpsWorkItemId=clean(next.azureDevOpsWorkItemId);next.estimatedEffortDays=numberOrNull(next.estimatedEffortDays??next.romDays);
  if(Object.prototype.hasOwnProperty.call(next,'architectureService'))delete next.architectureService;
  if(Object.prototype.hasOwnProperty.call(next,'romDays'))delete next.romDays;
  if(!next.id)throw new Error('Work Package ID is required.');
  if(!next.demandId)throw new Error('Demand is required.');
  if(!next.title)throw new Error('Work Package title is required.');
  const services=settings.services||[];if(services.length&&!next.service)throw new Error('Work Package Service is required.');if(next.service&&services.length&&!services.includes(next.service))throw new Error(`Work Package Service ${next.service} is not configured.`);
  const statuses=settings.workPackageStatuses||[];if(statuses.length&&!statuses.includes(next.status))throw new Error(`Work Package Status ${next.status} is not configured.`);
  if(next.estimatedEffortDays!=null&&(!Number.isFinite(next.estimatedEffortDays)||next.estimatedEffortDays<0))throw new Error('Estimated Effort must be zero or greater.');
  if(next.targetStart&&next.targetEnd&&next.targetStart>next.targetEnd)throw new Error('Target Start cannot be after Target End.');
  if(next.azureDevOpsWorkItemId&&!/^\d+$/.test(next.azureDevOpsWorkItemId))throw new Error('Azure DevOps Work Item Reference must be a numeric work item ID.');
  next.version=(Number(record.version)||0)+1;next.modifiedAt=now();
  return next;
}
