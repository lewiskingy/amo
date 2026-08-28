/* Lightweight Status Report viewer. Resolves one report through the existing repository contract
   without loading the AMO workspace, running migrations, backups, autosave or archive maintenance. */
(function initReportViewer(){
  const WORKSPACE_DB_NAME='amo-browser-state',WORKSPACE_DB_VERSION=1,WORKSPACE_STORE='handles',DEFAULT_WORKSPACE_KEY='defaultWorkspace';
  const REMOTE_URL_KEY='amo.remoteWorkspaceUrl',DEFAULT_REMOTE_URL='https://api.amo.theflat.me.uk';
  const $=id=>document.getElementById(id);
  const query=new URLSearchParams(location.search);
  const pathParts=location.pathname.split('/').filter(Boolean);
  const reportId=decodeURIComponent(query.get('id')||(pathParts[0]==='reports'&&pathParts[1]?pathParts[1]:''));
  const source=(query.get('source')||'remote').toLowerCase()==='local'?'local':'remote';

  function setState(message,{error=false}={}){const el=$('reportViewerState');if(!el)return;el.hidden=false;el.innerHTML=error?`<span>${escapeHtml(message)}</span>`:`<span class="report-viewer-spinner" aria-hidden="true"></span>${escapeHtml(message)}`}
  function hideState(){if($('reportViewerState'))$('reportViewerState').hidden=true}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]))}
  function currentCanonicalLink(){const u=new URL(`/reports/${encodeURIComponent(reportId)}`,location.origin);if(source==='local')u.searchParams.set('source','local');return u.href}
  function remoteBaseUrl(){try{return localStorage.getItem(REMOTE_URL_KEY)||DEFAULT_REMOTE_URL}catch{return DEFAULT_REMOTE_URL}}
  function openHandleDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window)){reject(new Error('IndexedDB is not available in this browser.'));return}const req=indexedDB.open(WORKSPACE_DB_NAME,WORKSPACE_DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(WORKSPACE_STORE))db.createObjectStore(WORKSPACE_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open browser workspace storage.'))})}
  async function rememberedHandle(){const db=await openHandleDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(WORKSPACE_STORE,'readonly'),req=tx.objectStore(WORKSPACE_STORE).get(DEFAULT_WORKSPACE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}finally{db.close()}}
  async function rememberHandle(handle){const db=await openHandleDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(WORKSPACE_STORE,'readwrite');tx.objectStore(WORKSPACE_STORE).put(handle,DEFAULT_WORKSPACE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Workspace handle storage was aborted.'))})}finally{db.close()}}
  async function permission(handle,mode='read'){try{return handle?.queryPermission?await handle.queryPermission({mode}):'prompt'}catch{return'prompt'}}
  async function requestPermission(handle,mode='read'){const existing=await permission(handle,mode);if(existing==='granted')return true;try{return !!handle?.requestPermission&&await handle.requestPermission({mode})==='granted'}catch{return false}}
  async function chooseLocalRepository(){if(!('showDirectoryPicker'in window))throw new Error('This browser cannot reconnect a local AMO workspace.');const handle=await showDirectoryPicker({mode:'read'});await rememberHandle(handle);return new LocalWorkspaceRepository(handle)}
  async function rememberedLocalRepository({request=false}={}){const handle=await rememberedHandle();if(!handle)return null;const p=await permission(handle,'read');if(p==='granted')return new LocalWorkspaceRepository(handle);if(request&&await requestPermission(handle,'read'))return new LocalWorkspaceRepository(handle);return null}
  async function loadRemote(){const repo=new RemoteWorkspaceRepository(remoteBaseUrl());return repo.getStatusReport(reportId)}
  async function loadFromRepo(repo){if(!repo)return null;return repo.getStatusReport(reportId)}

  function showReconnect(message){
    hideState();const host=$('reportViewerReconnect');host.hidden=false;host.innerHTML=`<h2>Reconnect Local Workspace</h2><p>${escapeHtml(message)}</p><p class="muted">The report link identifies the report, but browser security does not allow a URL to reopen a local folder by path. AMO can reuse the workspace handle remembered by this browser, or you can choose the workspace again.</p><div class="toolbar"><button class="btn primary" id="reconnectLocalReport">Reconnect Remembered</button><button class="btn" id="chooseLocalReportWorkspace">Choose Workspace</button></div>`;
    $('reconnectLocalReport').onclick=async()=>{try{host.hidden=true;setState('Reconnecting remembered workspace…');const repo=await rememberedLocalRepository({request:true});if(!repo){showReconnect('The remembered workspace is unavailable or permission was not granted.');return}render(await loadFromRepo(repo))}catch(e){showReconnect(e.message||'Could not read the report from the remembered workspace.')}};
    $('chooseLocalReportWorkspace').onclick=async()=>{try{host.hidden=true;setState('Opening selected workspace…');render(await loadFromRepo(await chooseLocalRepository()))}catch(e){if(e?.name==='AbortError'){showReconnect(message);return}showReconnect(e.message||'Could not read the report from the selected workspace.')}}
  }
  function render(report){
    if(!report)throw new Error(`Report ${reportId} was not found.`);hideState();$('reportViewerReconnect').hidden=true;document.title=`${report.reportingDate||report.id||reportId} · AMO Status Report`;$('reportViewerContent').innerHTML=AmoReportRenderer.renderReport(report);
    const print=$('reportPrint'),copy=$('reportCopyLink');print.hidden=false;copy.hidden=false;print.onclick=()=>window.print();copy.textContent=source==='local'?'Copy Local Link':'Copy Link';copy.title=source==='local'?'This link relies on this browser having access to the same local AMO workspace.':'Copy the shareable report URL.';copy.onclick=async()=>{try{await navigator.clipboard.writeText(currentCanonicalLink());const prior=copy.textContent;copy.textContent='Copied';setTimeout(()=>copy.textContent=prior,1400)}catch{prompt('Copy report link',currentCanonicalLink())}}
  }
  async function start(){
    if(!reportId){setState('No report ID was supplied in the URL.',{error:true});return}
    try{
      if(source==='local'){
        setState(`Opening ${reportId} from the remembered local workspace…`);const repo=await rememberedLocalRepository();if(!repo){showReconnect('Local workspace permission is required before this report can be opened.');return}render(await loadFromRepo(repo));return
      }
      setState(`Loading ${reportId}…`);render(await loadRemote())
    }catch(e){if(source==='local'){showReconnect(e.message||`Could not open ${reportId} from the local workspace.`);return}setState(e.message||`Could not load ${reportId}.`,{error:true})}
  }
  start();
})();
