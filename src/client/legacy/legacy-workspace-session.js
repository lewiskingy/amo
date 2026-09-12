import {WorkspaceSession} from '../workspace/workspace-session.js';
import {legacyLocalGateway,configuredLegacyRemoteGateway} from './legacy-workspace-adapter.js';

/* Transitional composition root. It wires the canonical WorkspaceSession to the existing
   Local/Remote repository implementations without leaking those globals into canonical modules. */
export function configuredLegacyWorkspaceSession(options={}){
  return new WorkspaceSession({
    createLocalGateway:handle=>legacyLocalGateway(handle),
    createRemoteGateway:url=>configuredLegacyRemoteGateway(url),
    defaultRemoteUrl:()=>window.AMO_CONFIG?.defaultRemoteUrl||'',
    ...options
  });
}
