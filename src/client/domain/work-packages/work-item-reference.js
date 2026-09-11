const clean=value=>String(value??'').trim();

function demandTeamId(demand={}){
  return clean(demand.teamId)||clean(demand.owningTeamId);
}

export function resolveAzureDevOpsContext(demand={},settings={}){
  const teams=settings.teams||[];
  const departments=settings.departments||[];
  const team=teams.find(candidate=>clean(candidate.id)===demandTeamId(demand))||null;
  const departmentId=clean(team?.departmentId)||clean(demand.departmentId);
  const department=departments.find(candidate=>clean(candidate.id)===departmentId)||null;
  const system=settings.azureDevOps||{};
  const teamConfig=team?.azureDevOps||{};
  const departmentConfig=department?.azureDevOps||{};
  const organization=clean(teamConfig.organization)||clean(team?.azureDevOpsOrganization)||clean(departmentConfig.organization)||clean(department?.azureDevOpsOrganization)||clean(system.defaultOrganization)||clean(settings.defaultOrganization);
  const project=clean(teamConfig.project)||clean(team?.azureDevOpsProject)||clean(departmentConfig.project)||clean(department?.azureDevOpsProject);
  return {
    organization,
    project,
    team,
    department,
    organizationSource:clean(teamConfig.organization)||clean(team?.azureDevOpsOrganization)?'Team':clean(departmentConfig.organization)||clean(department?.azureDevOpsOrganization)?'Department':clean(system.defaultOrganization)||clean(settings.defaultOrganization)?'System':'Not configured',
    projectSource:clean(teamConfig.project)||clean(team?.azureDevOpsProject)?'Team':clean(departmentConfig.project)||clean(department?.azureDevOpsProject)?'Department':'Not configured'
  };
}

export function buildWorkItemReference(workPackage={},demand={},settings={}){
  const id=clean(workPackage.azureDevOpsWorkItemId);
  const context=resolveAzureDevOpsContext(demand,settings);
  const configured=!!(context.organization&&context.project);
  const url=id&&configured?`https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}/_workitems/edit/${encodeURIComponent(id)}`:'';
  return {id,url,configured,context};
}

export function workItemUrl(workPackage,demand,settings){
  return buildWorkItemReference(workPackage,demand,settings).url;
}
