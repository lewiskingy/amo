/* Lightweight Status Report viewer. Resolves one report through the repository contract without
   loading the AMO workspace, then delegates all presentation and scope projection to AmoReportRenderer. */
(function initReportViewer(){
  const WORKSPACE_DB_NAME='amo-browser-state',WORKSPACE_DB_VERSION=1,WORKSPACE_STORE='handles',DEFAULT_WORKSPACE_KEY='defaultWorkspace';
  const REMOTE_URL_KEY='amo.remoteWorkspaceUrl',DEFAULT_REMOTE_URL='https://api.amo.theflat.me.uk',ORG='organization',ALL='department',PREVIEW_PREFIX='amo.statusReportPreview.',PREVIEW_TTL_MS=10*60*1000;
  const $=id=>document.getElementById(id);
  const query=new URLSearchParams(location.search),pathParts=location.pathname.split('/').filter(Boolean);
  const reportId=decodeURIComponent(query.get('id')||(pathParts[0]==='reports'&&pathParts[1]?pathParts[1]:''));
  const previewToken=query.get('preview')||'';
  const source=(query.get('source')||'remote').toLowerCase()==='local'?'local':'remote';
  const requestedScope={departmentId:query.get('department')||ORG,teamId:query.get('team')||ALL};
  let currentReport=null,currentScope={...requestedScope};

  function setState(message,{error=false}={}){const el=$('reportViewerState');if(!el)return;el.hidden=false;el.innerHTML=error?`<span>${escapeHtml(message)}</span>`:`<span class="report-viewer-spinner" aria-hidden="true"></span>${escapeHtml(message)}`}
  function hideState(){if($('reportViewerState'))$('reportViewerState').hidden=true}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function remoteBaseUrl(){try{return localStorage.getItem(REMOTE_URL_KEY)||DEFAULT_REMOTE_URL}catch{return DEFAULT_REMOTE_URL}}
  function openHandleDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window)){reject(new Error('IndexedDB is not available in this browser.'));return}const req=indexedDB.open(WORKSPACE_DB_NAME,WORKSPACE_DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(WORKSPACE_STORE))db.createObjectStore(WORKSPACE_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open browser workspace storage.'))})}
  async function rememberedHandle(){const db=await openHandleDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(WORKSPACE_STORE,'readonly'),req=tx.objectStore(WORKSPACE_STORE).get(DEFAULT_WORKSPACE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}finally{db.close()}}
  async function rememberHandle(handle){const db=await openHandleDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(WORKSPACE_STORE,'readwrite');tx.objectStore(WORKSPACE_STORE).put(handle,DEFAULT_WORKSPACE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Workspace handle storage was aborted.'))})}finally{db.close()}}
  async function permission(handle,mode='read'){try{return handle?.queryPermission?await handle.queryPermission({mode}):'prompt'}catch{return'prompt'}}
  async function requestPermission(handle,mode='read'){const existing=await permission(handle,mode);if(existing==='granted')return true;try{return !!handle?.requestPermission&&await handle.requestPermission({mode})==='granted'}catch{return false}}
  async function chooseLocalRepository(){if(!('showDirectoryPicker'in window))throw new Error('This browser cannot reconnect a local AMO workspace.');const handle=await showDirectoryPicker({mode:'read'});await rememberHandle(handle);return new LocalWorkspaceRepository(handle)}
  async function rememberedLocalRepository({request=false}={}){const handle=await rememberedHandle();if(!handle)return null;const p=await permission(handle,'read');if(p==='granted')return new LocalWorkspaceRepository(handle);if(request&&await requestPermission(handle,'read'))return new LocalWorkspaceRepository(handle);return null}
  async function loadRemote(){return new RemoteWorkspaceRepository(remoteBaseUrl()).getStatusReport(reportId)}
  async function loadFromRepo(repo){return repo?repo.getStatusReport(reportId):null}
  function loadPreview(){
    if(!previewToken)throw new Error('No Draft Preview token was supplied.');const key=`${PREVIEW_PREFIX}${previewToken}`;let raw='';
    try{raw=localStorage.getItem(key)||'';localStorage.removeItem(key)}catch(_e){throw new Error('This browser could not read the temporary Draft Preview.')}
    if(!raw)throw new Error('This Draft Preview is no longer available. Open Preview again from the Status Report page.');
    let record;try{record=JSON.parse(raw)}catch(_e){throw new Error('The temporary Draft Preview is invalid.')}
    if(!record?.createdAt||Date.now()-Number(record.createdAt)>PREVIEW_TTL_MS||!record.report)throw new Error('This Draft Preview has expired. Open Preview again from the Status Report page.');
    return record.report
  }

  function showReconnect(message){
    hideState();const host=$('reportViewerReconnect');host.hidden=false;host.innerHTML=`<h2>Reconnect Local Workspace</h2><p>${escapeHtml(message)}</p><p class="muted">The report address identifies the report, but browser security does not allow a URL to reopen a local folder by path. AMO can reuse the workspace remembered by this browser, or you can choose it again.</p><div class="toolbar"><button class="btn primary" id="reconnectLocalReport">Reconnect Remembered</button><button class="btn" id="chooseLocalReportWorkspace">Choose Workspace</button></div>`;
    $('reconnectLocalReport').onclick=async()=>{try{host.hidden=true;setState('Reconnecting remembered workspace…');const repo=await rememberedLocalRepository({request:true});if(!repo){showReconnect('The remembered workspace is unavailable or permission was not granted.');return}render(await loadFromRepo(repo))}catch(e){showReconnect(e.message||'Could not read the report from the remembered workspace.')}};
    $('chooseLocalReportWorkspace').onclick=async()=>{try{host.hidden=true;setState('Opening selected workspace…');render(await loadFromRepo(await chooseLocalRepository()))}catch(e){if(e?.name==='AbortError'){showReconnect(message);return}showReconnect(e.message||'Could not read the report from the selected workspace.')}}
  }
  function scopeCatalog(report){
    const departments=new Map(),teams=new Map();
    for(const e of report?.entries||[]){
      if(e.departmentId&&!departments.has(e.departmentId))departments.set(e.departmentId,{id:e.departmentId,name:e.departmentName||e.departmentId});
      if(e.teamId&&!teams.has(e.teamId))teams.set(e.teamId,{id:e.teamId,name:e.teamName||e.teamId,departmentId:e.departmentId||''})
    }
    return{departments:[...departments.values()],teams:[...teams.values()],teamsById:Object.fromEntries(teams)}
  }
  function scopeInfo(catalog){
    const dep=catalog.departments.find(d=>d.id===currentScope.departmentId),team=catalog.teams.find(t=>t.id===currentScope.teamId);
    return{departmentId:currentScope.departmentId,teamId:currentScope.teamId,departmentName:dep?.name||'',teamName:team?.name||'',label:currentScope.departmentId===ORG?'Whole organisation':currentScope.teamId===ALL?(dep?.name||'Whole department'):[dep?.name,team?.name].filter(Boolean).join(' · ')}
  }
  function normalizeScope(catalog){
    if(currentScope.departmentId!==ORG&&!catalog.departments.some(d=>d.id===currentScope.departmentId))currentScope={departmentId:ORG,teamId:ALL};
    if(currentScope.teamId!==ALL&&!catalog.teams.some(t=>t.id===currentScope.teamId&&(!t.departmentId||t.departmentId===currentScope.departmentId)))currentScope.teamId=ALL
  }
  function renderScopeControls(report){
    const host=$('reportViewerScope'),catalog=scopeCatalog(report);if(!host)return catalog;
    if(!catalog.departments.length&&!catalog.teams.length){host.hidden=true;return catalog}normalizeScope(catalog);
    const depOptions=`<option value="${ORG}" ${currentScope.departmentId===ORG?'selected':''}>Organisation-wide</option>${catalog.departments.map(d=>`<option value="${escapeHtml(d.id)}" ${currentScope.departmentId===d.id?'selected':''}>${escapeHtml(d.name)}</option>`).join('')}`;
    const available=currentScope.departmentId===ORG?[]:catalog.teams.filter(t=>!t.departmentId||t.departmentId===currentScope.departmentId);
    const teamOptions=currentScope.departmentId===ORG?'<option value="department">All teams</option>':`<option value="${ALL}" ${currentScope.teamId===ALL?'selected':''}>Whole department</option>${available.map(t=>`<option value="${escapeHtml(t.id)}" ${currentScope.teamId===t.id?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}`;
    host.hidden=false;host.innerHTML=`<label><span>Department</span><select id="reportDepartment">${depOptions}</select></label><label><span>Team</span><select id="reportTeam" ${currentScope.departmentId===ORG?'disabled':''}>${teamOptions}</select></label>`;
    $('reportDepartment').onchange=e=>{currentScope={departmentId:e.target.value,teamId:ALL};render(currentReport,{preserveState:true})};
    $('reportTeam').onchange=e=>{currentScope.teamId=e.target.value;render(currentReport,{preserveState:true})};return catalog
  }
  function render(report,{preserveState=false}={}){
    if(!report)throw new Error(`Report ${reportId} was not found.`);currentReport=report;hideState();$('reportViewerReconnect').hidden=true;document.title=`${report.reportingDate||report.id||'Draft Preview'} · AMO Status Report`;
    if(!preserveState)currentScope={...requestedScope};const catalog=renderScopeControls(report);
    $('reportViewerContent').innerHTML=AmoReportRenderer.renderReport(report,{scope:scopeInfo(catalog),catalog})
  }
  async function start(){
    try{
      if(previewToken){setState('Opening Draft Preview…');render(loadPreview());return}
      if(!reportId){setState('No report ID was supplied in the URL.',{error:true});return}
      if(source==='local'){
        setState(`Opening ${reportId} from the remembered local workspace…`);const repo=await rememberedLocalRepository();if(!repo){showReconnect('Local workspace permission is required before this report can be opened.');return}render(await loadFromRepo(repo));return
      }
      setState(`Loading ${reportId}…`);render(await loadRemote())
    }catch(e){if(source==='local'&&!previewToken){showReconnect(e.message||`Could not open ${reportId} from the local workspace.`);return}setState(e.message||`Could not load ${reportId||'Draft Preview'}.`,{error:true})}
  }
  start();
})();
