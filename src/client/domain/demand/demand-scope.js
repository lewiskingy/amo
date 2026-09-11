const clean=value=>String(value??'').trim();

export function demandTeamId(demand={}){
  return clean(demand.teamId)||clean(demand.owningTeamId);
}

export function demandInScope(demand,scope={mode:'all'}){
  if(!scope||scope.mode==='all')return true;
  const teamId=demandTeamId(demand);
  if(scope.mode==='team')return teamId===clean(scope.teamId);
  if(scope.mode==='department')return (scope.teamIds||[]).map(clean).includes(teamId);
  return true;
}
