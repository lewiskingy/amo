/* Remote workspace connection UX. Local Workspace remains available through the existing folder picker. */
(function initRemoteWorkspaceUx(){
  const REMOTE_URL_KEY='amo.remoteWorkspaceUrl';
  const currentRemoteUrl=()=>{try{return localStorage.getItem(REMOTE_URL_KEY)||getLastConnectionPreference()?.url||window.AMO_CONFIG?.defaultRemoteUrl||''}catch{return window.AMO_CONFIG?.defaultRemoteUrl||''}};
  const connected=()=>!!window.workspaceRepository;
  const remoteUsesOptimisticConcurrency=()=>window.workspaceRepository?.mode==='remote'&&window.workspaceRepository?.info?.capabilities?.locking===false;

  async function activateRemote(repo,rawBundle,connectionToken){
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    const prepared=prepareLoadedWorkspace(rawBundle),{workspace,demand,team,allocations,ideas,configFiles,loadedSettings}=prepared;
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    setWorkspaceRepository(repo);
    /* Temporary compatibility descriptor while older UI modules still use workspaceHandle as their connected flag. */
    workspaceHandle={name:workspace?.name||repo.name||'Remote Workspace',kind:'remote',remote:true};
    db={schemaVersion:CURRENT_SCHEMA_VERSION,workspace,settings:loadedSettings,demand,team,allocations,ideas,configFiles};clearDirty();applyMigrationDirtyState(prepared);selectedDemandId=null;resetEdits();
    if(typeof loadStatusReports==='function')await loadStatusReports(repo);
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    if(typeof archiveStaleTerminalDemand==='function')await archiveStaleTerminalDemand(repo);
    if(typeof readWorkspaceLock==='function'){try{workspaceLock=await repo.readLock()}catch{workspaceLock=null}}
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    refreshAll();if(typeof renderStatusReporting==='function')renderStatusReporting();if(typeof renderStatusHistory==='function')renderStatusHistory();if(typeof renderLockStatus==='function')renderLockStatus();updateBanner();
    setLastConnectionPreference({mode:'remote',url:repo.baseUrl});
    try{localStorage.setItem(REMOTE_URL_KEY,repo.baseUrl)}catch{}
    log(`Connected to remote workspace ${db.workspace?.name||repo.name} at ${repo.baseUrl}.${prepared.migrated?' Schema v2 migration is staged and will be persisted on the next save.':''}`);
    return true
  }

  async function connectRemoteWorkspace(url,{quiet=false}={}){
    const normalized=String(url||'').trim().replace(/\/+$/,'');if(!normalized)return false;
    const connectionToken=beginWorkspaceConnection('remote',normalized);
    try{
      if(typeof setWorkspaceLoading==='function')setWorkspaceLoading(true,'Connecting to remote workspace…');
      const repo=new RemoteWorkspaceRepository(normalized);await repo.connect();if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
      const bundle=await repo.loadWorkspace();if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
      return await activateRemote(repo,bundle,connectionToken)
    }catch(e){
      if(!quiet){alert(`Could not open remote workspace: ${e.message}`);log(`ERROR opening remote workspace: ${e.message}`)}else log(`Remote workspace auto-connect failed: ${e.message}`);
      return false
    }finally{if(typeof setWorkspaceLoading==='function'&&workspaceConnectionIsCurrent(connectionToken,'remote'))setWorkspaceLoading(false)}
  }

  async function openRemoteWorkspace(){
    const initial=currentRemoteUrl()||'https://api.amo.theflat.me.uk';const input=prompt('Remote AMO API URL',initial);if(input==null)return;return connectRemoteWorkspace(input)
  }

  const oldEnsureRW=typeof ensureRW==='function'?ensureRW:null;if(oldEnsureRW)ensureRW=async function(handle){if(window.workspaceRepository?.mode==='remote')return true;return oldEnsureRW(handle)};
  if(typeof acquireWorkspaceLock==='function'){
    const localAcquire=acquireWorkspaceLock;
    acquireWorkspaceLock=async function(){if(remoteUsesOptimisticConcurrency())return true;return localAcquire()}
  }
  if(typeof lockDescription==='function'){
    const localLockDescription=lockDescription;
    lockDescription=function(lock){if(remoteUsesOptimisticConcurrency())return'Editing · Optimistic concurrency';return localLockDescription(lock)}
  }
  if(typeof renderWorkspaceIdentityCard==='function'){
    const localIdentityCard=renderWorkspaceIdentityCard;
    renderWorkspaceIdentityCard=function(){
      if(!remoteUsesOptimisticConcurrency())return localIdentityCard();
      const data=document.getElementById('data');if(!data)return;let card=document.getElementById('workspaceIdentityCard');if(!card){card=document.createElement('div');card.id='workspaceIdentityCard';card.className='card';card.style.marginTop='16px';data.querySelector('.card')?.after(card)}
      const user=typeof localWorkspaceUser==='function'?localWorkspaceUser():null;
      card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Editing identity & concurrency</h2><p class="muted">Mongo Remote Workspace uses optimistic document versions and atomic database transactions instead of a workspace edit lock.</p></div><button class="btn" id="changeWorkspaceUser">Change identity</button></div><div class="mini-stat"><span>Browser identity</span><strong>${typeof escHtml==='function'?escHtml(user?.displayName||'Not set'):(user?.displayName||'Not set')}</strong></div><div class="mini-stat"><span>Workspace state</span><strong>Editing · Optimistic concurrency</strong></div><div class="muted" style="margin-top:10px">Conflicting writes are rejected and must be reloaded/merged rather than overwriting a newer document.</div>`;
      document.getElementById('changeWorkspaceUser')?.addEventListener('click',setWorkspaceUser)
    }
  }
  if(typeof persistStatusReports==='function'){
    const localPersist=persistStatusReports;persistStatusReports=async function(){const repo=window.workspaceRepository;if(repo?.mode!=='remote')return localPersist();if(statusReportState.draftDirty)await repo.saveStatusReport('draft.json',statusReportDraft);for(const id of statusReportState.publishedDirty){const r=statusReports.find(x=>x.id===id);if(r)await repo.saveStatusReport(id,r)}}
  }
  if(typeof readWorkspaceLock==='function'){const localRead=readWorkspaceLock;readWorkspaceLock=async function(){const repo=window.workspaceRepository;return repo?.mode==='remote'?repo.readLock():localRead()}}
  if(typeof writeWorkspaceLock==='function'){const localWrite=writeWorkspaceLock;writeWorkspaceLock=async function(lock){const repo=window.workspaceRepository;return repo?.mode==='remote'?repo.writeLock(lock):localWrite(lock)}}
  if(typeof removeWorkspaceLock==='function'){const localRemove=removeWorkspaceLock;removeWorkspaceLock=async function(){const repo=window.workspaceRepository;if(repo?.mode!=='remote')return localRemove();if(remoteUsesOptimisticConcurrency())return;const current=await repo.readLock();if(current&&current.sessionId!==lockSessionId)return;return repo.deleteLock()}}

  function installButtons(){
    const local=document.getElementById('openWorkspaceBtn'),actions=local?.parentElement;if(!local||!actions)return;
    if(!document.getElementById('remoteWorkspaceBtn')){const remote=document.createElement('button');remote.className='btn';remote.id='remoteWorkspaceBtn';remote.textContent=window.workspaceRepository?.mode==='remote'?'Change Remote Workspace':'Remote Workspace';remote.title='Connect to an AMO API workspace';remote.addEventListener('click',openRemoteWorkspace);local.after(remote)}
    const remote=document.getElementById('remoteWorkspaceBtn');if(remote)remote.textContent=window.workspaceRepository?.mode==='remote'?'Change Remote Workspace':'Remote Workspace';
    if(window.workspaceRepository?.mode==='remote')local.textContent='Local Workspace';else if(!connected())local.textContent='Local Workspace';else if(window.workspaceRepository?.mode==='local')local.textContent='Change Local Workspace'
  }
  installButtons();setTimeout(installButtons,100);setTimeout(installButtons,500);
  window.openRemoteWorkspace=openRemoteWorkspace;
  window.connectRemoteWorkspace=connectRemoteWorkspace;

  const preference=getLastConnectionPreference();
  if(preference?.mode==='remote'){
    const url=preference.url||currentRemoteUrl();
    if(url)setTimeout(()=>{if(!window.workspaceRepository)connectRemoteWorkspace(url,{quiet:true})},0)
  }
})();
