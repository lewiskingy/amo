/* Compatibility bridge for modules that pre-date WorkspaceRepository.
   This keeps their public/domain functions stable while moving persistence behind the repository contract.
   It can shrink as those modules are decomposed further. */
(function initWorkspaceRepositoryBridge(){
  const currentRepo=()=>window.workspaceRepository||(workspaceHandle&&window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(workspaceHandle):null);
  async function readRepositoryLock(repo){
    if(!repo)return null;
    try{return await repo.readLock(WORKSPACE_LOCK_FILE)}
    catch(e){
      if(repo.mode==='local'&&(e instanceof SyntaxError||/JSON|Unexpected end/i.test(String(e?.message||'')))){
        log?.(`Invalid local workspace lock file detected: ${e.message}. It will be treated as stale and may be replaced explicitly.`);
        return{type:'amo-workspace-lock-invalid',invalid:true,userId:'invalid-lock',userDisplayName:'Unreadable local lock',acquiredAt:'',heartbeatAt:''}
      }
      throw e
    }
  }

  if(typeof persistStatusReports==='function'){
    persistStatusReports=async function(){
      const repo=currentRepo();if(!repo)return;
      if(statusReportState.draftDirty)await repo.saveStatusReport('draft.json',statusReportDraft);
      for(const id of statusReportState.publishedDirty){const r=statusReports.find(x=>x.id===id);if(r)await repo.saveStatusReport(id,r)}
    }
  }

  if(typeof readWorkspaceLock==='function')readWorkspaceLock=async function(){return readRepositoryLock(currentRepo())};
  if(typeof writeWorkspaceLock==='function')writeWorkspaceLock=async function(lock){const repo=currentRepo();if(!repo)throw new Error('No workspace repository is connected.');await repo.writeLock(lock,WORKSPACE_LOCK_FILE)};
  if(typeof removeWorkspaceLock==='function')removeWorkspaceLock=async function(){const repo=currentRepo();if(!repo)return;const current=await readRepositoryLock(repo);if(current&&current.sessionId!==lockSessionId)return;await repo.deleteLock(WORKSPACE_LOCK_FILE)};

  if(typeof refreshBackupInventory==='function')refreshBackupInventory=async function(value=window.workspaceRepository){
    retainedBackupInventory=[];const repo=value?.listBackups?value:currentRepo();if(repo){try{for(const name of await repo.listBackups()){const date=parseBackupTimestamp(name);if(date)retainedBackupInventory.push({name,date})}}catch(e){log(`Could not list backups: ${e.message}`)}}retainedBackupInventory.sort((a,b)=>b.date-a.date);renderBackupInventory()
  };

  /* Application-facing adapter. New code should use this object rather than choosing a
     local/remote repository implementation itself. */
  window.amoWorkspace={
    get mode(){return currentRepo()?.mode||null},
    get connected(){return !!currentRepo()},
    get repository(){return currentRepo()},
    async listRecords(type){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.listRecords(type)},
    async getRecord(type,id){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.getRecord(type,id)},
    async saveRecord(type,record){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.saveRecord(type,record)},
    async deleteRecord(type,id){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.deleteRecord(type,id)},
    async getSettings(){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.getSettings()},
    async saveSettings(settings){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.saveSettings(settings)},
    async getStatusReport(id){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.getStatusReport(id)},
    async saveStatusReport(id,report){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.saveStatusReport(id,report)},
    async acquireWriteAccess(){const repo=currentRepo();return !!repo&&repo.ensureWritePermission()},
    async runArchiveMaintenance(){return typeof archiveStaleTerminalDemand==='function'?archiveStaleTerminalDemand(currentRepo()):{demand:0,allocations:0}}
  };
})();
