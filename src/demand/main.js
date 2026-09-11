import {configuredLegacyRemoteGateway} from '../client/legacy/legacy-workspace-adapter.js';
import {renderSidebar,renderPageHeader,renderWorkspaceStatus,AccountWidget} from '../client/shell/app-shell.js';
import {DemandPage} from '../client/pages/demand/demand-page.js';

const $=selector=>document.querySelector(selector),e2e=new URLSearchParams(location.search).get('e2e')==='1';let loading=false,page=null;
async function configuredGateway(){if(!e2e)return configuredLegacyRemoteGateway();const {LocalTestWorkspaceGateway}=await import('../client/testing/local-test-workspace-gateway.js');return new LocalTestWorkspaceGateway()}
renderSidebar($('#appSidebar'),{activeRoute:'/demand'});
const actions=renderPageHeader($('#pageHeader'),{title:'Demand Register',subtitle:e2e?'Deterministic local E2E workspace.':'Dark-launched target client slice over the same AMO workspace.',actions:[{id:'new',label:'New Demand',tone:'primary'},{id:'expand',label:'Expand all'},{id:'collapse',label:'Collapse all'},{id:'refresh',label:'Refresh'},{id:'legacy',label:'Open legacy AMO'}]});
actions.new.addEventListener('click',()=>page?.create());actions.legacy.addEventListener('click',()=>{location.href='/'});actions.expand.addEventListener('click',()=>page?.expandAll());actions.collapse.addEventListener('click',()=>page?.collapseAll());actions.refresh.addEventListener('click',()=>load());
const statusHost=$('#workspaceStatus');const account=e2e?null:new AccountWidget($('#amoShellAccount'),window.amoAuth||null);account?.start();if(e2e)$('#amoShellAccount').innerHTML='<span class="muted">E2E test workspace</span>';
async function load(){
  if(loading)return;loading=true;page=null;renderWorkspaceStatus(statusHost,{state:'loading',message:'Connecting to workspace…'});$('#demandAppState').hidden=false;$('#demandAppState').textContent='Loading Demand…';
  try{const gateway=await configuredGateway();await gateway.connect();const slice=await gateway.loadDemandSlice(),settings=slice.settings||{};page=new DemandPage({gateway,settings,workspace:slice.workspace,data:slice,elements:{scope:$('#scopeSelector'),filters:$('#demandFilters'),chips:$('#demandFilterChips'),count:$('#demandCount'),table:$('#demandTable'),dialog:$('#demandEditor')},onStatus:value=>renderWorkspaceStatus(statusHost,value)});page.start();$('#demandAppState').hidden=true;renderWorkspaceStatus(statusHost,{state:'ready',message:e2e?'Transient E2E Workspace connected':'Remote Workspace connected',detail:slice.workspace?.name||gateway.repository?.name||''});}
  catch(error){console.error('Demand target slice could not load.',error);renderWorkspaceStatus(statusHost,{state:'error',message:'Demand could not load',detail:error.message||String(error)});$('#demandAppState').hidden=false;$('#demandAppState').innerHTML=`<strong>Demand is unavailable.</strong><span>${String(error.message||error)}</span>`;}finally{loading=false}
}
if(!e2e)window.addEventListener('amo-auth-changed',()=>{if(!loading)load()});load();
