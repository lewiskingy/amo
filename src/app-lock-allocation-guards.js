/* Lock lifecycle and allocation selection safety refinements. */
(function initLockAndAllocationGuards(){
  const STALE_LOCK_MS=10*60*1000;
  if(typeof lockIsStale==='function')lockIsStale=function(lock){return !lock||lockAgeMs(lock)>STALE_LOCK_MS};
  if(typeof lockDescription==='function')lockDescription=function(lock){
    if(!lock)return'Read only · No edit lock';
    const who=lock.userDisplayName||lock.userId||'Unknown user',when=lock.acquiredAt?new Date(lock.acquiredAt).toLocaleString():'unknown time';
    if(lockOwnedByUs(lock))return`Editing · Locked by you since ${when}`;
    return lockIsStale(lock)?`Read only · Stale lock by ${who} since ${when}`:`Read only · Locked by ${who} since ${when}`
  };
  async function forceUnlockWorkspace(){
    const current=await readWorkspaceLock();if(!current){workspaceLock=null;renderLockStatus();alert('The workspace is not currently locked.');return}
    const who=current.userDisplayName||current.userId||'another user',stale=lockIsStale(current),last=current.heartbeatAt||current.acquiredAt;
    const warning=stale?`This lock for ${who} is stale${last?` (last heartbeat ${new Date(last).toLocaleString()})`:''}. Unlocking is safe only if that editing session is no longer active.\n\nUnlock workspace now?`:`CAUTION: ${who}'s edit lock is still active${last?` (last heartbeat ${new Date(last).toLocaleString()})`:''}. Forcing it open could allow two users to edit at once and overwrite each other's changes.\n\nForce unlock anyway?`;
    if(!confirm(warning))return;
    const repo=window.workspaceRepository||(workspaceHandle&&window.workspaceRepositoryForHandle?workspaceRepositoryForHandle(workspaceHandle):null);if(!repo?.deleteLock)throw new Error('The current workspace repository cannot remove locks.');
    await repo.deleteLock(WORKSPACE_LOCK_FILE);workspaceLock=null;stopLockHeartbeat();renderLockStatus();log(`Workspace lock for ${who} was explicitly overridden.`)
  }
  window.forceUnlockWorkspace=forceUnlockWorkspace;
  if(typeof renderWorkspaceIdentityCard==='function')renderWorkspaceIdentityCard=function(){
    const data=document.getElementById('data');if(!data)return;let card=document.getElementById('workspaceIdentityCard');if(!card){card=document.createElement('div');card.id='workspaceIdentityCard';card.className='card';card.style.marginTop='16px';const first=data.querySelector('.card');first?.after(card)}
    const user=localWorkspaceUser(),stale=workspaceLock&&lockIsStale(workspaceLock),canUnlock=!!workspaceLock&&!lockOwnedByUs(workspaceLock);
    card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Editing identity & lock</h2><p class="muted">Multiple users may read the workspace. Only the session holding <strong>${WORKSPACE_LOCK_FILE}</strong> may edit.</p></div><div class="toolbar"><button class="btn" id="changeWorkspaceUser">Change identity</button>${canUnlock?`<button class="btn danger" id="unlockWorkspace">Unlock workspace</button>`:''}</div></div><div class="mini-stat"><span>Browser identity</span><strong>${escHtml(user?.displayName||'Not set')}</strong></div><div class="mini-stat"><span>Workspace state</span><strong>${escHtml(lockDescription(workspaceLock))}</strong></div><div class="muted" style="margin-top:10px">Locks heartbeat every minute. After 10 minutes without a heartbeat they are stale and can be taken over on the next edit attempt.${stale?' This lock is stale and may be safely overridden only after confirming the other session has stopped editing.':''}</div>`;
    document.getElementById('changeWorkspaceUser')?.addEventListener('click',setWorkspaceUser);document.getElementById('unlockWorkspace')?.addEventListener('click',()=>forceUnlockWorkspace().catch(e=>{alert(`Could not unlock workspace: ${e.message}`);log(`ERROR unlocking workspace: ${e.message}`)}))
  };
  if(typeof renderLockStatus==='function')renderLockStatus();
  function allocationForInput(input){return allocationState?.draft?.find(a=>a.id===input.dataset.aid)}
  function usedResourceIdsForDemand(input){const current=allocationForInput(input);if(!current)return new Set();return new Set((allocationState.draft||[]).filter(a=>a.id!==current.id&&a.demandId===current.demandId&&!allocationState.deleted.has(a.id)&&a.teamMemberId).map(a=>a.teamMemberId))}
  function filterResourceOptions(input){if(!input?.matches?.('#allocationTable .alloc-resource-input'))return;const list=input.parentElement?.querySelector('.alloc-combo-list');if(!list)return;const used=usedResourceIdsForDemand(input);list.querySelectorAll('[data-resource-id]').forEach(option=>{if(used.has(option.dataset.resourceId))option.remove()});if(list.classList.contains('open')&&!list.querySelector('[data-resource-id]'))list.innerHTML='<div class="alloc-combo-empty">No other resources available for this Demand</div>'}
  function closeSelectedCombo(aid){requestAnimationFrame(()=>requestAnimationFrame(()=>{const input=document.querySelector(`#allocationTable .alloc-resource-input[data-aid="${CSS.escape(aid)}"]`);if(!input)return;input.parentElement?.querySelector('.alloc-combo-list')?.classList.remove('open');input.setAttribute('aria-expanded','false');input.blur()}))}
  document.addEventListener('focusin',e=>{if(e.target.matches?.('#allocationTable .alloc-resource-input'))setTimeout(()=>filterResourceOptions(e.target),0)},true);
  document.addEventListener('input',e=>{if(e.target.matches?.('#allocationTable .alloc-resource-input'))setTimeout(()=>filterResourceOptions(e.target),0)},true);
  document.addEventListener('mousedown',e=>{const option=e.target.closest?.('#allocationTable .alloc-combo-option[data-resource-id]');if(!option)return;const input=option.closest('.alloc-combobox')?.querySelector('.alloc-resource-input');if(input)closeSelectedCombo(input.dataset.aid)},true);
  document.addEventListener('keydown',e=>{const input=e.target.matches?.('#allocationTable .alloc-resource-input')?e.target:null;if(input&&e.key==='Enter')setTimeout(()=>closeSelectedCombo(input.dataset.aid),0)},true);
  document.addEventListener('click',e=>{const save=e.target.closest?.('#saveAllocations');if(!save||!allocationState?.editing)return;const seen=new Set(),duplicate=(allocationState.draft||[]).filter(a=>!allocationState.deleted.has(a.id)&&a.teamMemberId).find(a=>{const key=`${a.demandId}|${a.teamMemberId}`;if(seen.has(key))return true;seen.add(key);return false});if(!duplicate)return;e.preventDefault();e.stopImmediatePropagation();const resource=person(duplicate.teamMemberId)?.name||duplicate.teamMemberId;alert(`${resource} is already allocated to ${duplicate.demandId}. A Resource can appear only once under each Demand item.`)},true);
})();
