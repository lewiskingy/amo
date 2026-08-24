/* Remote workspace connection UX. Local Workspace remains available through the existing folder picker. */
(function initRemoteWorkspaceUx(){
  const REMOTE_URL_KEY='amo.remoteWorkspaceUrl';
  const currentRemoteUrl=()=>{try{return localStorage.getItem(REMOTE_URL_KEY)||getLastConnectionPreference()?.url||window.AMO_CONFIG?.defaultRemoteUrl||''}catch{return window.AMO_CONFIG?.defaultRemoteUrl||''}};
  const connected=()=>!!window.workspaceRepository;

  async function activateRemote(repo,bundle,connectionToken){
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    const {workspace,demand,team,allocations,ideas,configFiles}=bundle,settings=configFiles?.['settings.json'];validateWorkspaceSettings(settings);
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    const loadedSettings={...clone(DEFAULT_SETTINGS),...settings};loadedSettings.businessAreas=loadedSettings.businessAreas||[];loadedSettings.initiatives=migrateInitiatives(loadedSettings,demand);loadedSettings.ideaStatuses=Array.isArray(loadedSettings.ideaStatuses)&&loadedSettings.ideaStatuses.length?loadedSettings.ideaStatuses:clone(DEFAULT_SETTINGS.ideaStatuses);
    demand.forEach(d=>{d.businessArea=d.businessArea||'';d.initiative=d.initiative||'';d.costCentreOrProjectCode=d.costCentreOrProjectCode||'';d.source=d.source||{type:'SharePoint',id:'',url:'',title:''};d.source.url=d.source.url||'';d.source.title=d.source.title||'';d.azureDevOps=d.azureDevOps||{id:null,type:null,url:'',title:''};d.azureDevOps.url=d.azureDevOps.url||'';d.azureDevOps.title=d.azureDevOps.title||''});
    setWorkspaceRepository(repo);
    /* Temporary compatibility descriptor while older UI modules still use workspaceHandle as their connected flag. */
    workspaceHandle={name:workspace?.name||repo.name||'Remote Workspace',kind:'remote',remote:true};
    db={schemaVersion:workspace.schemaVersion||1,workspace,settings:loadedSettings,demand,team,allocations,ideas,configFiles};clearDirty();selectedDemandId=null;resetEdits();
    if(typeof loadStatusReports==='function')await loadStatusReports(repo);
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    if(typeof archiveStaleTerminalDemand==='function')await archiveStaleTerminalDemand(repo);
    if(typeof readWorkspaceLock==='function'){try{workspaceLock=await repo.readLock()}catch{workspaceLock=null}}
    if(!workspaceConnectionIsCurrent(connectionToken,'remote'))return false;
    refreshAll();if(typeof renderStatusReporting==='function')renderStatusReporting();if(typeof renderStatusHistory==='function')renderStatusHistory();if(typeof renderLockStatus==='function')renderLockStatus();updateBanner();
    setLastConnectionPreference({mode:'remote',url:repo.baseUrl});
    try{localStorage.setItem(REMOTE_URL_KEY,repo.baseUrl)}catch{}
    log(`Connected to remote workspace ${db.workspace?.name||repo.name} at ${repo.baseUrl}.`);
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
  if(typeof persistStatusReports==='function'){
    const localPersist=persistStatusReports;persistStatusReports=async function(){const repo=window.workspaceRepository;if(repo?.mode!=='remote')return localPersist();if(statusReportState.draftDirty)await repo.saveStatusReport('draft.json',statusReportDraft);for(const id of statusReportState.publishedDirty){const r=statusReports.find(x=>x.id===id);if(r)await repo.saveStatusReport(id,r)}}
  }
  if(typeof readWorkspaceLock==='function'){const localRead=readWorkspaceLock;readWorkspaceLock=async function(){const repo=window.workspaceRepository;return repo?.mode==='remote'?repo.readLock():localRead()}}
  if(typeof writeWorkspaceLock==='function'){const localWrite=writeWorkspaceLock;writeWorkspaceLock=async function(lock){const repo=window.workspaceRepository;return repo?.mode==='remote'?repo.writeLock(lock):localWrite(lock)}}
  if(typeof removeWorkspaceLock==='function'){const localRemove=removeWorkspaceLock;removeWorkspaceLock=async function(){const repo=window.workspaceRepository;if(repo?.mode!=='remote')return localRemove();const current=await repo.readLock();if(current&&current.sessionId!==lockSessionId)return;return repo.deleteLock()}}

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
