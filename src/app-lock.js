/* Cooperative workspace-level edit locking for the folder-backed MVP. */
const WORKSPACE_LOCK_FILE='.lock.json';
const LOCK_HEARTBEAT_MS=60000;
const LOCK_STALE_MS=15*60*1000;
const AMO_USER_KEY='amo.workspaceUser';
let workspaceLock=null,lockHeartbeatTimer=null,lockReplay=false;
const lockSessionId=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`);

function localWorkspaceUser(){
  try{return JSON.parse(localStorage.getItem(AMO_USER_KEY)||'null')}catch(e){return null}
}
function normalizeUserId(name){return String(name||'user').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'.').replace(/^\.+|\.+$/g,'')||'user'}
function ensureWorkspaceUser(){
  let user=localWorkspaceUser();
  if(user?.displayName&&user?.id)return user;
  const displayName=prompt('Enter your name for workspace edit locking. This is stored only in this browser.','')?.trim();
  if(!displayName)return null;
  user={id:normalizeUserId(displayName),displayName};
  localStorage.setItem(AMO_USER_KEY,JSON.stringify(user));
  renderLockStatus();
  return user;
}
function setWorkspaceUser(){
  const current=localWorkspaceUser();
  const displayName=prompt('Workspace user name',current?.displayName||'')?.trim();
  if(!displayName)return;
  const user={id:normalizeUserId(displayName),displayName};
  localStorage.setItem(AMO_USER_KEY,JSON.stringify(user));
  renderLockStatus();
}
async function readWorkspaceLock(){
  if(!workspaceHandle)return null;
  try{return await readNamedJson(workspaceHandle,WORKSPACE_LOCK_FILE,false)}catch(e){return null}
}
function lockAgeMs(lock){const t=Date.parse(lock?.heartbeatAt||lock?.acquiredAt||'');return Number.isFinite(t)?Date.now()-t:Number.POSITIVE_INFINITY}
function lockIsStale(lock){return !lock||lockAgeMs(lock)>LOCK_STALE_MS}
function lockOwnedByUs(lock=workspaceLock){return !!lock&&lock.sessionId===lockSessionId}
async function writeWorkspaceLock(lock){await writeJson(workspaceHandle,WORKSPACE_LOCK_FILE,lock)}
async function removeWorkspaceLock(){
  if(!workspaceHandle)return;
  try{const current=await readWorkspaceLock();if(current&&current.sessionId!==lockSessionId)return;await workspaceHandle.removeEntry(WORKSPACE_LOCK_FILE)}catch(e){if(e.name!=='NotFoundError')throw e}
}
function lockDescription(lock){
  if(!lock)return 'Read only · No edit lock';
  const who=escHtml(lock.userDisplayName||lock.userId||'Unknown user');
  const when=lock.acquiredAt?new Date(lock.acquiredAt).toLocaleString():'unknown time';
  return lockOwnedByUs(lock)?`Editing · Locked by you since ${when}`:`Read only · Locked by ${who} since ${when}`;
}
async function refreshObservedLock(){workspaceLock=await readWorkspaceLock();renderLockStatus();return workspaceLock}
function renderLockStatus(){
  let el=document.getElementById('workspaceLockStatus');
  if(!el){el=document.createElement('span');el.id='workspaceLockStatus';el.className='muted lock-status';document.getElementById('autoSaveStatus')?.after(el)}
  if(!workspaceHandle){el.textContent='';return}
  el.textContent=`· ${lockDescription(workspaceLock)}`;
  renderWorkspaceIdentityCard();
}
function renderWorkspaceIdentityCard(){
  const data=document.getElementById('data');if(!data)return;
  let card=document.getElementById('workspaceIdentityCard');
  if(!card){card=document.createElement('div');card.id='workspaceIdentityCard';card.className='card';card.style.marginTop='16px';const first=data.querySelector('.card');first?.after(card)}
  const user=localWorkspaceUser();
  card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Editing identity & lock</h2><p class="muted">Multiple users may read the workspace. Only the session holding <strong>${WORKSPACE_LOCK_FILE}</strong> may edit.</p></div><button class="btn" id="changeWorkspaceUser">Change identity</button></div><div class="mini-stat"><span>Browser identity</span><strong>${escHtml(user?.displayName||'Not set')}</strong></div><div class="mini-stat"><span>Workspace state</span><strong>${escHtml(workspaceLock?lockDescription(workspaceLock):'Read only · No edit lock')}</strong></div><div class="muted" style="margin-top:10px">Locks heartbeat every minute and are considered stale after 15 minutes. A stale lock can be taken over when an edit is requested.</div>`;
  document.getElementById('changeWorkspaceUser')?.addEventListener('click',setWorkspaceUser)
}
async function acquireWorkspaceLock(){
  if(!workspaceHandle)return false;
  const user=ensureWorkspaceUser();if(!user)return false;
  if(!await ensureRW(workspaceHandle)){alert('Read/write permission is required to edit this workspace.');return false}
  let current=await readWorkspaceLock();
  if(current&&current.sessionId===lockSessionId){workspaceLock=current;startLockHeartbeat();renderLockStatus();return true}
  if(current&&!lockIsStale(current)){
    workspaceLock=current;renderLockStatus();
    alert(`Workspace is currently locked for editing by ${current.userDisplayName||current.userId||'another user'} since ${current.acquiredAt?new Date(current.acquiredAt).toLocaleString():'an unknown time'}.`);
    return false
  }
  if(current&&lockIsStale(current)){
    const who=current.userDisplayName||current.userId||'another user';
    if(!confirm(`A stale workspace lock exists for ${who}. Last activity was ${current.heartbeatAt?new Date(current.heartbeatAt).toLocaleString():'unknown'}. Take over this lock?`)){workspaceLock=current;renderLockStatus();return false}
  }
  const now=new Date().toISOString();
  const ours={type:'amo-workspace-lock',sessionId:lockSessionId,userId:user.id,userDisplayName:user.displayName,acquiredAt:now,heartbeatAt:now,expiresAt:new Date(Date.now()+LOCK_STALE_MS).toISOString()};
  await writeWorkspaceLock(ours);
  const verify=await readWorkspaceLock();
  if(!verify||verify.sessionId!==lockSessionId){workspaceLock=verify;renderLockStatus();alert(`Could not acquire the workspace edit lock${verify?.userDisplayName?`; ${verify.userDisplayName} acquired it first`:''}.`);return false}
  workspaceLock=verify;startLockHeartbeat();renderLockStatus();log(`Workspace edit lock acquired by ${user.displayName}.`);return true
}
async function heartbeatWorkspaceLock(){
  if(!workspaceHandle||!lockOwnedByUs())return;
  const current=await readWorkspaceLock();
  if(!current||current.sessionId!==lockSessionId){workspaceLock=current;stopLockHeartbeat();renderLockStatus();alert('The workspace edit lock is no longer owned by this session. Further edits are blocked.');return}
  const now=new Date().toISOString();current.heartbeatAt=now;current.expiresAt=new Date(Date.now()+LOCK_STALE_MS).toISOString();await writeWorkspaceLock(current);workspaceLock=current;renderLockStatus()
}
function startLockHeartbeat(){stopLockHeartbeat();lockHeartbeatTimer=setInterval(()=>heartbeatWorkspaceLock().catch(e=>log(`Lock heartbeat error: ${e.message}`)),LOCK_HEARTBEAT_MS)}
function stopLockHeartbeat(){if(lockHeartbeatTimer){clearInterval(lockHeartbeatTimer);lockHeartbeatTimer=null}}
async function releaseWorkspaceLock(reason='Edit finished'){
  if(!lockOwnedByUs())return;
  try{await removeWorkspaceLock();log(`${reason}; workspace edit lock released.`)}catch(e){log(`ERROR releasing workspace lock: ${e.message}`);return}
  workspaceLock=null;stopLockHeartbeat();renderLockStatus()
}
async function flushThenReleaseLock(reason){
  if(dirtyCount())await flushAutosave();
  await releaseWorkspaceLock(reason)
}

/* An edit transaction begins on any explicit Create/Edit action. */
function isEditStartControl(target){
  const b=target.closest('button');if(!b)return false;
  if(b.id==='themeToggle'||b.id==='saveWorkspaceBtn'||b.id==='openWorkspaceBtn'||b.id==='exportBtn')return false;
  if(b.matches('[data-modal-edit],[data-grid-edit],[data-grid-new],[data-allocation-edit],[data-allocation-new],#editConfig,#editStatusDraft,#editRoadmap,#newIdeaBtn,#newDemandBtn'))return true;
  const text=b.textContent.trim().toLowerCase();
  return /^(edit|edit list|edit draft|edit roadmap|new demand|new team member|new allocation|new idea|\+ add|\+ add team)$/.test(text)
}
function isEditEndControl(target){
  const b=target.closest('button');if(!b)return false;
  if(b.matches('[data-modal-save],[data-modal-cancel],[data-grid-save],[data-grid-cancel],#saveConfig,#cancelConfig,#saveStatusDraft,#cancelStatusDraft,#saveRoadmap,#cancelRoadmap'))return true;
  const text=b.textContent.trim().toLowerCase();return /^(save|save changes|cancel)$/.test(text)
}
document.addEventListener('click',async e=>{
  if(lockReplay)return;
  if(isEditStartControl(e.target)&&workspaceHandle&&!lockOwnedByUs()){
    e.preventDefault();e.stopImmediatePropagation();
    try{if(await acquireWorkspaceLock()){lockReplay=true;const b=e.target.closest('button');b.click();lockReplay=false}}catch(err){lockReplay=false;alert(`Could not acquire edit lock: ${err.message}`);log(`ERROR acquiring lock: ${err.message}`)}
    return
  }
  if(isEditEndControl(e.target)&&lockOwnedByUs()){
    setTimeout(()=>flushThenReleaseLock('Edit transaction completed').catch(err=>log(`ERROR finalising edit lock: ${err.message}`)),0)
  }
},true);

/* Theme is a browser preference in multi-user mode: do not write shared config merely to change appearance. */
document.addEventListener('click',e=>{
  const b=e.target.closest('#themeToggle');if(!b)return;
  setTimeout(()=>{try{localStorage.setItem('amo.appearance',document.documentElement.dataset.theme||'light')}catch(_){}},0)
},true);

/* Observe lock when a workspace opens; reads remain available regardless of lock ownership. */
const lockOpenWorkspace=openWorkspace;
openWorkspace=async function(){
  await lockOpenWorkspace();if(!workspaceHandle)return;
  workspaceLock=await readWorkspaceLock();
  if(workspaceLock&&lockIsStale(workspaceLock))log(`Stale workspace lock detected for ${workspaceLock.userDisplayName||workspaceLock.userId||'unknown user'}.`);
  renderLockStatus()
};
const lockOpenBtn=document.getElementById('openWorkspaceBtn');if(lockOpenBtn)lockOpenBtn.onclick=()=>openWorkspace();

/* Keep the banner and Workspace tab lock information fresh. */
const lockUpdateBanner=updateBanner;
updateBanner=function(){lockUpdateBanner();renderLockStatus()};
setInterval(()=>{if(workspaceHandle&&!lockOwnedByUs())refreshObservedLock().catch(()=>{})},30000);
window.addEventListener('pagehide',()=>{stopLockHeartbeat()});

const lockStyles=document.createElement('style');lockStyles.textContent='.lock-status{white-space:nowrap}.lock-status strong{color:var(--ink)}';document.head.appendChild(lockStyles);
