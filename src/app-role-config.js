/* Roles are first-class Organization settings referenced by People.
   The authoritative Config controller performs some internal renders without calling the global
   renderConfig wrapper, so this module observes the Config host and mounts the Role editor after
   every Organization render. */
(function initRoleConfig(){
  if(window.__amoRoleConfigLoaded)return;window.__amoRoleConfigLoaded=true;
  const scope=window.AMO_CONFIG_SCOPES?.organization;if(scope&&!scope.keys.includes('roles'))scope.keys.push('roles');
  const state=window.AMO_CONFIG_PAGE_STATE;
  const nextId=roles=>{let n=1,id='';do{id=`ROLE-${String(n++).padStart(2,'0')}`}while(roles.some(r=>r.id===id));return id};

  function rolesForPage(){const settings=state?.editingTab==='organization'?state.draft:db.settings;return normalizeRoles(settings?.roles||[])}
  function validateRoles(){
    if(!state?.draft)return null;state.draft.roles=normalizeRoles(state.draft.roles||[]);const roles=state.draft.roles;
    if(new Set(roles.map(r=>r.id.toLowerCase())).size!==roles.length)return'Role IDs must be unique.';
    if(new Set(roles.map(r=>r.name.toLowerCase())).size!==roles.length)return'Role names must be unique.';
    if(roles.some(r=>!r.id||!r.name))return'Every Role must have an ID and Name.';
    if(roles.some(r=>!Number.isFinite(Number(r.dayRate))||Number(r.dayRate)<0))return'Role day rates must be zero or greater.';
    for(const p of db.team||[])if(p.roleId&&!roles.some(r=>r.id===p.roleId))return`Cannot remove Role ${p.roleId}; user ${p.id} still references it.`;
    return null
  }
  function syncPersonRoleAliases(){for(const p of db.team||[]){const name=roleById(p.roleId)?.name||'';if(String(p.role||'')!==name){p.role=name;if(typeof markDirty==='function')markDirty('team',p.id,`Aligned ${p.id} Role display name to ${name||'Unassigned'}.`)}}}
  function roleCard(){
    const editing=state?.editingTab==='organization',roles=rolesForPage();
    const rows=roles.map((r,i)=>`<tr><td><strong>${escHtml(r.id)}</strong></td><td>${editing?`<input class="cell-input" data-role-name="${i}" value="${escHtml(r.name)}">`:escHtml(r.name)}</td><td>${editing?`<input class="cell-input role-rate-input" type="number" min="0" step="25" data-role-rate="${i}" value="${Number(r.dayRate)||0}">`:`£${(Number(r.dayRate)||0).toLocaleString('en-GB')} / day`}</td>${editing?`<td><button class="btn danger" data-role-delete="${i}">Delete</button></td>`:''}</tr>`).join('');
    return `<div class="card settings-card-wide roles-settings-card"><div class="section-title" style="margin-top:0"><div><h2>Roles &amp; Day Rates</h2><p class="muted config-description">Canonical Roles referenced by People. Day Rate drives billable capacity and allocation £; use £0 for roles whose work is not funded from this area.</p></div></div><div class="table-wrap"><table class="roles-settings-table"><thead><tr><th>Role ID</th><th>Role</th><th>Day Rate</th>${editing?'<th></th>':''}</tr></thead><tbody>${rows||`<tr><td colspan="${editing?4:3}" class="muted">No Roles configured.</td></tr>`}</tbody></table></div>${editing?'<button class="btn settings-add" id="settingsAddRole">+ Add Role</button>':''}<div class="settings-note">Financial planning uses Allocation → Person → Role → Day Rate. £0/day roles still contribute delivery FTE but no billable capacity/value.</div></div>`
  }
  function wireRoleEditor(){
    if(state?.editingTab!=='organization')return;const s=state.draft;s.roles=normalizeRoles(s.roles||[]);
    document.querySelectorAll('[data-role-name]').forEach(el=>el.oninput=e=>s.roles[Number(e.target.dataset.roleName)].name=e.target.value);
    document.querySelectorAll('[data-role-rate]').forEach(el=>el.oninput=e=>s.roles[Number(e.target.dataset.roleRate)].dayRate=Math.max(0,Number(e.target.value)||0));
    document.querySelectorAll('[data-role-delete]').forEach(b=>b.onclick=()=>{const role=s.roles[Number(b.dataset.roleDelete)],used=(db.team||[]).find(p=>p.roleId===role?.id);if(used){alert(`Cannot remove Role ${role.id}; user ${used.id} still references it.`);return}s.roles.splice(Number(b.dataset.roleDelete),1);renderConfig()});
    $('settingsAddRole')?.addEventListener('click',()=>{const id=nextId(s.roles);s.roles.push({id,name:'New Role',dayRate:0});renderConfig()});
    const save=$('saveSettingsTab');if(save&&!save.dataset.roleSaveWired){const clean=save.cloneNode(true);clean.dataset.roleSaveWired='true';save.replaceWith(clean);clean.addEventListener('click',async()=>{const error=validateRoles();if(error){alert(error);return}await saveConfigChanges();if(!state.editingTab)syncPersonRoleAliases();ensureRoleCard()})}
  }
  function ensureRoleCard(){
    if(!workspaceHandle||state?.activeTab!=='organization')return;
    const grid=$('configContent')?.querySelector('.settings-grid');if(!grid||grid.querySelector('.roles-settings-card'))return;
    grid.insertAdjacentHTML('beforeend',roleCard());wireRoleEditor()
  }

  if(!document.getElementById('role-config-styles')){const s=document.createElement('style');s.id='role-config-styles';s.textContent='.roles-settings-table{min-width:620px}.roles-settings-table th:nth-child(3),.roles-settings-table td:nth-child(3){text-align:right}.role-rate-input{max-width:150px;text-align:right}';document.head.appendChild(s)}
  const host=$('configContent');if(host){const observer=new MutationObserver(()=>queueMicrotask(ensureRoleCard));observer.observe(host,{childList:true,subtree:true});window.__amoRoleConfigObserver=observer}
  ensureRoleCard();
})();
