/* Authoritative AMO Users administration.
   Users are application identities; Team Members/People remain unchanged for now and can later
   reference User.id rather than redefining a person. */
(function initUsersAdmin(){
  const state={editing:false,draft:[],requireMapping:false,saving:false};
  const cloneValue=value=>structuredClone(value??[]);
  const esc=value=>typeof escHtml==='function'?escHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeEmail=value=>String(value||'').trim().toLowerCase();
  const currentSettings=()=>{try{return typeof db!=='undefined'?db.settings:null}catch{return null}};
  const currentUsers=()=>Array.isArray(currentSettings()?.users)?currentSettings().users:[];
  const currentRequireMapping=()=>currentSettings()?.accessControl?.writeRequiresMapping===true;
  const googleIdentity=user=>Array.isArray(user?.identities)?user.identities.find(x=>String(x?.provider||'').toLowerCase()==='google')||null:null;
  const createId=()=>`user-${crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  function ensureNavigation(){
    const admin=[...document.querySelectorAll('.sidebar nav details.nav-group')].find(x=>x.querySelector(':scope > summary')?.textContent?.trim()==='Admin');
    const items=admin?.querySelector(':scope > .nav-group-items');if(!items)return;
    let button=items.querySelector('[data-view="users"]');
    if(!button){button=document.createElement('button');button.className='nav-btn';button.dataset.view='users';button.innerHTML='<span class="nav-dot"></span>Users';button.addEventListener('click',()=>switchView('users'));const config=items.querySelector('[data-view="config"]');items.insertBefore(button,config||items.firstChild)}
    const content=document.querySelector('.content');if(!content||document.getElementById('users'))return;
    const section=document.createElement('section');section.id='users';section.className='view';section.innerHTML='<div class="hero"><div><h1>Users</h1><p>Manage authoritative AMO users and the external identities they can use to sign in.</p></div><div class="toolbar" id="usersToolbar"></div></div><div id="usersContent"></div>';content.appendChild(section)
  }

  function installStyles(){if(document.getElementById('amo-users-admin-styles'))return;const style=document.createElement('style');style.id='amo-users-admin-styles';style.textContent=`
    .users-summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.users-table input{min-width:140px;width:100%}.users-table .user-account{min-width:220px}.users-table .user-subject{min-width:240px}.users-note{margin-bottom:14px}.users-current-identity{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start}.users-current-identity strong{font-size:.76rem}.users-current-identity span{font-size:.76rem;color:var(--muted);overflow-wrap:anywhere}.users-policy{display:flex;align-items:flex-start;gap:9px;margin-top:14px}.users-policy input{margin-top:3px}@media(max-width:760px){.users-table{min-width:960px}}
  `;document.head.appendChild(style)}

  function effectiveRows(){return state.editing?state.draft:currentUsers()}
  function identitySummary(){
    const identity=window.amoAuth?.currentIdentity?.();if(!identity)return '<div class="notice users-note">You are not signed in. Users can be viewed, but editing requires Google sign-in.</div>';
    const principal=window.amoAccess?.currentPrincipal?.();
    return `<div class="card users-note"><div class="section-title" style="margin-top:0"><h2>Current sign-in</h2></div><div class="users-current-identity"><strong>Google</strong><span>${esc(identity.email||identity.name||'Signed in')}</span><strong>Subject</strong><span>${esc(identity.subject||'—')}</span><strong>AMO User</strong><span>${principal?.mapped?`${esc(principal.displayName)} · ${esc(principal.companyAccount||principal.id)}`:'Not currently mapped'}</span></div></div>`
  }
  function rowHtml(user,index){
    const google=googleIdentity(user)||{};
    if(!state.editing)return `<tr><td><strong>${esc(user.displayName||'—')}</strong><br><span class="muted">${esc(user.id||'')}</span></td><td>${esc(user.companyAccount||'—')}</td><td>${esc(google.email||'—')}</td><td><span class="muted">${esc(google.subject||'Not captured')}</span></td><td>${user.enabled===false?'<span class="pill gray">Disabled</span>':'<span class="pill green">Enabled</span>'}</td></tr>`;
    return `<tr data-user-row="${index}"><td><input data-user-field="displayName" value="${esc(user.displayName||'')}" placeholder="Display name"><div class="muted" style="margin-top:4px">${esc(user.id)}</div></td><td><input class="user-account" type="email" data-user-field="companyAccount" value="${esc(user.companyAccount||'')}" placeholder="some.body@company.com"></td><td><input type="email" data-google-field="email" value="${esc(google.email||'')}" placeholder="somebody@gmail.com"></td><td><input class="user-subject" data-google-field="subject" value="${esc(google.subject||'')}" placeholder="Optional until first known"><div style="margin-top:5px"><button class="btn" data-use-current-google="${index}">Use my Google identity</button></div></td><td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-user-enabled="${index}" ${user.enabled===false?'':'checked'}> Enabled</label><button class="btn danger" style="margin-top:6px" data-user-delete="${index}">Delete</button></td></tr>`
  }
  function render(){
    ensureNavigation();installStyles();const toolbar=document.getElementById('usersToolbar'),content=document.getElementById('usersContent');if(!toolbar||!content)return;
    const settings=currentSettings();if(!settings){toolbar.innerHTML='';content.innerHTML='<div class="notice">Open a workspace to view or manage Users.</div>';return}
    const rows=effectiveRows(),enabled=rows.filter(x=>x?.enabled!==false).length,mapped=rows.filter(x=>googleIdentity(x)?.email||googleIdentity(x)?.subject).length;
    toolbar.innerHTML=state.editing?'<button class="btn primary" id="addUserBtn">+ Add User</button><button class="btn success" id="saveUsersBtn">Save Users</button><button class="btn" id="cancelUsersBtn">Cancel</button>':'<button class="btn primary" id="editUsersBtn">Edit Users</button>';
    content.innerHTML=`${identitySummary()}<div class="users-summary"><span class="pill blue">${rows.length} user${rows.length===1?'':'s'}</span><span class="pill">${enabled} enabled</span><span class="pill">${mapped} Google mapping${mapped===1?'':'s'}</span></div><div class="notice users-note"><strong>Users are authoritative application identities.</strong> Company account is the canonical identity used for future roles, audit and ownership. Google is an authentication binding only. Existing People records are unchanged in this release.</div><div class="table-wrap"><table class="users-table"><thead><tr><th>User</th><th>Company / Entra account</th><th>Google email</th><th>Google subject</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map(rowHtml).join(''):'<tr><td colspan="5" class="muted">No Users configured yet.</td></tr>'}</tbody></table></div><label class="users-policy"><input type="checkbox" id="writeRequiresMapping" ${state.editing?'': 'disabled'} ${(state.editing?state.requireMapping:currentRequireMapping())?'checked':''}><span><strong>Require an approved User mapping for write access</strong><br><span class="muted">Leave off during initial rollout: any Google-authenticated user can edit. Turn on after approved Users have been configured; anonymous and unmapped users then remain read-only.</span></span></label>`;
    wire()
  }

  function beginEdit(){if(state.editing)return;state.editing=true;state.draft=cloneValue(currentUsers());state.requireMapping=currentRequireMapping();render()}
  function addUser(){state.draft.push({id:createId(),displayName:'',companyAccount:'',enabled:true,identities:[{provider:'google',email:'',subject:'',enabled:true}]});render()}
  function ensureGoogle(user){if(!Array.isArray(user.identities))user.identities=[];let binding=googleIdentity(user);if(!binding){binding={provider:'google',email:'',subject:'',enabled:true};user.identities.push(binding)}return binding}
  function mapCurrentGoogle(index){const identity=window.amoAuth?.currentIdentity?.();if(!identity){alert('Sign in with Google first.');return}const user=state.draft[index];if(!user)return;const binding=ensureGoogle(user);binding.email=identity.email||'';binding.subject=identity.subject||'';if(!user.displayName)user.displayName=identity.name||'';render()}
  function draftMapsIdentity(identity){
    if(!identity)return false;const provider=String(identity.provider||'').toLowerCase(),subject=String(identity.subject||''),email=normalizeEmail(identity.email);
    return state.draft.some(user=>user?.enabled!==false&&Array.isArray(user.identities)&&user.identities.some(binding=>{if(binding?.enabled===false||String(binding?.provider||'').toLowerCase()!==provider)return false;const configuredSubject=String(binding.subject||'');if(configuredSubject&&subject)return configuredSubject===subject;return !!email&&normalizeEmail(binding.email)===email}))
  }
  function validate(){
    const ids=new Set(),accounts=new Set(),googleEmails=new Set(),googleSubjects=new Set();
    for(const user of state.draft){
      user.displayName=String(user.displayName||'').trim();user.companyAccount=String(user.companyAccount||'').trim();if(!user.id)user.id=createId();
      if(!user.displayName||!user.companyAccount)throw new Error('Every User requires a display name and Company / Entra account.');
      if(ids.has(user.id))throw new Error(`Duplicate User ID: ${user.id}`);ids.add(user.id);
      const account=normalizeEmail(user.companyAccount);if(accounts.has(account))throw new Error(`Company account is already assigned: ${user.companyAccount}`);accounts.add(account);
      const google=ensureGoogle(user);google.email=String(google.email||'').trim();google.subject=String(google.subject||'').trim();
      const ge=normalizeEmail(google.email);if(ge&&googleEmails.has(ge))throw new Error(`Google email is already mapped: ${google.email}`);if(ge)googleEmails.add(ge);
      if(google.subject&&googleSubjects.has(google.subject))throw new Error('A Google subject ID is mapped to more than one User.');if(google.subject)googleSubjects.add(google.subject)
    }
    if(state.requireMapping&&!draftMapsIdentity(window.amoAuth?.currentIdentity?.()))throw new Error('Before requiring approved mappings, add the Google identity you are currently signed in with to an enabled User. This prevents you locking yourself out of editing.')
  }
  async function save(){
    if(state.saving)return;try{window.amoAccess?.require?.('system.configure');validate();state.saving=true;const repo=window.workspaceRepository;if(!repo)throw new Error('No workspace repository is connected.');const latest=await repo.getSettings();latest.users=cloneValue(state.draft);latest.accessControl={...(latest.accessControl||{}),writeRequiresMapping:!!state.requireMapping};await repo.saveSettings(latest);db.settings={...db.settings,...cloneValue(latest)};state.editing=false;state.draft=[];if(typeof log==='function')log(`Updated ${latest.users.length} AMO User profile${latest.users.length===1?'':'s'}.`);window.amoAccess?.refresh?.();render()
    }catch(e){alert(`Could not save Users: ${e.message}`)}finally{state.saving=false}
  }
  function cancel(){state.editing=false;state.draft=[];state.requireMapping=false;render()}
  function wire(){
    document.getElementById('editUsersBtn')?.addEventListener('click',beginEdit);document.getElementById('addUserBtn')?.addEventListener('click',addUser);document.getElementById('cancelUsersBtn')?.addEventListener('click',cancel);document.getElementById('saveUsersBtn')?.addEventListener('click',save);
    document.getElementById('writeRequiresMapping')?.addEventListener('change',e=>state.requireMapping=e.target.checked);
    document.querySelectorAll('[data-user-row]').forEach(row=>{const index=Number(row.dataset.userRow),user=state.draft[index];row.querySelectorAll('[data-user-field]').forEach(input=>input.addEventListener('input',e=>user[e.target.dataset.userField]=e.target.value));row.querySelectorAll('[data-google-field]').forEach(input=>input.addEventListener('input',e=>ensureGoogle(user)[e.target.dataset.googleField]=e.target.value))});
    document.querySelectorAll('[data-user-enabled]').forEach(input=>input.addEventListener('change',e=>state.draft[Number(e.target.dataset.userEnabled)].enabled=e.target.checked));
    document.querySelectorAll('[data-user-delete]').forEach(button=>button.addEventListener('click',()=>{state.draft.splice(Number(button.dataset.userDelete),1);render()}));
    document.querySelectorAll('[data-use-current-google]').forEach(button=>button.addEventListener('click',()=>mapCurrentGoogle(Number(button.dataset.useCurrentGoogle))))
  }

  ensureNavigation();render();window.addEventListener('amo-auth-changed',render);window.addEventListener('amo-access-changed',render);setTimeout(()=>{ensureNavigation();render()},100)
})();
