/* Remember the last selected File System Access workspace in IndexedDB. */
const WORKSPACE_DB_NAME='amo-browser-state';
const WORKSPACE_DB_VERSION=1;
const WORKSPACE_STORE='handles';
const DEFAULT_WORKSPACE_KEY='defaultWorkspace';
let rememberedWorkspaceHandle=null;
let workspaceReconnectRunning=false;

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

/* Reuse the complete existing open-workspace pipeline by temporarily supplying the remembered handle to the picker call. */
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
async function reconnectRememberedWorkspace({requestPermission=true,quiet=false}={}){
  if(workspaceReconnectRunning||!rememberedWorkspaceHandle)return false;
  workspaceReconnectRunning=true;
  try{
    const permission=await handlePermission(rememberedWorkspaceHandle);
    if(permission!=='granted'){
      if(!requestPermission)return false;
      if(!await requestHandlePermission(rememberedWorkspaceHandle)){
        if(!quiet)alert(`Permission is required to reconnect workspace ${rememberedWorkspaceHandle.name||''}.`);
        renderRememberedWorkspace();return false
      }
    }
    await invokeOpenWorkspaceWithHandle(rememberedWorkspaceHandle);
    if(workspaceHandle){await workspaceHandlePut(workspaceHandle);log(`Reconnected remembered workspace ${workspaceHandle.name}.`);return true}
    return false
  }catch(e){
    if(!quiet){alert(`Could not reconnect remembered workspace: ${e.message}`);log(`ERROR reconnecting workspace: ${e.message}`)}
    return false
  }finally{workspaceReconnectRunning=false;renderRememberedWorkspace()}
}
async function chooseDifferentWorkspace(){
  try{
    await memoryOpenWorkspace();
    if(workspaceHandle){await workspaceHandlePut(workspaceHandle);log(`Remembered workspace ${workspaceHandle.name} in this browser.`)}
  }catch(e){if(e.name!=='AbortError'){alert(e.message);log(`ERROR opening workspace: ${e.message}`)}}
  renderRememberedWorkspace()
}

/* Current open action prefers the remembered workspace; explicit Choose Different always invokes the native picker. */
openWorkspace=async function(){
  if(rememberedWorkspaceHandle){const ok=await reconnectRememberedWorkspace({requestPermission:true});if(ok)return}
  await chooseDifferentWorkspace()
};
const memoryOpenBtn=document.getElementById('openWorkspaceBtn');if(memoryOpenBtn)memoryOpenBtn.onclick=()=>openWorkspace();

function renderRememberedWorkspace(){
  const btn=document.getElementById('openWorkspaceBtn');
  if(btn){
    if(workspaceHandle)btn.textContent='Change Workspace';
    else if(rememberedWorkspaceHandle)btn.textContent=`Reconnect ${rememberedWorkspaceHandle.name||'Workspace'}`;
    else btn.textContent='Open Workspace Folder';
  }
  const section=document.getElementById('data');if(!section)return;
  let card=document.getElementById('rememberedWorkspaceCard');
  if(!card){card=document.createElement('div');card.id='rememberedWorkspaceCard';card.className='card';card.style.marginTop='16px';const first=section.querySelector('.card');first?.before(card)}
  if(!rememberedWorkspaceHandle){card.innerHTML='<div class="section-title" style="margin-top:0"><div><h2>Default Workspace</h2><p class="muted">No folder is remembered in this browser yet.</p></div><button class="btn" id="chooseWorkspaceMemory">Choose Workspace</button></div>';document.getElementById('chooseWorkspaceMemory')?.addEventListener('click',chooseDifferentWorkspace);return}
  card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Default Workspace</h2><p class="muted">The folder handle is stored locally in this browser's IndexedDB. Workspace files remain in the original folder.</p></div><div class="toolbar"><button class="btn" id="reconnectWorkspaceMemory">Reconnect</button><button class="btn" id="chooseWorkspaceMemory">Choose Different</button><button class="btn danger" id="forgetWorkspaceMemory">Forget</button></div></div><div class="mini-stat"><span>Remembered folder</span><strong>${escHtml(rememberedWorkspaceHandle.name||'Workspace')}</strong></div><div class="mini-stat"><span>Current connection</span><strong>${workspaceHandle===rememberedWorkspaceHandle?'Connected':workspaceHandle?escHtml(workspaceHandle.name):'Not connected'}</strong></div><div class="muted" id="rememberedWorkspacePermission" style="margin-top:10px">Checking browser permission…</div>`;
  document.getElementById('reconnectWorkspaceMemory')?.addEventListener('click',()=>reconnectRememberedWorkspace({requestPermission:true}));
  document.getElementById('chooseWorkspaceMemory')?.addEventListener('click',chooseDifferentWorkspace);
  document.getElementById('forgetWorkspaceMemory')?.addEventListener('click',async()=>{if(confirm('Forget the remembered workspace on this browser? This does not delete any workspace files.'))await workspaceHandleForget()});
  handlePermission(rememberedWorkspaceHandle).then(p=>{const el=document.getElementById('rememberedWorkspacePermission');if(el)el.textContent=p==='granted'?'Browser permission is currently granted; AMO can reconnect automatically.':p==='prompt'?'The folder is remembered; the browser will ask you to reconnect when needed.':'Browser access is currently denied; choose the workspace again if reconnect is unavailable.'}).catch(()=>{})
}

/* Any successful native folder selection becomes the remembered/default workspace. */
const memoryUpdateBanner=updateBanner;
updateBanner=function(){memoryUpdateBanner();renderRememberedWorkspace()};

async function initialiseRememberedWorkspace(){
  try{
    rememberedWorkspaceHandle=await workspaceHandleGet();renderRememberedWorkspace();
    if(!rememberedWorkspaceHandle)return;
    const permission=await handlePermission(rememberedWorkspaceHandle);
    if(permission==='granted'&&!workspaceHandle){
      log(`Remembered workspace ${rememberedWorkspaceHandle.name||'Workspace'} found; reconnecting automatically.`);
      await reconnectRememberedWorkspace({requestPermission:false,quiet:true})
    }
  }catch(e){log(`Workspace memory unavailable: ${e.message}`);renderRememberedWorkspace()}
}
initialiseRememberedWorkspace();
