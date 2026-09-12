import {WorkspaceGateway} from '../data/workspace-gateway.js';

/* Transitional anti-corruption adapter.
   The canonical route client depends on WorkspaceGateway, not on window globals. This adapter is
   the only place the new client may touch the legacy WorkspaceRepository implementations while
   Local/Remote persistence is extracted into strategic modules. Remove it when that extraction is complete. */
export class LegacyWorkspaceRepositoryAdapter extends WorkspaceGateway{
  constructor(repository){super();this.repository=repository}
  async connect(){return this.repository.connect()}
  async loadDemandSlice(){
    const bundle=await this.repository.loadWorkspace();
    const workPackages=await this.repository.listRecords('workPackages').catch(()=>[]);
    const actuals=await (async()=>{
      if(typeof this.repository.listActualsPeriods!=='function'||typeof this.repository.readActualsPeriod!=='function')return null;
      const periods=await this.repository.listActualsPeriods().catch(()=>[]),month=[...periods].sort().at(-1);
      if(!month)return null;
      const period=await this.repository.readActualsPeriod(month).catch(()=>null);
      return period?{month,facts:Array.isArray(period.facts)?period.facts:[]}:null;
    })();
    return {
      workspace:bundle.workspace||{},
      settings:bundle.settings||bundle.configFiles?.['settings.json']||{},
      demands:bundle.demand||[],
      people:bundle.team||[],
      allocations:bundle.allocations||[],
      workPackages,
      actuals
    };
  }
  async saveDemand(record){
    if(typeof this.repository.ensureWritePermission==='function'&&this.repository.mode==='local'&&!await this.repository.ensureWritePermission())throw new Error('Read/write permission is required for this Local Workspace.');
    return this.repository.saveRecord('demand',record)
  }
}

export function legacyLocalGateway(handle){
  if(typeof window.LocalWorkspaceRepository!=='function')throw new Error('Legacy LocalWorkspaceRepository is not available at the migration boundary.');
  if(!handle)throw new Error('A Local Workspace folder is required.');
  return new LegacyWorkspaceRepositoryAdapter(new window.LocalWorkspaceRepository(handle));
}

export function configuredLegacyRemoteGateway(baseUrl=window.AMO_CONFIG?.defaultRemoteUrl){
  if(typeof window.RemoteWorkspaceRepository!=='function')throw new Error('Legacy RemoteWorkspaceRepository is not available at the migration boundary.');
  if(!baseUrl)throw new Error('No Remote Workspace API is configured for this AMO deployment.');
  return new LegacyWorkspaceRepositoryAdapter(new window.RemoteWorkspaceRepository(String(baseUrl).replace(/\/+$/,'')));
}
