/* AMO client-side access-control facade.
   This layer controls application behaviour in both Local and Remote Workspace modes. It is
   intentionally not a security boundary for Remote Workspace: the API must independently enforce
   the same capabilities before private routes are enabled. */
(function initAmoAccess(){
  const CAPABILITIES=Object.freeze({
    workspaceRead:'workspace.read',workspaceWrite:'workspace.write',workspaceClaim:'workspace.claim',
    demandRead:'demand.read',demandWrite:'demand.write',allocationRead:'allocation.read',allocationWrite:'allocation.write',
    peopleRead:'people.read',peopleWrite:'people.write',ideasRead:'ideas.read',ideasWrite:'ideas.write',
    statusRead:'status.read',statusUpdate:'status.update',statusPublish:'status.publish',financialRead:'financial.read',
    systemConfigure:'system.configure',usersManage:'users.manage',systemRestore:'system.restore'
  });
  const READ_CAPABILITIES=new Set([CAPABILITIES.workspaceRead,CAPABILITIES.demandRead,CAPABILITIES.allocationRead,CAPABILITIES.peopleRead,CAPABILITIES.ideasRead,CAPABILITIES.statusRead,CAPABILITIES.financialRead]);
  const WRITE_CAPABILITIES=[CAPABILITIES.demandWrite,CAPABILITIES.allocationWrite,CAPABILITIES.peopleWrite,CAPABILITIES.ideasWrite,CAPABILITIES.statusUpdate,CAPABILITIES.statusPublish,CAPABILITIES.systemConfigure,CAPABILITIES.usersManage,CAPABILITIES.systemRestore];
  const CONTRIBUTOR_CAPABILITIES=[CAPABILITIES.demandWrite,CAPABILITIES.allocationWrite,CAPABILITIES.peopleWrite,CAPABILITIES.ideasWrite,CAPABILITIES.statusUpdate];
  const ROLE_DEFINITIONS=Object.freeze({
    contributor:{id:'contributor',label:'Read-Write User',description:'Normal operational editing without administration.',capabilities:CONTRIBUTOR_CAPABILITIES},
    admin:{id:'admin',label:'Admin',description:'Full workspace administration and all write capabilities.',capabilities:WRITE_CAPABILITIES}
  });
  const listeners=new Set();let authLoadPromise=null,observer=null,refreshQueued=false,claimDepth=0;

  function settings(){try{return typeof db!=='undefined'?db?.settings||{}:{}}catch{return{}}}
  function accessConfig(){const raw=settings().accessControl;return raw&&typeof raw==='object'?raw:{}}
  function workspaceClaimed(){return accessConfig().claimed===true}
  function users(){const value=settings().users;return Array.isArray(value)?value.filter(x=>x&&x.enabled!==false):[]}
  function identitiesFor(user){return Array.isArray(user?.identities)?user.identities.filter(x=>x&&x.enabled!==false):[]}
  function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
  function currentAuthIdentity(){return window.amoAuth?.currentIdentity?.()||null}
  function resolveUser(identity=currentAuthIdentity()){
    if(!identity)return null;const provider=String(identity.provider||'').toLowerCase(),subject=String(identity.subject||identity.objectId||''),email=normalizeEmail(identity.email||identity.username);
    return users().find(user=>identitiesFor(user).some(binding=>{if(String(binding.provider||'').toLowerCase()!==provider)return false;const configuredSubject=String(binding.subject||binding.providerSubject||binding.objectId||'');if(configuredSubject&&subject)return configuredSubject===subject;return !!email&&normalizeEmail(binding.email||binding.providerEmail||binding.username)===email}))||null
  }
  function resolveIdentityBinding(identity=currentAuthIdentity()){
    const user=resolveUser(identity);if(!user||!identity)return null;const provider=String(identity.provider||'').toLowerCase(),subject=String(identity.subject||identity.objectId||''),email=normalizeEmail(identity.email||identity.username);
    return identitiesFor(user).find(binding=>{if(String(binding.provider||'').toLowerCase()!==provider)return false;const configuredSubject=String(binding.subject||binding.providerSubject||binding.objectId||'');if(configuredSubject&&subject)return configuredSubject===subject;return !!email&&normalizeEmail(binding.email||binding.providerEmail||binding.username)===email})||null
  }
  function roleIds(user){const roles=Array.isArray(user?.roles)?user.roles:[];return roles.map(x=>typeof x==='string'?x:x?.id).filter(Boolean)}
  function explicitCapabilities(user){return Array.isArray(user?.capabilities)?user.capabilities.map(String):[]}
  function effectiveCapabilities(user){
    if(!user)return new Set();const out=new Set(explicitCapabilities(user));
    for(const role of roleIds(user)){for(const capability of ROLE_DEFINITIONS[role]?.capabilities||[])out.add(capability)}
    return out
  }
  function currentPrincipal(){
    const identity=currentAuthIdentity();if(!identity)return{authenticated:false,mapped:false,kind:'anonymous',id:'anonymous',displayName:'Anonymous',companyAccount:'',identity:null,user:null,binding:null,roles:[],capabilities:[]};
    const user=resolveUser(identity),binding=user?resolveIdentityBinding(identity):null,companyAccount=String(user?.companyAccount||user?.entraAccount||user?.workAccount||'').trim(),caps=[...effectiveCapabilities(user)];
    return{authenticated:true,mapped:!!user,kind:user?'mapped':'authenticated',id:String(user?.id||companyAccount||identity.subject||identity.email||'authenticated-user'),displayName:String(user?.displayName||identity.name||companyAccount||identity.email||'Authenticated user'),companyAccount,identity,user,binding,roles:roleIds(user),capabilities:caps}
  }
  function canClaim(){return !workspaceClaimed()&&!!currentAuthIdentity()}
  function can(capability){
    const name=String(capability||'');if(READ_CAPABILITIES.has(name)||name.endsWith('.read'))return true;if(name===CAPABILITIES.workspaceClaim)return canClaim();
    const principal=currentPrincipal();if(!workspaceClaimed()||!principal.mapped)return false;
    const caps=effectiveCapabilities(principal.user);if(name===CAPABILITIES.workspaceWrite)return WRITE_CAPABILITIES.some(x=>caps.has(x));return caps.has(name)
  }
  function requireCapability(capability,message){if(can(capability))return true;const principal=currentPrincipal();let fallback='You do not have permission to make this change.';if(!principal.authenticated)fallback='AMO is read-only until you sign in with Google.';else if(!workspaceClaimed())fallback='This workspace must be claimed before editing is enabled.';else if(!principal.mapped)fallback='Your Google identity is not linked to an approved AMO User.';throw new Error(message||fallback)}
  function accessMode(){return can(CAPABILITIES.workspaceWrite)?'read-write':'read-only'}
  function notify(){const state={mode:accessMode(),principal:currentPrincipal(),claimed:workspaceClaimed(),canClaim:canClaim()};listeners.forEach(fn=>{try{fn(state)}catch(_e){}});try{window.dispatchEvent(new CustomEvent('amo-access-changed',{detail:state}))}catch(_e){}}

  function viewCapability(viewId,text=''){
    const t=String(text||'');if(viewId==='users')return CAPABILITIES.usersManage;if(viewId==='config')return CAPABILITIES.systemConfigure;if(viewId==='demand')return CAPABILITIES.demandWrite;if(viewId==='allocations')return CAPABILITIES.allocationWrite;if(viewId==='team')return CAPABILITIES.peopleWrite;if(viewId==='ideas')return CAPABILITIES.ideasWrite;
    if(viewId==='status-report')return /publish|unpublish/i.test(t)?CAPABILITIES.statusPublish:CAPABILITIES.statusUpdate;if(viewId==='data'&&/restore/i.test(t))return CAPABILITIES.systemRestore;return CAPABILITIES.workspaceWrite
  }
  function mutationButton(button){
    if(!(button instanceof HTMLElement)||button.closest('.amo-auth-profile'))return false;if(button.dataset.amoReadonlyAllow==='true'||button.dataset.amoClaim==='true')return false;if(button.dataset.amoWrite==='true'||button.dataset.amoCapability)return true;
    const id=String(button.id||'');if(['saveWorkspaceBtn','newDemandBtn'].includes(id))return true;const text=String(button.textContent||'').replace(/\s+/g,' ').trim();return /^(?:\+\s*)?(?:new\b|add\b|edit\b|save\b|delete\b|remove\b|publish\b|unpublish\b|restore\b|archive\b|allocate\b|create\b|discard\s+and\s+save\b|change\s+identity\b)/i.test(text)
  }
  function capabilityForElement(element){
    if(element?.dataset?.amoCapability)return element.dataset.amoCapability;if(element?.id==='newDemandBtn')return CAPABILITIES.demandWrite;
    const section=element?.closest?.('section.view'),active=section?.id||document.querySelector('section.view.active')?.id||'';return viewCapability(active,element?.textContent||'')
  }
  function setAccessDisabled(element,disabled,capability=''){
    if(disabled){if(!element.disabled){element.disabled=true;element.dataset.amoAccessDisabled='true';element.title=element.title||`Permission required${capability?`: ${capability}`:''}.`}}else if(element.dataset.amoAccessDisabled==='true'){element.disabled=false;delete element.dataset.amoAccessDisabled}
  }
  function applyModalAccess(){
    const modal=document.getElementById('recordModalBody');if(!modal)return;const active=document.querySelector('section.view.active')?.id||'',required=viewCapability(active,'edit');const allowed=can(required);
    modal.querySelectorAll('input,select,textarea,[contenteditable="true"]').forEach(el=>{if(el.dataset.amoReadonlyAllow==='true')return;if('disabled'in el)setAccessDisabled(el,!allowed,required);else if(!allowed){el.dataset.amoAccessContenteditable=el.getAttribute('contenteditable')||'true';el.setAttribute('contenteditable','false')}else if(el.dataset.amoAccessContenteditable){el.setAttribute('contenteditable',el.dataset.amoAccessContenteditable);delete el.dataset.amoAccessContenteditable}});
    modal.querySelectorAll('button').forEach(button=>{if(mutationButton(button)){const capability=button.dataset.amoCapability||required;setAccessDisabled(button,!can(capability),capability)}})
  }
  function setIfChanged(element,key,value){if(element[key]!==value)element[key]=value}
  function renderAccessBadge(){
    const host=document.querySelector('.workspace-banner .flex');if(!host)return;let badge=document.getElementById('amoAccessMode');if(!badge){badge=document.createElement('span');badge.id='amoAccessMode';badge.className='pill';host.appendChild(badge)}const principal=currentPrincipal();
    let className='pill',text='Read only';
    if(!workspaceClaimed())text=principal.authenticated?'Unclaimed · claim to administer':'Unclaimed · read only';
    else if(can(CAPABILITIES.workspaceWrite)){className='pill green';text=principal.roles.includes('admin')?'Admin access':'Edit enabled'}
    else text=principal.authenticated?'Read only · access not granted':'Read only';
    setIfChanged(badge,'className',className);setIfChanged(badge,'textContent',text);setIfChanged(badge,'title',principal.companyAccount?`Acting as ${principal.companyAccount}`:(principal.identity?.email||''))
  }
  function applyUiState(){
    refreshQueued=false;document.documentElement.dataset.amoAccessMode=accessMode();document.querySelectorAll('button').forEach(button=>{if(!mutationButton(button))return;const capability=capabilityForElement(button);setAccessDisabled(button,!can(capability),capability)});applyModalAccess();renderAccessBadge()
  }
  function scheduleUiRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(applyUiState)}
  function observeUi(){
    if(observer)return;
    observer=new MutationObserver(records=>{
      const relevant=records.some(record=>{
        const target=record.target instanceof Element?record.target:record.target?.parentElement;
        if(target?.closest?.('#amoAccessMode,#amoCurrentUser'))return false;
        return true
      });
      if(relevant)scheduleUiRefresh()
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','contenteditable']});scheduleUiRefresh()
  }

  function persistenceWriteAllowed(){return claimDepth>0&&canClaim()||can(CAPABILITIES.workspaceWrite)}
  function guardLocalRepository(){
    const C=window.LocalWorkspaceRepository;if(!C||C.prototype.__amoAccessGuarded)return;const p=C.prototype,originalEnsure=p.ensureWritePermission,originalWrite=p.writeJson,originalDelete=p.deletePath;
    p.ensureWritePermission=async function(...args){if(!persistenceWriteAllowed())return false;return originalEnsure.apply(this,args)};p.writeJson=async function(...args){if(!persistenceWriteAllowed())requireCapability(CAPABILITIES.workspaceWrite);return originalWrite.apply(this,args)};p.deletePath=async function(...args){if(!persistenceWriteAllowed())requireCapability(CAPABILITIES.workspaceWrite);return originalDelete.apply(this,args)};p.__amoAccessGuarded=true
  }
  function guardRemoteInstance(repo){
    if(!repo||repo.mode!=='remote'||repo.__amoAccessGuardedRequest||typeof repo.request!=='function')return repo;const original=repo.request.bind(repo);
    repo.request=async function(path,options={}){const method=String(options.method||'GET').toUpperCase();if(!['GET','HEAD','OPTIONS'].includes(method)&&!persistenceWriteAllowed())requireCapability(CAPABILITIES.workspaceWrite);return original(path,options)};repo.__amoAccessGuardedRequest=true;return repo
  }
  function guardRepositorySelection(){guardLocalRepository();guardRemoteInstance(window.workspaceRepository);if(typeof window.setWorkspaceRepository==='function'&&!window.setWorkspaceRepository.__amoAccessGuarded){const original=window.setWorkspaceRepository;const guarded=function(repo){return original(guardRemoteInstance(repo))};guarded.__amoAccessGuarded=true;window.setWorkspaceRepository=guarded}}
  function guardGlobalWrites(){
    if(typeof window.ensureRW==='function'&&!window.ensureRW.__amoAccessGuarded){const original=window.ensureRW;const guarded=async function(...args){if(!persistenceWriteAllowed())return false;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.ensureRW=guarded}
    if(typeof window.writeJson==='function'&&!window.writeJson.__amoAccessGuarded){const original=window.writeJson;const guarded=async function(...args){if(!persistenceWriteAllowed())requireCapability(CAPABILITIES.workspaceWrite);return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.writeJson=guarded}
    if(typeof window.backupWorkspaceOnOpen==='function'&&!window.backupWorkspaceOnOpen.__amoAccessGuarded){const original=window.backupWorkspaceOnOpen;const guarded=async function(...args){if(!can(CAPABILITIES.workspaceWrite)){if(typeof log==='function')log('Read-only session: workspace safety backup skipped.');return null}return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.backupWorkspaceOnOpen=guarded}
    if(typeof window.requestAutosave==='function'&&!window.requestAutosave.__amoAccessGuarded){const original=window.requestAutosave;const guarded=function(...args){if(!can(CAPABILITIES.workspaceWrite))return;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.requestAutosave=guarded}
    if(typeof window.flushAutosave==='function'&&!window.flushAutosave.__amoAccessGuarded){const original=window.flushAutosave;const guarded=async function(...args){if(!can(CAPABILITIES.workspaceWrite))return false;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.flushAutosave=guarded}
  }
  function installGuards(){guardRepositorySelection();guardGlobalWrites()}
  async function runClaim(fn){requireCapability(CAPABILITIES.workspaceClaim);claimDepth++;try{return await fn()}finally{claimDepth=Math.max(0,claimDepth-1);scheduleUiRefresh()}}

  function ensureAuth(){if(window.amoAuth)return Promise.resolve(window.amoAuth);if(authLoadPromise)return authLoadPromise;authLoadPromise=new Promise(resolve=>{let script=document.querySelector('script[data-amo-auth]');if(script){script.addEventListener('load',()=>resolve(window.amoAuth||null),{once:true});script.addEventListener('error',()=>resolve(null),{once:true});return}script=document.createElement('script');script.src=typeof amoAsset==='function'?amoAsset('app-auth.js'):'app-auth.js';script.dataset.amoAuth='true';script.async=false;script.onload=()=>resolve(window.amoAuth||null);script.onerror=()=>resolve(null);document.head.appendChild(script)});return authLoadPromise}
  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  window.amoAccess={CAPABILITIES,ROLE_DEFINITIONS,WRITE_CAPABILITIES:[...WRITE_CAPABILITIES],CONTRIBUTOR_CAPABILITIES:[...CONTRIBUTOR_CAPABILITIES],can,require:requireCapability,canClaim,claimed:workspaceClaimed,runClaim,mode:accessMode,currentPrincipal,users,resolveUser,resolveIdentityBinding,effectiveCapabilities,config:accessConfig,refresh:()=>{installGuards();scheduleUiRefresh();notify()},onChange};
  installGuards();ensureAuth().then(auth=>{auth?.onChange?.(()=>{installGuards();scheduleUiRefresh();notify()});installGuards();scheduleUiRefresh();notify()});window.addEventListener('amo-auth-changed',()=>{installGuards();scheduleUiRefresh();notify()});window.addEventListener('amo-workspace-connected',()=>{installGuards();scheduleUiRefresh();notify()});observeUi()
})();