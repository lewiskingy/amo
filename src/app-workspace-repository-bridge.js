/* Compatibility bridge for modules that pre-date WorkspaceRepository.
   This keeps their public/domain functions stable while moving persistence behind the repository contract.
   It can shrink as those modules are decomposed further. */
(function initWorkspaceRepositoryBridge(){
  const currentRepo=()=>window.workspaceRepository||(workspaceHandle&&window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(workspaceHandle):null);

  if(typeof persistStatusReports==='function'){
    persistStatusReports=async function(){
      const repo=currentRepo();if(!repo)return;
      if(statusReportState.draftDirty)await repo.saveStatusReport('draft.json',statusReportDraft);
      for(const id of statusReportState.publishedDirty){const r=statusReports.find(x=>x.id===id);if(r)await repo.saveStatusReport(id,r)}
    }
  }

  if(typeof readWorkspaceLock==='function')readWorkspaceLock=async function(){const repo=currentRepo();return repo?repo.readLock(WORKSPACE_LOCK_FILE):null};
  if(typeof writeWorkspaceLock==='function')writeWorkspaceLock=async function(lock){const repo=currentRepo();if(!repo)throw new Error('No workspace repository is connected.');await repo.writeLock(lock,WORKSPACE_LOCK_FILE)};
  if(typeof removeWorkspaceLock==='function')removeWorkspaceLock=async function(){const repo=currentRepo();if(!repo)return;const current=await repo.readLock(WORKSPACE_LOCK_FILE);if(current&&current.sessionId!==lockSessionId)return;await repo.deleteLock(WORKSPACE_LOCK_FILE)};

  if(typeof refreshBackupInventory==='function')refreshBackupInventory=async function(value=window.workspaceRepository){
    retainedBackupInventory=[];const repo=value?.listBackups?value:currentRepo();if(repo){try{for(const name of await repo.listBackups()){const date=parseBackupTimestamp(name);if(date)retainedBackupInventory.push({name,date})}}catch(e){log(`Could not list backups: ${e.message}`)}}retainedBackupInventory.sort((a,b)=>b.date-a.date);renderBackupInventory()
  };

  /* Expose one small application-facing adapter. New code should use this object rather than
     choosing local/remote implementations itself. A remote connector only needs to set a
     repository implementing the same contract. */
  window.amoWorkspace={
    get mode(){return currentRepo()?.mode||null},
    get connected(){return !!currentRepo()},
    get repository(){return currentRepo()},
    async listRecords(type){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.listJsonRecords(type)},
    async getSettings(){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.readJson('config/settings.json',{required:true})},
    async saveSettings(settings){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.writeJson('config/settings.json',settings)},
    async getStatusReport(id){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.getStatusReport(id)},
    async saveStatusReport(id,report){const repo=currentRepo();if(!repo)throw new Error('No workspace is connected.');return repo.saveStatusReport(id,report)},
    async acquireWriteAccess(){const repo=currentRepo();return !!repo&&repo.ensureWritePermission()},
    async runArchiveMaintenance(){return typeof archiveStaleTerminalDemand==='function'?archiveStaleTerminalDemand(currentRepo()):{demand:0,allocations:0}}
  };
})();
