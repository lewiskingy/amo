import {renderSidebar,renderPageHeader,renderWorkspaceStatus,AccountWidget} from '../client/shell/app-shell.js';
import {WorkspaceSession} from '../client/workspace/workspace-session.js';
import {WorkspaceSwitcher} from '../client/workspace/workspace-switcher.js';
import {DemandPage} from '../client/pages/demand/demand-page.js';

const $=selector=>document.querySelector(selector),e2e=new URLSearchParams(location.search).get('e2e')==='1';let loading=false,page=null,session=null,switcher=null;
renderSidebar($('#appSidebar'),{activeRoute:'/demand'});
const actions=renderPageHeader($('#pageHeader'),{title:'Demand Register',subtitle:e2e?'Deterministic local E2E workspace.':'Dark-launched target client slice over the same AMO workspace.',actions:[{id:'new',label:'New Demand',tone:'primary'},{id:'expand',label:'Expand all'},{id:'collapse',label:'Collapse all'},{id:'refresh',label:'Refresh'},{id:'legacy',label:'Open legacy AMO'}]});
actions.new.addEventListener('click',()=>page?.create());actions.legacy.addEventListener('click',()=>{location.href='/'});actions.expand.addEventListener('click',()=>page?.expandAll());actions.collapse.addEventListener('click',()=>page?.collapseAll());actions.refresh.addEventListener('click',()=>refresh());
const statusHost=$('#workspaceStatus');const account=e2e?null:new AccountWidget($('#amoShellAccount'),window.amoAuth||null);account?.start();if(e2e)$('#amoShellAccount').innerHTML='<span class="muted">E2E test workspace</span>';

function showError(error){console.error('Demand target slice could not load.',error);renderWorkspaceStatus(statusHost,{state:'error',message:'Demand could not load',detail:error.message||String(error)});$('#demandAppState').hidden=false;$('#demandAppState').innerHTML=`<strong>Demand is unavailable.</strong><span>${String(error.message||error)}</span>`}
function showAwaitingWorkspace(result){page=null;$('#demandAppState').hidden=false;$('#demandAppState').innerHTML='<strong>Choose a workspace to continue.</strong><span>The target client can use the same remembered Local Workspace or the configured Remote Workspace.</span>';renderWorkspaceStatus(statusHost,{state:'loading',message:result?.message||'Workspace selection required',detail:result?.rememberedName||''})}
async function loadGateway(gateway,{mode='remote',name=''}={}){
  if(!gateway||loading)return;loading=true;page=null;renderWorkspaceStatus(statusHost,{state:'loading',message:'Loading workspace…',detail:name});$('#demandAppState').hidden=false;$('#demandAppState').textContent='Loading Demand…';
  try{const slice=await gateway.loadDemandSlice(),settings=slice.settings||{};page=new DemandPage({gateway,settings,workspace:slice.workspace,data:slice,elements:{scope:$('#scopeSelector'),filters:$('#demandFilters'),chips:$('#demandFilterChips'),count:$('#demandCount'),table:$('#demandTable'),dialog:$('#demandEditor')},onStatus:value=>renderWorkspaceStatus(statusHost,value)});page.start();$('#demandAppState').hidden=true;renderWorkspaceStatus(statusHost,{state:'ready',message:`${mode==='local'?'Local':'Remote'} Workspace connected`,detail:slice.workspace?.name||name||gateway.repository?.name||''});}
  catch(error){showError(error)}finally{loading=false}
}
async function restoreWorkspace(){
  if(e2e){const {LocalTestWorkspaceGateway}=await import('../client/testing/local-test-workspace-gateway.js'),gateway=new LocalTestWorkspaceGateway();await gateway.connect();return loadGateway(gateway,{mode:'local',name:'Transient E2E Workspace'})}
  if(loading)return;
  try{const result=await session.restore();switcher.setResult(result);if(result.gateway)await loadGateway(result.gateway,result);else showAwaitingWorkspace(result)}catch(error){showError(error)}
}
async function refresh(){
  if(e2e)return restoreWorkspace();
  try{const result=await session.refresh();switcher.setResult(result);if(result.gateway)await loadGateway(result.gateway,result);else showAwaitingWorkspace(result)}catch(error){showError(error)}
}

if(!e2e){
  session=new WorkspaceSession();
  switcher=new WorkspaceSwitcher($('#workspaceSwitcher'),{session,onChange:result=>loadGateway(result.gateway,result),onError:showError});switcher.render();
  window.addEventListener('amo-auth-changed',()=>{if(!loading&&session.current?.mode==='remote')restoreWorkspace()});
}else $('#workspaceSwitcher').hidden=true;
restoreWorkspace();
