/* Repair a partial Local recovery-module initialisation.
   app-backup-recovery.js historically marked itself loaded before exporting window.AmoRecovery.
   If startup failed after setting that guard, later attempts were permanently short-circuited.
   This shim clears only that stale guard; Restore can then retry the module deterministically. */
(function repairLocalRecoveryGuard(){
  const ready=()=>typeof window.AmoRecovery?.renderRestore==='function';
  if(!ready()&&window.__amoBackupRecoveryLoaded===true){
    window.__amoBackupRecoveryLoaded=false;
    console.warn('AMO cleared a stale Local recovery loaded flag because AmoRecovery was not initialised.');
  }
})();
