/* Workspace tenant-domain convention + bidirectional Person/User linking UX.
   The configured tenant domain governs canonical Company / Entra accounts only. Google identities
   remain authentication bindings and are intentionally not rewritten. Person.userId remains the
   single source of truth for the optional 1:1 Person <-> User relationship. */
(function initTenantDomain(){
  if(window.__amoTenantDomainLoaded)return;window.__amoTenantDomainLoaded=true;

  const clean=v=>String(v??'').trim();
  const lower=v=>clean(v).toLowerCase();
  const esc=v=>typeof escHtml==='function'?escHtml(v):clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const settings=()=>{try{return db?.settings||null}catch{return null}};
  const tenantDomain=()=>lower(settings()?.tenantDomain||'').replace(/^@/,'');
  const users=()=>Array.isArray(settings()?.users)?settings().users:[];
  const people=()=>Array.isArray(db?.team)?db.team:[];
  const userById=id=>users().find(u=>String(u?.id||'')===String(id||''))||null;
  const personForUser=id=>people().find(p=>String(p?.userId||'')===String(id||''))||null;

  function validateDomain(value){
    const d=lower(value).replace(/^@/,'');
    if(!d)return'';
    if(!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(d))throw new Error('Enter a valid tenant domain, for example company.com.');
    return d
  }
  function normalizeEnterpriseAccount(value,{allowBlank=true,domain=tenantDomain()}={}){
    const raw=lower(value);if(!raw){if(allowBlank)return'';throw new Error('Company / Entra account is required.')}
    if(!domain)return raw;
    const at=raw.lastIndexOf('@');
    if(at<0)return`${raw}@${domain}`;
    const local=raw.slice(0,at),actual=raw.slice(at+1);if(!local)throw new Error('Enter a username before the @ sign.');
    if(actual!==domain)throw new Error(`Company / Entra account must use @${domain}.`);
    return`${local}@${domain}`
  }
  function validateExistingAgainstDomain(domain){
    const problems=[];
    for(const u of users()){const a=clean(u?.companyAccount);if(a){try{normalizeEnterpriseAccount(a,{domain})}catch{problems.push(`User ${u.displayName||u.id}: ${a}`)}}}
    for(const p of people()){if(p.userId)continue;const a=clean(p?.email);if(a){try{normalizeEnterpriseAccount(a,{domain})}catch{problems.push(`Person ${p.name||p.id}: ${a}`)}}}
    if(problems.length)throw new Error(`Existing enterprise identities do not match @${domain}:\n${problems.slice(0,8).join('\n')}${problems.length>8?'\n…':''}`)
  }

  async function saveTenantDomain(value){
    window.amoAccess?.require?.('system.configure');const domain=validateDomain(value);if(domain)validateExistingAgainstDomain(domain);
    const repo=window.workspaceRepository;if(!repo)throw new Error('Open a workspace first.');
    const latest=await repo.getSettings();latest.tenantDomain=domain;await repo.saveSettings(latest);
    db.settings={...db.settings,...structuredClone(latest)};db.configFiles=db.configFiles||{};db.configFiles['settings.json']=structuredClone(latest);configDirty=false;
    log?.(domain?`Tenant Domain set to ${domain}.`:'Tenant Domain cleared.');window.amoAccess?.refresh?.();renderConfig?.();renderGrid?.('team')
  }

  function renderTenantDomainCard(){
    const content=document.getElementById('configContent');if(!content)return;
    const active=content.querySelector('[data-settings-tab="organization"].active');if(!active)return;
    const grid=content.querySelector('.settings-grid');if(!grid||document.getElementById('amoTenantDomainCard'))return;
    const domain=tenantDomain(),canEdit=window.amoAccess?.can?.('system.configure')===true;
    const card=document.createElement('div');card.className='card';card.id='amoTenantDomainCard';
    card.innerHTML=`<div class="section-title" style="margin-top:0"><div><h2>Tenant Domain</h2><p class="muted config-description">Canonical Company / Entra domain used by People and AMO Users.</p></div></div><div class="settings-field"><label>Domain</label>${canEdit?`<div class="flex" style="gap:8px;align-items:center"><input class="cell-input" id="amoTenantDomainInput" value="${esc(domain)}" placeholder="company.com"><button class="btn success" id="amoTenantDomainSave">Save</button></div>`:`<strong>${domain?esc(domain):'Not configured'}</strong>`}<div class="settings-note" style="margin-top:6px">With a domain configured, entering <strong>username</strong> becomes <strong>username@${esc(domain||'company.com')}</strong>. Other domains are rejected.</div></div>`;
    grid.prepend(card);
    card.querySelector('#amoTenantDomainSave')?.addEventListener('click',async()=>{const btn=card.querySelector('#amoTenantDomainSave');try{btn.disabled=true;await saveTenantDomain(card.querySelector('#amoTenantDomainInput')?.value||'')}catch(e){alert(`Could not save Tenant Domain: ${e.message}`)}finally{btn.disabled=false}})
  }

  /* Config V2 rerenders internally, so observe only its content and only add one idempotent card. */
  function bindConfig(){const c=document.getElementById('configContent');if(!c)return false;const o=new MutationObserver(()=>renderTenantDomainCard());o.observe(c,{childList:true,subtree:true});renderTenantDomainCard();return true}
  if(!bindConfig()){let tries=0;const t=setInterval(()=>{if(bindConfig()||++tries>40)clearInterval(t)},100)}

  function normalizePerson(person){if(!person||person.userId)return person;person.email=normalizeEnterpriseAccount(person.email||'');return person}
  if(typeof saveTeamModal==='function'){
    const base=saveTeamModal;saveTeamModal=function(next){try{normalizePerson(next)}catch(e){alert(e.message);return}return base(next)}
  }
  if(typeof saveGrid==='function'){
    const base=saveGrid;saveGrid=function(name){if(name==='team'&&gridState.team?.draft){try{for(const p of gridState.team.draft)if(!gridState.team.deleted?.has(p.id))normalizePerson(p)}catch(e){alert(e.message);return}}return base(name)}
  }

  function wirePersonEmail(){
    if(recordModalState?.type!=='team'||recordModalState?.mode!=='edit')return;
    const input=document.querySelector('#recordModalBody [data-modal-field="email"]');if(!input||input.disabled||input.dataset.amoTenantBound)return;input.dataset.amoTenantBound='true';
    input.placeholder=tenantDomain()?`username or username@${tenantDomain()}`:'Company / Entra email';
    input.addEventListener('blur',()=>{try{input.value=normalizeEnterpriseAccount(input.value);input.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){alert(e.message);input.focus()}})
  }
  if(typeof renderRecordModal==='function'&&!renderRecordModal.__amoTenantDomain){const base=renderRecordModal,wrapped=function(){const r=base.apply(this,arguments);wirePersonEmail();return r};wrapped.__amoTenantDomain=true;renderRecordModal=wrapped}

  function linkUserToPerson(userId,personId){
    window.amoAccess?.require?.('people.write');const user=userById(userId);if(!user)throw new Error('User no longer exists.');
    const current=personForUser(userId),target=personId?people().find(p=>String(p.id)===String(personId)):null;
    if(target&&target.userId&&String(target.userId)!==String(userId)){const other=userById(target.userId);throw new Error(`${target.name||target.id} is already linked to ${other?.displayName||'another User'}.`)}
    if(current&&current!==target){current.userId='';dirtyRecords.team.add(current.id)}
    if(target){target.userId=user.id;if(window.amoPersonUserLink?.applyUserIdentity)window.amoPersonUserLink.applyUserIdentity(target);dirtyRecords.team.add(target.id)}
    updateBanner?.();requestAutosave?.();renderGrid?.('team');decorateUsersTable();
  }

  function decorateUsersTable(){
    const table=document.querySelector('#usersContent table.users-table');if(!table)return;
    const header=table.querySelector('thead tr');if(!header||header.querySelector('[data-amo-person-link-head]'))return;
    const th=document.createElement('th');th.dataset.amoPersonLinkHead='true';th.textContent='Person';const statusHead=header.lastElementChild;header.insertBefore(th,statusHead);
    [...table.querySelectorAll('tbody tr')].forEach((tr,index)=>{
      if(tr.querySelector('[data-amo-person-link-cell]'))return;const user=users()[index];if(!user)return;const td=document.createElement('td');td.dataset.amoPersonLinkCell='true';
      const current=personForUser(user.id),canLink=window.amoAccess?.can?.('people.write')===true;
      if(canLink){const select=document.createElement('select');select.className='cell-input';select.innerHTML=`<option value="">Not linked</option>${people().map(p=>`<option value="${esc(p.id)}" ${current?.id===p.id?'selected':''} ${p.userId&&String(p.userId)!==String(user.id)?'disabled':''}>${esc(p.name||p.id)}</option>`).join('')}`;select.title='Optional 1:1 link to a Person';select.addEventListener('change',()=>{try{linkUserToPerson(user.id,select.value)}catch(e){alert(e.message);decorateUsersTable()}});td.appendChild(select)}else td.innerHTML=current?'<span class="pill green">Linked</span>':'<span class="pill gray">No</span>';
      tr.insertBefore(td,tr.lastElementChild)
    })
  }

  function wireUserAccounts(){
    const root=document.getElementById('usersContent');if(!root)return;
    root.querySelectorAll('[data-user-field="companyAccount"]').forEach(input=>{if(input.dataset.amoTenantBound)return;input.dataset.amoTenantBound='true';input.placeholder=tenantDomain()?`username or username@${tenantDomain()}`:'Company / Entra account';input.addEventListener('blur',()=>{try{input.value=normalizeEnterpriseAccount(input.value,{allowBlank:false});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){alert(e.message);input.focus()}})});
    decorateUsersTable()
  }
  function bindUsers(){const root=document.getElementById('usersContent');if(!root)return false;const o=new MutationObserver(()=>{wireUserAccounts()});o.observe(root,{childList:true,subtree:true});wireUserAccounts();return true}
  if(!bindUsers()){let tries=0;const t=setInterval(()=>{if(bindUsers()||++tries>40)clearInterval(t)},100)}

  /* Capture Save Users so a typed local-part is normalized even if the field never lost focus. */
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#saveUsersBtn');if(!button)return;
    try{document.querySelectorAll('#usersContent [data-user-field="companyAccount"]').forEach(input=>{input.value=normalizeEnterpriseAccount(input.value,{allowBlank:false});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})}
    catch(e){event.preventDefault();event.stopImmediatePropagation();alert(e.message)}
  },true);

  /* Simplify People relationship display to a boolean Linked column. */
  if(typeof teamCols!=='undefined'){
    const linkCol=teamCols.find(c=>c.key==='userId');if(linkCol)linkCol.label='Linked'
  }
  if(typeof displayVal==='function'){
    const base=displayVal;displayVal=function(row,col){if(col?.key==='userId')return row?.userId?'Yes':'No';return base(row,col)}
  }

  window.amoTenantDomain={tenantDomain,normalizeEnterpriseAccount,validateDomain,saveTenantDomain,linkUserToPerson,personForUser};
})();
