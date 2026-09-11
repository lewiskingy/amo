import {WorkspaceGateway} from '../data/workspace-gateway.js';

/* Test-only gateway for deterministic browser E2E. It is selected only by the explicit ?e2e=1 bootstrap
   in /demand/main.js. Production workspace selection must never fall back to this implementation. */
const KEY='amo.e2e.demand.workspace';
const seed=()=>({
  workspace:{name:'Transient E2E Workspace'},
  settings:{businessAreas:['Customer','Operations'],initiatives:[{name:'Modernise',businessArea:'Customer'}],statuses:['Assessing','Planned','In Progress','Complete'],priorities:['Low','Medium','High'],healthStates:['On Track','At Risk'],teams:[{id:'TEAM-A',name:'Architecture',departmentId:'DEP-A',azureDevOps:{organization:'amo-test',project:'Architecture'}}],departments:[{id:'DEP-A',name:'Technology'}]},
  demands:[{id:'DEM-2026-0001',title:'Seeded customer change',businessArea:'Customer',initiative:'Modernise',ownerId:'P-1',projectNumber:'12345',status:'In Progress',owningTeamId:'TEAM-A',version:1},{id:'DEM-2026-0002',title:'Seeded unfunded change',businessArea:'Operations',initiative:'',ownerId:'P-2',projectNumber:'',status:'Planned',owningTeamId:'TEAM-A',version:1},{id:'DEM-2026-0003',title:'Completed change',businessArea:'Operations',initiative:'',ownerId:'P-2',projectNumber:'777',status:'Complete',owningTeamId:'TEAM-A',version:1}],
  people:[{id:'P-1',name:'Alex Architect'},{id:'P-2',name:'Sam Strategist'}],
  allocations:[{id:'A-1',demandId:'DEM-2026-0001',teamMemberId:'P-1',forecast:{'2026-09':0.5}},{id:'A-2',demandId:'DEM-2026-0002',teamMemberId:'P-2',forecast:{'2026-09':0.3}}],
  workPackages:[{id:'WP-1',demandId:'DEM-2026-0001',title:'Tracked package',status:'In Progress',azureDevOpsWorkItemId:'9001'},{id:'WP-2',demandId:'DEM-2026-0002',title:'Needs tracking',status:'Ready',azureDevOpsWorkItemId:''}]
});
export class LocalTestWorkspaceGateway extends WorkspaceGateway{
  async connect(){if(!sessionStorage.getItem(KEY))sessionStorage.setItem(KEY,JSON.stringify(seed()));return true}
  state(){return JSON.parse(sessionStorage.getItem(KEY)||JSON.stringify(seed()))}
  async loadDemandSlice(){return structuredClone(this.state())}
  async saveDemand(record){const state=this.state(),index=state.demands.findIndex(d=>d.id===record.id);if(index>=0)state.demands.splice(index,1,structuredClone(record));else state.demands.push(structuredClone(record));sessionStorage.setItem(KEY,JSON.stringify(state));return record}
}
