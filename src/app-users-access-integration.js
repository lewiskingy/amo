/* Keep People as workforce records and Users as authoritative application identities, while presenting them as one coherent administration experience. */
(function initUsersAccessIntegration(){
  if(window.__amoUsersAccessIntegrationLoaded)return;window.__amoUsersAccessIntegrationLoaded=true;
  const clean=value=>String(value??'').trim();
  const users=()=>Array.isArray(db?.settings?.users)?db.settings.users:[];
  const people=()=>Array.isArray(db?.team)?db.team:[];
  const userById=id=>users().find(user=>String(user?.id||'')===String(id||''))||null;
  const personForUser=id=>people().find(person=>String(person?.userId||'')===String(id||''))||null;
  const roles=user=>Array.isArray(user?.roles)?user.roles.map(x=>typeof x==='string'?x:x?.id).filter(Boolean):[];
  const esc=value=>typeof escHtml==='function'?escHtml(value):clean(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function accessLabel(user){
    if(!user)return'No application access';
    const name=clean(user.displayName)||clean(user.companyAccount)||'AMO User';
    if(user.enabled===false)return`${name} · Disabled`;
    const r=roles(user);if(r.includes('admin'))return`${name} · Admin`;if(r.includes('contributor'))return`${name} · Read-Write User`;return`${name} · Read only`
  }

  function administrationItems(){
    const modern=document.querySelector('.sidebar nav [data-amo-nav-section="administration"] > .nav-group-items');if(modern)return modern;
    const group=[...document.querySelectorAll('.sidebar nav details.nav-group')].find(x=>['Administration','Admin'].includes(x.querySelector(':scope > summary')?.textContent?.trim()));
    return group?.querySelector(':scope > .nav-group-items')||null
  }

  function ensureUsersSurface(){
    const content=document.querySelector('.content');if(!content)return null;
    let section=document.getElementById('users');
    if(!section){section=document.createElement('section');section.id='users';section.className='view';section.innerHTML='<div class="hero"><div><h1>Users & Access</h1><p>Manage authorised AMO users, authentication mappings, application roles and links to People.</p></div><div class="toolbar" id="usersToolbar"></div></div><div id="usersContent"></div>';content.appendChild(section)}
    const title=section.querySelector(':scope > .hero h1');if(title)title.textContent='Users & Access';
    const description=section.querySelector(':scope > .hero p');if(description)description.textContent='Manage authorised AMO users, authentication mappings, application roles and links to People.';
    return section
  }

  function ensureUsersNavigation(){
    const nav=document.querySelector('.sidebar nav');if(!nav)return null;
    let button=nav.querySelector('[data-view="users"]');
    if(!button){button=document.createElement('button');button.className='nav-btn';button.dataset.view='users';button.innerHTML='<span class="nav-dot"></span>Users & Access';button.addEventListener('click',()=>switchView('users'))}
    else{const dot=button.querySelector('.nav-dot');button.textContent='';if(dot)button.appendChild(dot);button.appendChild(document.createTextNode('Users & Access'))}
    const items=administrationItems();if(items&&button.parentElement!==items){const settings=items.querySelector('[data-view="config"]');items.insertBefore(button,settings||items.firstChild)}
    ensureUsersSurface();return button
  }

  function installPeoplePresentation(){
    if(typeof teamCols!=='undefined'&&Array.isArray(teamCols)){const col=teamCols.find(x=>x.key==='userId');if(col)col.label='AMO access'}
    if(typeof displayVal==='function'&&!displayVal.__amoUsersAccessIntegration){const base=displayVal;const wrapped=function(row,col){if(col?.key==='userId')return row?.userId?accessLabel(userById(row.userId)):'No application access';return base(row,col)};wrapped.__amoUsersAccessIntegration=true;displayVal=wrapped}
    if(typeof renderTeamModal==='function'&&!renderTeamModal.__amoUsersAccessIntegration){const base=renderTeamModal;const wrapped=function(record){let html=String(base(record));return html.replace(/>AMO User</g,'>AMO access<').replace('No AMO User is required. Company / Entra Email can be maintained manually until this Person is linked.','This Person does not currently have application access. Link an existing AMO User here, or use Users & Access to grant and manage access.').replace('Name and Company / Entra Email are managed from the linked AMO User. Unlink the User to edit them manually.','Identity is managed by the linked AMO User. Roles and authentication mappings are managed under Users & Access. Unlink the User to maintain this Person independently.')};wrapped.__amoUsersAccessIntegration=true;renderTeamModal=wrapped}
  }

  function decoratePeople(){
    installPeoplePresentation();const toolbar=document.getElementById('teamToolbar');if(toolbar&&!toolbar.querySelector('[data-manage-amo-access]')){const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.manageAmoAccess='true';button.textContent='Manage Users & Access';button.addEventListener('click',()=>switchView('users'));toolbar.appendChild(button)}
    const table=document.getElementById('teamTable');if(table){const header=[...table.querySelectorAll('thead th')].find(th=>th.textContent.trim()==='AMO User');if(header)header.textContent='AMO access'}
  }

  function decorateUsers(){
    ensureUsersNavigation();const section=ensureUsersSurface(),table=section?.querySelector('table.users-table');if(!table)return;
    const header=table.querySelector('thead tr');if(!header||header.querySelector('[data-amo-person-link-head]'))return;
    const th=document.createElement('th');th.dataset.amoPersonLinkHead='true';th.textContent='Person';header.children[0]?.after(th);
    [...table.querySelectorAll('tbody tr')].forEach(row=>{if(row.querySelector('[data-amo-person-link-cell]'))return;const first=row.children[0];if(!first)return;const userId=clean(first.querySelector('.muted')?.textContent);const person=personForUser(userId);const td=document.createElement('td');td.dataset.amoPersonLinkCell='true';td.innerHTML=person?`<strong>${esc(person.name||person.id)}</strong>`:'<span class="muted">Not linked</span>';first.after(td)})
  }

  function refresh(){ensureUsersNavigation();decoratePeople();decorateUsers();window.refreshAmoInformationArchitecture?.()}
  const usersContentObserver=new MutationObserver(()=>{const table=document.querySelector('#usersContent table.users-table');if(table&&!table.querySelector('[data-amo-person-link-head]'))queueMicrotask(decorateUsers)});
  function observeUsers(){const root=document.getElementById('usersContent');if(!root){setTimeout(observeUsers,100);return}usersContentObserver.observe(root,{childList:true,subtree:true});decorateUsers()}
  const peopleObserver=new MutationObserver(()=>queueMicrotask(decoratePeople));
  function observePeople(){const root=document.getElementById('team');if(!root)return;peopleObserver.observe(root,{childList:true,subtree:true});decoratePeople()}

  const originalSwitch=window.switchView;if(typeof originalSwitch==='function'&&!originalSwitch.__amoUsersAccessIntegration){const wrapped=function(id){const result=originalSwitch.apply(this,arguments);if(id==='users'||id==='team')queueMicrotask(refresh);return result};wrapped.__amoUsersAccessIntegration=true;window.switchView=wrapped}
  window.addEventListener('amo-workspace-connected',refresh);window.addEventListener('amo-access-changed',refresh);window.addEventListener('amo-auth-changed',refresh);

  function loadScript(path,marker,next){if(marker&&document.querySelector(`script[${marker}]`)){next?.();return}const s=document.createElement('script');s.src=typeof amoAsset==='function'?amoAsset(path):path;if(marker)s.setAttribute(marker,'true');s.onload=()=>next?.();s.onerror=()=>console.error(`Could not load ${path}`);document.head.appendChild(s)}
  const loadPersonLink=()=>{if(window.__amoPersonUserLinkLoaded){refresh();observeUsers();observePeople();return}loadScript('app-person-user-link.js','data-amo-person-user-link',()=>{refresh();observeUsers();observePeople()})};
  const afterUsersLoaded=()=>{ensureUsersNavigation();window.dispatchEvent(new CustomEvent('amo-access-changed'));loadPersonLink()};
  if(document.getElementById('usersContent'))loadPersonLink();else loadScript('app-users-admin.js','data-amo-users-admin',afterUsersLoaded);
  refresh();observePeople()
})();
