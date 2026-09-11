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
    return {
      workspace:bundle.workspace||{},
      settings:bundle.settings||bundle.configFiles?.['settings.json']||{},
      demands:bundle.demand||[],
      people:bundle.team||[],
      allocations:bundle.allocations||[],
      workPackages
    };
  }
  async saveDemand(record){return this.repository.saveRecord('demand',record)}
}

export function configuredLegacyRemoteGateway(){
  if(typeof window.RemoteWorkspaceRepository!=='function')throw new Error('Legacy RemoteWorkspaceRepository is not available at the migration boundary.');
  const baseUrl=window.AMO_CONFIG?.defaultRemoteUrl;
  if(!baseUrl)throw new Error('No Remote Workspace API is configured for this AMO deployment.');
  return new LegacyWorkspaceRepositoryAdapter(new window.RemoteWorkspaceRepository(baseUrl));
}
