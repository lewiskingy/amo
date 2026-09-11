export class WorkspaceGateway{
  async connect(){throw new Error('connect() not implemented')}
  async loadDemandSlice(){throw new Error('loadDemandSlice() not implemented')}
  async saveDemand(){throw new Error('saveDemand() not implemented')}
}

export function assertWorkspaceGateway(candidate){
  for(const method of ['connect','loadDemandSlice','saveDemand'])if(typeof candidate?.[method]!=='function')throw new Error(`Workspace gateway must implement ${method}().`);
  return candidate;
}
