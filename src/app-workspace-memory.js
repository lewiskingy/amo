/* Remember the last selected File System Access workspace in IndexedDB. */
const WORKSPACE_DB_NAME='amo-browser-state';
const WORKSPACE_DB_VERSION=1;
const WORKSPACE_STORE='handles';
const DEFAULT_WORKSPACE_KEY='defaultWorkspace';
let rememberedWorkspaceHandle=null;
let workspaceReconnectRunning=false;
let workspaceLoading=false;

function setWorkspaceLoading(active,label='Loading workspace…'){
  workspaceLoading=!!active;
  const state=document.getElementById('workspaceState'),dot=document.getElementById('stateDot'),btn=document.getElementById('openWorkspaceBtn'),summary=document.getElementById('recordSummary');
  if(active){
    if(state)state.innerHTML=`<span class="workspace-spinner" aria-hidden="true"></span><span>${escHtml(label)}</span>`;
    if(dot)dot.className='state-dot loading';
    if(btn){btn.disabled=true;btn.textContent='Loading…'}
    if(summary)summary.textContent='Reading workspace data…';
  }else{
    if(btn)btn.disabled=false;
    updateBanner();
  }
}
function openWorkspaceHandleDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('IndexedDB is not available in this browser.'));return}
    const req=indexedDB.open(WORKSPACE_DB_NAME,WORKSPACE_DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(WORKSPACE_STORE))db.createObjectStore(WORKSPACE_STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open browser workspace storage.'));
  })
}
async function workspaceHandleGet(){
  const idb=await openWorkspaceHandleDb();
  try{return await new Promise((resolve,reject)=>{const tx=idb.transaction(WORKSPACE_STORE,'readonly'),req=tx.objectStore(WORKSPACE_STORE).get(DEFAULT_WORKSPACE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}finally{idb.close()}
}
async function workspaceHandlePut(handle){
  if(!handle)return;
  const idb=await openWorkspaceHandleDb();
  try{await new Promise((resolve,reject)=>{const tx=idb.transaction(WORKSPACE_STORE,'readwrite');tx.objectStore(WORKSPACE_STORE).put(handle,DEFAULT_WORKSPACE_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Workspace handle storage was aborted.'))})}finally{idb.close()}
  rememberedWorkspaceHandle=handle;renderRememberedWorkspace();
}
async function workspaceHandleForget(){
  const idb=await openWorkspaceHandleDb();
  try{await new Promise((resolve,reject)=>{const tx=idb.transaction(WORKSPACE_STORE,'readwrite');tx.objectStore(WORKSPACE_STORE).delete(DEFAULT_WORKSPACE_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{idb.close()}
  rememberedWorkspaceHandle=null;renderRememberedWorkspace();
}
async function handlePermission(handle,mode='readwrite'){
  if(!handle)return'denied';
  try{return handle.queryPermission?await handle.queryPermission({mode}):'prompt'}catch(e){return'prompt'}
}
async function requestHandlePermission(handle,mode='readwrite'){
  const current=await handlePermission(handle,mode);if(current==='granted')return true;
  try{return !!handle.requestPermission&&await handle.requestPermission({mode})==='granted'}catch(e){return false}
}

/* Reuse the complete workspace-open pipeline with a known remembered handle. */
const memoryOpenWorkspace=openWorkspace;
async function invokeOpenWorkspaceWithHandle(handle){
  const original=window.showDirectoryPicker;
  let replaced=false;
  try{
    try{window.showDirectoryPicker=async()=>handle;replaced=window.showDirectoryPicker!==original}catch(e){}
    if(!replaced)throw new Error('This browser cannot reconnect the remembered folder automatically.');
    await memoryOpenWorkspace();
  }finally{
    try{window.showDirectoryPicker=original}catch(e){}
  }
}
async function reconnectRememberedWorkspace({requestPermission=true,quiet=false,automatic=false}={}){
  if(workspaceReconnectRunning||!rememberedWorkspaceHandle)return false;
  if(automatic&&getLastConnectionPreference()?.mode==='remote')return false;
  const connectionToken=beginWorkspaceConnection('local',rememberedWorkspaceHandle.name||'Workspace');
  workspaceReconnectRunning=true;
  try{
    const permission=await handlePermission(rememberedWorkspaceHandle);
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return false;
    if(permission!=='granted'){
      if(!requestPermission)return false;
      if(!await requestHandlePermission(rememberedWorkspaceHandle)){
        if(!quiet)alert(`Permission is required to open workspace ${rememberedWorkspaceHandle.name||''}.`);
        renderRememberedWorkspace();return false
      }
    }
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return false;
    setWorkspaceLoading(true,`Loading ${rememberedWorkspaceHandle.name||'workspace'}…`);
    await invokeOpenWorkspaceWithHandle(rememberedWorkspaceHandle);
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return false;
    if(workspaceHandle&&window.workspaceRepository?.mode==='local'){await workspaceHandlePut(workspaceHandle);setLastConnectionPreference({mode:'local',name:workspaceHandle.name||'Workspace'});log(`Opened remembered workspace ${workspaceHandle.name}.`);return true}
    return false
  }catch(e){
    if(!quiet){alert(`Could not open remembered workspace: ${e.message}`);log(`ERROR opening remembered workspace: ${e.message}`)}
    return false
  }finally{workspaceReconnectRunning=false;setWorkspaceLoading(false);renderRememberedWorkspace()}
}
async function chooseDifferentWorkspace(){
  const connectionToken=beginWorkspaceConnection('local');
  const original=window.showDirectoryPicker;
  try{
    if(original){window.showDirectoryPicker=async options=>{const h=await original.call(window,options);if(workspaceConnectionIsCurrent(connectionToken,'local'))setWorkspaceLoading(true,`Loading ${h.name||'workspace'}…`);return h}}
    await memoryOpenWorkspace();
    if(!workspaceConnectionIsCurrent(connectionToken,'local'))return;
    if(workspaceHandle&&window.workspaceRepository?.mode==='local'){await workspaceHandlePut(workspaceHandle);setLastConnectionPreference({mode:'local',name:workspaceHandle.name||'Workspace'});log(`Remembered workspace ${workspaceHandle.name} in this browser.`)}
  }catch(e){if(e.name!=='AbortError'){alert(e.message);log(`ERROR opening workspace: ${e.message}`)}}
  finally{try{window.showDirectoryPicker=original}catch(e){}setWorkspaceLoading(false);renderRememberedWorkspace()}
}

/* One canonical visible Local Workspace action. A remembered local folder is tried only when
   local is the last-used connection mode or the user explicitly chooses Local Workspace. */
openWorkspace=async function(){
  if(window.workspaceRepository?.mode==='local'&&workspaceHandle){await chooseDifferentWorkspace();return}
  if(rememberedWorkspaceHandle){const ok=await reconnectRememberedWorkspace({requestPermission:true,automatic:false});if(ok)return}
  await chooseDifferentWorkspace()
};
const memoryOpenBtn=document.getElementById('openWorkspaceBtn');if(memoryOpenBtn)memoryOpenBtn.onclick=()=>openWorkspace();

function renderRememberedWorkspace(){
  const btn=document.getElementById('openWorkspaceBtn');
  if(btn&&!workspaceLoading)btn.textContent=window.workspaceRepository?.mode==='local'?'Change Local Workspace':'Local Workspace';
  const section=document.getElementById('data');if(!section)return;
  let card=document.getElementById('rememberedWorkspaceCard');
  if(!card){card=document.createElement('div');card.id='rememberedWorkspaceCard';card.className='card';card.style.marginTop='16px';const first=section.querySelector('.card');first?.before(card)}
  if(!rememberedWorkspaceHandle){card.innerHTML='<div class="section-title" style="margin-top:0"><div><h2>Default Local Workspace</h2><p class="muted">No local folder is remembered in this browser yet. Use Local Workspace above to select one.</p></div></div>';return}
  card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Default Local Workspace</h2><p class="muted">The folder handle is stored locally in this browser's IndexedDB. It is only auto-opened when Local was the last-used connection mode.</p></div><div class="toolbar"><button class="btn" id="chooseWorkspaceMemory">Choose Different</button><button class="btn danger" id="forgetWorkspaceMemory">Forget</button></div></div><div class="mini-stat"><span>Remembered folder</span><strong>${escHtml(rememberedWorkspaceHandle.name||'Workspace')}</strong></div><div class="mini-stat"><span>Current connection</span><strong>${window.workspaceRepository?.mode==='local'&&workspaceHandle?escHtml(workspaceHandle.name):'Not using local workspace'}</strong></div><div class="muted" id="rememberedWorkspacePermission" style="margin-top:10px">Checking browser permission…</div>`;
  document.getElementById('chooseWorkspaceMemory')?.addEventListener('click',chooseDifferentWorkspace);
  document.getElementById('forgetWorkspaceMemory')?.addEventListener('click',async()=>{if(confirm('Forget the remembered workspace on this browser? This does not delete any workspace files.'))await workspaceHandleForget()});
  handlePermission(rememberedWorkspaceHandle).then(p=>{const el=document.getElementById('rememberedWorkspacePermission');if(el)el.textContent=p==='granted'?'Browser permission is currently granted.':p==='prompt'?'The folder is remembered, but this browser requires a Local Workspace click to restore access.':'Browser access is currently denied; use Local Workspace to choose or re-authorise the folder.'}).catch(()=>{})
}

const memoryUpdateBanner=updateBanner;
updateBanner=function(){if(workspaceLoading)return;memoryUpdateBanner();renderRememberedWorkspace()};

async function initialiseRememberedWorkspace(){
  try{
    rememberedWorkspaceHandle=await workspaceHandleGet();renderRememberedWorkspace();
    if(!rememberedWorkspaceHandle)return;
    const preference=getLastConnectionPreference();
    if(preference?.mode==='remote'){
      log(`Remembered local workspace ${rememberedWorkspaceHandle.name||'Workspace'} retained, but Remote was used last; local auto-load suppressed.`);
      return
    }
    const permission=await handlePermission(rememberedWorkspaceHandle);
    if(permission==='granted'&&!workspaceHandle){
      log(`Remembered local workspace ${rememberedWorkspaceHandle.name||'Workspace'} found with permission granted; opening automatically.`);
      await reconnectRememberedWorkspace({requestPermission:false,quiet:true,automatic:true})
    }else if(permission==='prompt'){
      log(`Remembered local workspace ${rememberedWorkspaceHandle.name||'Workspace'} found; browser permission requires the Local Workspace user gesture.`)
    }
  }catch(e){log(`Workspace memory unavailable: ${e.message}`);renderRememberedWorkspace()}
}
const loadingStyles=document.createElement('style');loadingStyles.textContent='.workspace-spinner{display:inline-block;width:14px;height:14px;margin-right:7px;vertical-align:-2px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:amo-spin .8s linear infinite}.state-dot.loading{background:var(--accent);box-shadow:0 0 0 3px var(--soft)}@keyframes amo-spin{to{transform:rotate(360deg)}}';document.head.appendChild(loadingStyles);
initialiseRememberedWorkspace();
