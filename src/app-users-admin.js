/* Authoritative AMO Users administration and minimal client-side RBAC.
   Users are application identities; Team Members/People remain unchanged for now and can later
   reference User.id rather than redefining a person. */
(function initUsersAdmin(){
  const state={editing:false,draft:[],saving:false};
  const cloneValue=value=>structuredClone(value??[]);
  const esc=value=>typeof escHtml==='function'?escHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeEmail=value=>String(value||'').trim().toLowerCase();
  const currentSettings=()=>{try{return typeof db!=='undefined'?db.settings:null}catch{return null}};
  const currentUsers=()=>Array.isArray(currentSettings()?.users)?currentSettings().users:[];
  const googleIdentity=user=>Array.isArray(user?.identities)?user.identities.find(x=>String(x?.provider||'').toLowerCase()==='google')||null:null;
  const createId=()=>`user-${crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const access=()=>window.amoAccess;
  const roles=()=>access()?.ROLE_DEFINITIONS||{};
  const writeCapabilities=()=>access()?.WRITE_CAPABILITIES||[];
  const capabilityLabels={
    'demand.write':'Demand','allocation.write':'Allocations','people.write':'People','ideas.write':'Ideas',
    'status.update':'Status updates','status.publish':'Publish status reports','system.configure':'Configuration',
    'users.manage':'Users & access','system.restore':'Restore / recovery'
  };

  function ensureNavigation(){
    const admin=[...document.querySelectorAll('.sidebar nav details.nav-group')].find(x=>x.querySelector(':scope > summary')?.textContent?.trim()==='Admin');
    const items=admin?.querySelector(':scope > .nav-group-items');if(!items)return;
    let button=items.querySelector('[data-view="users"]');
    if(!button){button=document.createElement('button');button.className='nav-btn';button.dataset.view='users';button.innerHTML='<span class="nav-dot"></span>Users';button.addEventListener('click',()=>switchView('users'));const config=items.querySelector('[data-view="config"]');items.insertBefore(button,config||items.firstChild)}
    const content=document.querySelector('.content');if(!content||document.getElementById('users'))return;
    const section=document.createElement('section');section.id='users';section.className='view';section.innerHTML='<div class="hero"><div><h1>Users</h1><p>Manage authoritative AMO users, authentication mappings and workspace permissions.</p></div><div class="toolbar" id="usersToolbar"></div></div><div id="usersContent"></div>';content.appendChild(section)
  }

  function installStyles(){if(document.getElementById('amo-users-admin-styles'))return;const style=document.createElement('style');style.id='amo-users-admin-styles';style.textContent=`
    .users-summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.users-table input[type=text],.users-table input[type=email]{min-width:140px;width:100%}.users-table .user-account{min-width:210px}.users-table .user-subject{min-width:210px}.users-note{margin-bottom:14px}.users-current-identity{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start}.users-current-identity strong{font-size:.76rem}.users-current-identity span{font-size:.76rem;color:var(--muted);overflow-wrap:anywhere}.users-access{display:grid;gap:5px;min-width:220px}.users-access label,.users-capabilities label{display:flex;gap:6px;align-items:flex-start;font-size:.76rem}.users-capabilities{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:5px 10px;margin-top:7px}.claim-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.claim-grid label{display:grid;gap:5px;font-size:.76rem;font-weight:800}.claim-grid input{width:100%}@media(max-width:760px){.users-table{min-width:1180px}.claim-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style)}

  function userRoles(user){return Array.isArray(user?.roles)?user.roles.map(x=>typeof x==='string'?x:x?.id).filter(Boolean):[]}
  function hasRole(user,id){return userRoles(user).includes(id)}
  function explicitCaps(user){return Array.isArray(user?.capabilities)?user.capabilities.map(String):[]}
  function effectiveRows(){return state.editing?state.draft:currentUsers()}
  function identitySummary(){
    const identity=window.amoAuth?.currentIdentity?.();if(!identity)return '<div class="notice users-note">You are not signed in. The workspace remains readable, but claiming or administration requires Google sign-in.</div>';
    const principal=access()?.currentPrincipal?.();return `<div class="card users-note"><div class="section-title" style="margin-top:0"><h2>Current sign-in</h2></div><div class="users-current-identity"><strong>Google</strong><span>${esc(identity.email||identity.name||'Signed in')}</span><strong>Subject</strong><span>${esc(identity.subject||'—')}</span><strong>AMO User</strong><span>${principal?.mapped?`${esc(principal.displayName)} · ${esc(principal.companyAccount||principal.id)}`:'Not currently approved'}</span><strong>Access</strong><span>${principal?.roles?.includes('admin')?'Admin':principal?.roles?.includes('contributor')?'Read-Write User':principal?.mapped?'Custom / read-only':'Read-only'}</span></div></div>`
  }

  function claimPanel(){
    if(access()?.claimed?.())return '';
    const identity=window.amoAuth?.currentIdentity?.();
    if(!identity)return '<div class="card users-note"><h2 style="margin-top:0">Workspace not claimed</h2><p>This workspace has no administrator. Sign in with Google to claim it. Until then everyone has read-only access.</p></div>';
    return `<div class="card users-note"><h2 style="margin-top:0">Claim this workspace</h2><p>Claiming is a one-time bootstrap action. It creates your authoritative AMO User, grants <strong>Admin</strong>, and from then on all other users require explicit access for anything beyond read-only.</p><div class="claim-grid"><label>Display name<input id="claimDisplayName" value="${esc(identity.name||'')}"></label><label>Company / Entra account<input id="claimCompanyAccount" type="email" placeholder="some.body@company.com"></label></div><div style="margin-top:12px"><button class="btn primary" id="claimWorkspaceBtn" data-amo-claim="true">Claim Workspace as Admin</button></div></div>`
  }

  function accessHtml(user,index){
    if(!state.editing){const r=userRoles(user),caps=explicitCaps(user);if(r.includes('admin'))return '<span class="pill green">Admin</span>';const parts=[];if(r.includes('contributor'))parts.push('<span class="pill blue">Read-Write User</span>');for(const cap of caps)parts.push(`<span class="pill">${esc(capabilityLabels[cap]||cap)}</span>`);return parts.join(' ')||'<span class="pill gray">Read only</span>'}
    const r=userRoles(user),caps=new Set(explicitCaps(user));return `<div class="users-access"><label><input type="checkbox" data-role="contributor" data-role-user="${index}" ${r.includes('contributor')?'checked':''}> <span><strong>Read-Write User</strong><br><span class="muted">Demand, allocations, People, Ideas and status updates</span></span></label><label><input type="checkbox" data-role="admin" data-role-user="${index}" ${r.includes('admin')?'checked':''}> <span><strong>Admin</strong><br><span class="muted">All capabilities including Users, Config and Restore</span></span></label><div class="users-capabilities">${writeCapabilities().filter(cap=>!access()?.CONTRIBUTOR_CAPABILITIES?.includes(cap)).map(cap=>`<label><input type="checkbox" data-capability="${esc(cap)}" data-cap-user="${index}" ${caps.has(cap)?'checked':''}> ${esc(capabilityLabels[cap]||cap)}</label>`).join('')}</div></div>`
  }

  function rowHtml(user,index){
    const google=googleIdentity(user)||{};
    if(!state.editing)return `<tr><td><strong>${esc(user.displayName||'—')}</strong><br><span class="muted">${esc(user.id||'')}</span></td><td>${esc(user.companyAccount||'—')}</td><td>${esc(google.email||'—')}</td><td><span class="muted">${esc(google.subject||'Not captured')}</span></td><td>${accessHtml(user,index)}</td><td>${user.enabled===false?'<span class="pill gray">Disabled</span>':'<span class="pill green">Enabled</span>'}</td></tr>`;
    return `<tr data-user-row="${index}"><td><input data-user-field="displayName" value="${esc(user.displayName||'')}" placeholder="Display name"><div class="muted" style="margin-top:4px">${esc(user.id)}</div></td><td><input class="user-account" type="email" data-user-field="companyAccount" value="${esc(user.companyAccount||'')}" placeholder="some.body@company.com"></td><td><input type="email" data-google-field="email" value="${esc(google.email||'')}" placeholder="somebody@gmail.com"></td><td><input class="user-subject" data-google-field="subject" value="${esc(google.subject||'')}" placeholder="Optional until first known"><div style="margin-top:5px"><button class="btn" data-use-current-google="${index}">Use my Google identity</button></div></td><td>${accessHtml(user,index)}</td><td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-user-enabled="${index}" ${user.enabled===false?'':'checked'}> Enabled</label><button class="btn danger" style="margin-top:6px" data-user-delete="${index}">Delete</button></td></tr>`
  }

  function render(){
    ensureNavigation();installStyles();const toolbar=document.getElementById('usersToolbar'),content=document.getElementById('usersContent');if(!toolbar||!content)return;const settings=currentSettings();if(!settings){toolbar.innerHTML='';content.innerHTML='<div class="notice">Open a workspace to view or manage Users.</div>';return}
    const claimed=access()?.claimed?.()===true,canManage=access()?.can?.('users.manage')===true,rows=effectiveRows(),enabled=rows.filter(x=>x?.enabled!==false).length,admins=rows.filter(x=>x?.enabled!==false&&hasRole(x,'admin')).length;
    toolbar.innerHTML=claimed?(state.editing?'<button class="btn primary" id="addUserBtn">+ Add User</button><button class="btn success" id="saveUsersBtn">Save Users</button><button class="btn" id="cancelUsersBtn">Cancel</button>':`<button class="btn primary" id="editUsersBtn" ${canManage?'':'disabled'}>Edit Users</button>`):'';
    content.innerHTML=`${claimPanel()}${identitySummary()}${claimed?`<div class="users-summary"><span class="pill blue">${rows.length} user${rows.length===1?'':'s'}</span><span class="pill">${enabled} enabled</span><span class="pill ${admins?'green':'red'}">${admins} admin${admins===1?'':'s'}</span></div><div class="notice users-note"><strong>Everyone can read.</strong> Only enabled Users explicitly granted a role or capability can write. <strong>Read-Write User</strong> is the normal operational role; <strong>Admin</strong> has every capability. Additional administrative capabilities can be granted individually.</div><div class="table-wrap"><table class="users-table"><thead><tr><th>User</th><th>Company / Entra account</th><th>Google email</th><th>Google subject</th><th>Access</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map(rowHtml).join(''):'<tr><td colspan="6" class="muted">No Users configured.</td></tr>'}</tbody></table></div>`:''}`;
    wire()
  }

  async function claimWorkspace(){
    const identity=window.amoAuth?.currentIdentity?.();if(!identity){alert('Sign in with Google first.');return}const displayName=String(document.getElementById('claimDisplayName')?.value||identity.name||'').trim(),companyAccount=String(document.getElementById('claimCompanyAccount')?.value||'').trim();if(!displayName||!companyAccount){alert('Display name and Company / Entra account are required to claim the workspace.');return}
    try{await access().runClaim(async()=>{const repo=window.workspaceRepository;if(!repo)throw new Error('No workspace repository is connected.');const latest=await repo.getSettings();if(latest.accessControl?.claimed===true)throw new Error('This workspace has already been claimed. Reload to see the current access configuration.');latest.users=Array.isArray(latest.users)?latest.users:[];const subject=String(identity.subject||''),email=normalizeEmail(identity.email);let user=latest.users.find(u=>Array.isArray(u.identities)&&u.identities.some(i=>String(i?.provider||'').toLowerCase()==='google'&&((subject&&String(i.subject||'')===subject)||(email&&normalizeEmail(i.email)===email))));if(!user){user={id:createId(),displayName,companyAccount,enabled:true,roles:['admin'],capabilities:[],identities:[{provider:'google',email:identity.email||'',subject:identity.subject||'',enabled:true}]};latest.users.push(user)}else{user.displayName=user.displayName||displayName;user.companyAccount=user.companyAccount||companyAccount;user.enabled=true;user.roles=[...new Set([...userRoles(user),'admin'])];const g=ensureGoogle(user);g.email=identity.email||g.email||'';g.subject=identity.subject||g.subject||'';g.enabled=true}latest.accessControl={...(latest.accessControl||{}),claimed:true,claimedAt:new Date().toISOString(),claimedByUserId:user.id,writeRequiresMapping:true};await repo.saveSettings(latest);db.settings={...db.settings,...cloneValue(latest)};if(typeof log==='function')log(`Workspace claimed by ${user.displayName} as Admin.`)});access().refresh();render()}catch(e){alert(`Could not claim workspace: ${e.message}`)}
  }

  function beginEdit(){if(state.editing)return;try{access()?.require?.('users.manage');state.editing=true;state.draft=cloneValue(currentUsers());render()}catch(e){alert(e.message)}}
  function addUser(){state.draft.push({id:createId(),displayName:'',companyAccount:'',enabled:true,roles:['contributor'],capabilities:[],identities:[{provider:'google',email:'',subject:'',enabled:true}]});render()}
  function ensureGoogle(user){if(!Array.isArray(user.identities))user.identities=[];let binding=googleIdentity(user);if(!binding){binding={provider:'google',email:'',subject:'',enabled:true};user.identities.push(binding)}return binding}
  function mapCurrentGoogle(index){const identity=window.amoAuth?.currentIdentity?.();if(!identity){alert('Sign in with Google first.');return}const user=state.draft[index];if(!user)return;const binding=ensureGoogle(user);binding.email=identity.email||'';binding.subject=identity.subject||'';if(!user.displayName)user.displayName=identity.name||'';render()}
  function setRole(index,role,enabled){const user=state.draft[index];if(!user)return;const next=new Set(userRoles(user));if(enabled)next.add(role);else next.delete(role);user.roles=[...next]}
  function setCapability(index,capability,enabled){const user=state.draft[index];if(!user)return;const next=new Set(explicitCaps(user));if(enabled)next.add(capability);else next.delete(capability);user.capabilities=[...next]}
  function validate(){
    const ids=new Set(),accounts=new Set(),googleEmails=new Set(),googleSubjects=new Set();let admins=0;
    for(const user of state.draft){user.displayName=String(user.displayName||'').trim();user.companyAccount=String(user.companyAccount||'').trim();if(!user.id)user.id=createId();if(!user.displayName||!user.companyAccount)throw new Error('Every User requires a display name and Company / Entra account.');if(ids.has(user.id))throw new Error(`Duplicate User ID: ${user.id}`);ids.add(user.id);const account=normalizeEmail(user.companyAccount);if(accounts.has(account))throw new Error(`Company account is already assigned: ${user.companyAccount}`);accounts.add(account);const google=ensureGoogle(user);google.email=String(google.email||'').trim();google.subject=String(google.subject||'').trim();const ge=normalizeEmail(google.email);if(ge&&googleEmails.has(ge))throw new Error(`Google email is already mapped: ${google.email}`);if(ge)googleEmails.add(ge);if(google.subject&&googleSubjects.has(google.subject))throw new Error('A Google subject ID is mapped to more than one User.');if(google.subject)googleSubjects.add(google.subject);user.roles=[...new Set(userRoles(user).filter(r=>roles()[r]))];user.capabilities=[...new Set(explicitCaps(user).filter(c=>writeCapabilities().includes(c)))];if(user.enabled!==false&&user.roles.includes('admin'))admins++}
    if(access()?.claimed?.()&&admins<1)throw new Error('A claimed workspace must always have at least one enabled Admin.')
  }
  async function save(){if(state.saving)return;try{access()?.require?.('users.manage');validate();state.saving=true;const repo=window.workspaceRepository;if(!repo)throw new Error('No workspace repository is connected.');const latest=await repo.getSettings();latest.users=cloneValue(state.draft);latest.accessControl={...(latest.accessControl||{}),claimed:true,writeRequiresMapping:true};await repo.saveSettings(latest);db.settings={...db.settings,...cloneValue(latest)};state.editing=false;state.draft=[];if(typeof log==='function')log(`Updated ${latest.users.length} AMO User profile${latest.users.length===1?'':'s'}.`);access()?.refresh?.();render()}catch(e){alert(`Could not save Users: ${e.message}`)}finally{state.saving=false}}
  function cancel(){state.editing=false;state.draft=[];render()}
  function wire(){
    document.getElementById('claimWorkspaceBtn')?.addEventListener('click',claimWorkspace);document.getElementById('editUsersBtn')?.addEventListener('click',beginEdit);document.getElementById('addUserBtn')?.addEventListener('click',addUser);document.getElementById('cancelUsersBtn')?.addEventListener('click',cancel);document.getElementById('saveUsersBtn')?.addEventListener('click',save);
    document.querySelectorAll('[data-user-row]').forEach(row=>{const index=Number(row.dataset.userRow),user=state.draft[index];row.querySelectorAll('[data-user-field]').forEach(input=>input.addEventListener('input',e=>user[e.target.dataset.userField]=e.target.value));row.querySelectorAll('[data-google-field]').forEach(input=>input.addEventListener('input',e=>ensureGoogle(user)[e.target.dataset.googleField]=e.target.value))});
    document.querySelectorAll('[data-user-enabled]').forEach(input=>input.addEventListener('change',e=>state.draft[Number(e.target.dataset.userEnabled)].enabled=e.target.checked));document.querySelectorAll('[data-role-user]').forEach(input=>input.addEventListener('change',e=>setRole(Number(e.target.dataset.roleUser),e.target.dataset.role,e.target.checked)));document.querySelectorAll('[data-cap-user]').forEach(input=>input.addEventListener('change',e=>setCapability(Number(e.target.dataset.capUser),e.target.dataset.capability,e.target.checked)));
    document.querySelectorAll('[data-user-delete]').forEach(button=>button.addEventListener('click',()=>{state.draft.splice(Number(button.dataset.userDelete),1);render()}));document.querySelectorAll('[data-use-current-google]').forEach(button=>button.addEventListener('click',()=>mapCurrentGoogle(Number(button.dataset.useCurrentGoogle))))
  }

  ensureNavigation();render();window.addEventListener('amo-auth-changed',render);window.addEventListener('amo-access-changed',render);setTimeout(()=>{ensureNavigation();render()},100)
})();
