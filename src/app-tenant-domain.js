/* Workspace tenant-domain convention and enterprise identity normalization.
   Settings presentation/persistence belongs to the canonical tabbed Settings editor and User <->
   Person mapping belongs to the Users edit transaction. This module owns only domain rules. */
(function initTenantDomain(){
  if(window.__amoTenantDomainLoaded)return;window.__amoTenantDomainLoaded=true;

  const clean=v=>String(v??'').trim();
  const lower=v=>clean(v).toLowerCase();
  const settings=()=>{try{return db?.settings||null}catch{return null}};
  const tenantDomain=()=>lower(settings()?.tenantDomain||'').replace(/^@/,'');
  const users=()=>Array.isArray(settings()?.users)?settings().users:[];
  const people=()=>Array.isArray(db?.team)?db.team:[];
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
  function validateExistingAgainstDomain(value){
    const domain=validateDomain(value);if(!domain)return domain;const problems=[];
    for(const u of users()){const a=clean(u?.companyAccount);if(a){try{normalizeEnterpriseAccount(a,{domain})}catch{problems.push(`User ${u.displayName||u.id}: ${a}`)}}}
    for(const p of people()){if(p.userId)continue;const a=clean(p?.email);if(a){try{normalizeEnterpriseAccount(a,{domain})}catch{problems.push(`Person ${p.name||p.id}: ${a}`)}}}
    if(problems.length)throw new Error(`Existing enterprise identities do not match @${domain}:\n${problems.slice(0,8).join('\n')}${problems.length>8?'\n…':''}`);return domain
  }

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

  function bindEnterpriseInput(input,{allowBlank=false}={}){
    if(!input||input.dataset.amoTenantBound)return;input.dataset.amoTenantBound='true';input.placeholder=tenantDomain()?`username or username@${tenantDomain()}`:'Company / Entra account';
    input.addEventListener('blur',()=>{try{input.value=normalizeEnterpriseAccount(input.value,{allowBlank});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){alert(e.message);input.focus()}})
  }
  function wireUserAccounts(){
    const root=document.getElementById('usersContent');if(!root)return;
    root.querySelectorAll('[data-user-field="companyAccount"]').forEach(input=>bindEnterpriseInput(input,{allowBlank:false}));bindEnterpriseInput(root.querySelector('#claimCompanyAccount'),{allowBlank:false})
  }
  function bindUsers(){const root=document.getElementById('usersContent');if(!root)return false;const o=new MutationObserver(()=>wireUserAccounts());o.observe(root,{childList:true,subtree:true});wireUserAccounts();return true}
  if(!bindUsers()){let tries=0;const t=setInterval(()=>{if(bindUsers()||++tries>40)clearInterval(t)},100)}

  /* Normalize fields even if Save/Claim is clicked before the input loses focus. */
  document.addEventListener('click',event=>{
    const save=event.target.closest?.('#saveUsersBtn'),claim=event.target.closest?.('#claimWorkspaceBtn');if(!save&&!claim)return;
    try{
      if(save)document.querySelectorAll('#usersContent [data-user-field="companyAccount"]').forEach(input=>{input.value=normalizeEnterpriseAccount(input.value,{allowBlank:false});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))});
      if(claim){const input=document.querySelector('#claimCompanyAccount');if(input)input.value=normalizeEnterpriseAccount(input.value,{allowBlank:false})}
    }catch(e){event.preventDefault();event.stopImmediatePropagation();alert(e.message)}
  },true);

  /* People show only whether a relationship exists; relationship editing is owned by Users. */
  if(typeof teamCols!=='undefined'){
    const linkCol=teamCols.find(c=>c.key==='userId');if(linkCol){linkCol.label='Linked';linkCol.editable=false}
  }
  if(typeof displayVal==='function'){
    const base=displayVal;displayVal=function(row,col){if(col?.key==='userId')return row?.userId?'Yes':'No';return base(row,col)}
  }

  window.amoTenantDomain={tenantDomain,normalizeEnterpriseAccount,validateDomain,validateExistingAgainstDomain,personForUser};
})();
