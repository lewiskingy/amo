/* AMO client-side access-control facade.
   This layer controls application behaviour in both Local and Remote Workspace modes. It is
   intentionally not a security boundary for Remote Workspace: the API must independently enforce
   the same capabilities before private routes are enabled. */
(function initAmoAccess(){
  const CAPABILITIES=Object.freeze({
    workspaceRead:'workspace.read',
    workspaceWrite:'workspace.write',
    demandRead:'demand.read',
    demandWrite:'demand.write',
    allocationRead:'allocation.read',
    allocationWrite:'allocation.write',
    statusRead:'status.read',
    statusUpdate:'status.update',
    statusPublish:'status.publish',
    financialRead:'financial.read',
    systemConfigure:'system.configure',
    systemRestore:'system.restore'
  });
  const READ_CAPABILITIES=new Set([CAPABILITIES.workspaceRead,CAPABILITIES.demandRead,CAPABILITIES.allocationRead,CAPABILITIES.statusRead,CAPABILITIES.financialRead]);
  const WRITE_CAPABILITIES=new Set([CAPABILITIES.workspaceWrite,CAPABILITIES.demandWrite,CAPABILITIES.allocationWrite,CAPABILITIES.statusUpdate,CAPABILITIES.statusPublish,CAPABILITIES.systemConfigure,CAPABILITIES.systemRestore]);
  const listeners=new Set();
  let authLoadPromise=null,observer=null,refreshQueued=false;

  function accessConfig(){
    try{
      const raw=typeof db!=='undefined'?db?.settings?.accessControl:null;
      return raw&&typeof raw==='object'?raw:{}
    }catch{return{}}
  }
  function identityBindings(){
    const bindings=accessConfig().identityBindings;
    return Array.isArray(bindings)?bindings.filter(x=>x&&x.enabled!==false):[]
  }
  function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
  function currentAuthIdentity(){return window.amoAuth?.currentIdentity?.()||null}
  function resolveIdentityBinding(identity=currentAuthIdentity()){
    if(!identity)return null;
    const provider=String(identity.provider||'').toLowerCase(),subject=String(identity.subject||identity.objectId||''),email=normalizeEmail(identity.email||identity.username);
    return identityBindings().find(binding=>{
      if(String(binding.provider||'').toLowerCase()!==provider)return false;
      const configuredSubject=String(binding.subject||binding.providerSubject||'');
      if(configuredSubject&&subject)return configuredSubject===subject;
      return !!email&&normalizeEmail(binding.email||binding.providerEmail)===email
    })||null
  }
  function currentPrincipal(){
    const identity=currentAuthIdentity();
    if(!identity)return{authenticated:false,mapped:false,kind:'anonymous',id:'anonymous',displayName:'Anonymous',companyAccount:'',identity:null,binding:null};
    const binding=resolveIdentityBinding(identity),companyAccount=String(binding?.companyAccount||binding?.entraAccount||binding?.workAccount||'').trim();
    return{
      authenticated:true,
      mapped:!!binding,
      kind:binding?'mapped':'authenticated',
      id:String(binding?.userId||companyAccount||identity.subject||identity.email||'authenticated-user'),
      displayName:String(binding?.displayName||identity.name||companyAccount||identity.email||'Authenticated user'),
      companyAccount,
      identity,
      binding
    }
  }
  function writeAllowed(){
    const principal=currentPrincipal();if(!principal.authenticated)return false;
    return accessConfig().writeRequiresMapping===true?principal.mapped:true
  }
  function can(capability){
    const name=String(capability||'');
    if(READ_CAPABILITIES.has(name)||name.endsWith('.read'))return true;
    if(WRITE_CAPABILITIES.has(name)||name.endsWith('.write')||name.endsWith('.update')||name.endsWith('.publish')||name.endsWith('.configure')||name.endsWith('.restore'))return writeAllowed();
    return false
  }
  function requireCapability(capability,message){
    if(can(capability))return true;
    const principal=currentPrincipal(),needsMapping=principal.authenticated&&accessConfig().writeRequiresMapping===true&&!principal.mapped;
    throw new Error(message||(needsMapping?'Your signed-in identity is not mapped to an authorised AMO user.':'AMO is read-only until you sign in with Google.'))
  }
  function accessMode(){return writeAllowed()?'read-write':'read-only'}
  function notify(){
    const state={mode:accessMode(),principal:currentPrincipal()};
    listeners.forEach(fn=>{try{fn(state)}catch(_e){}});
    try{window.dispatchEvent(new CustomEvent('amo-access-changed',{detail:state}))}catch(_e){}
  }

  function mutationButton(button){
    if(!(button instanceof HTMLElement))return false;
    if(button.closest('.amo-auth-profile'))return false;
    if(button.dataset.amoWrite==='true')return true;
    const id=String(button.id||'');
    if(['saveWorkspaceBtn','newDemandBtn'].includes(id))return true;
    const text=String(button.textContent||'').replace(/\s+/g,' ').trim();
    return /^(?:\+\s*)?(?:new\b|add\b|edit\b|save\b|delete\b|remove\b|publish\b|unpublish\b|restore\b|archive\b|allocate\b|create\b|discard\s+and\s+save\b|change\s+identity\b)/i.test(text)
  }
  function setAccessDisabled(element,disabled){
    if(disabled){
      if(!element.disabled){element.disabled=true;element.dataset.amoAccessDisabled='true';element.title=element.title||'Sign in with Google to make changes.'}
    }else if(element.dataset.amoAccessDisabled==='true'){
      element.disabled=false;delete element.dataset.amoAccessDisabled
    }
  }
  function applyModalReadOnly(readOnly){
    const modal=document.getElementById('recordModalBody');if(!modal)return;
    modal.querySelectorAll('input,select,textarea,button,[contenteditable="true"]').forEach(el=>{
      if(el.dataset.amoReadonlyAllow==='true')return;
      if(el.matches('button')&&!mutationButton(el))return;
      if('disabled'in el)setAccessDisabled(el,readOnly);
      else if(readOnly){el.dataset.amoAccessContenteditable=el.getAttribute('contenteditable')||'true';el.setAttribute('contenteditable','false')}
      else if(el.dataset.amoAccessContenteditable){el.setAttribute('contenteditable',el.dataset.amoAccessContenteditable);delete el.dataset.amoAccessContenteditable}
    })
  }
  function renderAccessBadge(readOnly){
    const host=document.querySelector('.workspace-banner .flex');if(!host)return;
    let badge=document.getElementById('amoAccessMode');if(!badge){badge=document.createElement('span');badge.id='amoAccessMode';badge.className='pill';host.appendChild(badge)}
    const principal=currentPrincipal();
    badge.className=`pill ${readOnly?'':'green'}`;
    badge.textContent=readOnly?(principal.authenticated?'Read only · identity not mapped':'Read only · sign in to edit'):'Edit enabled';
    badge.title=principal.companyAccount?`Acting as ${principal.companyAccount}`:(principal.identity?.email||'')
  }
  function applyUiState(){
    refreshQueued=false;const readOnly=!can(CAPABILITIES.workspaceWrite);document.documentElement.dataset.amoAccessMode=readOnly?'read-only':'read-write';
    document.querySelectorAll('button').forEach(button=>{if(mutationButton(button))setAccessDisabled(button,readOnly)});
    applyModalReadOnly(readOnly);renderAccessBadge(readOnly)
  }
  function scheduleUiRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(applyUiState)}
  function observeUi(){
    if(observer)return;observer=new MutationObserver(scheduleUiRefresh);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','contenteditable']});scheduleUiRefresh()
  }

  function guardLocalRepository(){
    const C=window.LocalWorkspaceRepository;if(!C||C.prototype.__amoAccessGuarded)return;
    const p=C.prototype,originalEnsure=p.ensureWritePermission,originalWrite=p.writeJson,originalDelete=p.deletePath;
    p.ensureWritePermission=async function(...args){if(!can(CAPABILITIES.workspaceWrite))return false;return originalEnsure.apply(this,args)};
    p.writeJson=async function(...args){requireCapability(CAPABILITIES.workspaceWrite);return originalWrite.apply(this,args)};
    p.deletePath=async function(...args){requireCapability(CAPABILITIES.workspaceWrite);return originalDelete.apply(this,args)};
    p.__amoAccessGuarded=true
  }
  function guardRemoteInstance(repo){
    if(!repo||repo.mode!=='remote'||repo.__amoAccessGuardedRequest||typeof repo.request!=='function')return repo;
    const original=repo.request.bind(repo);
    repo.request=async function(path,options={}){
      const method=String(options.method||'GET').toUpperCase();
      if(!['GET','HEAD','OPTIONS'].includes(method))requireCapability(CAPABILITIES.workspaceWrite);
      return original(path,options)
    };
    repo.__amoAccessGuardedRequest=true;return repo
  }
  function guardRepositorySelection(){
    guardLocalRepository();guardRemoteInstance(window.workspaceRepository);
    if(typeof window.setWorkspaceRepository==='function'&&!window.setWorkspaceRepository.__amoAccessGuarded){
      const original=window.setWorkspaceRepository;
      const guarded=function(repo){return original(guardRemoteInstance(repo))};guarded.__amoAccessGuarded=true;window.setWorkspaceRepository=guarded
    }
  }
  function guardGlobalWrites(){
    if(typeof window.ensureRW==='function'&&!window.ensureRW.__amoAccessGuarded){
      const original=window.ensureRW;const guarded=async function(...args){if(!can(CAPABILITIES.workspaceWrite))return false;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.ensureRW=guarded
    }
    if(typeof window.writeJson==='function'&&!window.writeJson.__amoAccessGuarded){
      const original=window.writeJson;const guarded=async function(...args){requireCapability(CAPABILITIES.workspaceWrite);return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.writeJson=guarded
    }
    if(typeof window.backupWorkspaceOnOpen==='function'&&!window.backupWorkspaceOnOpen.__amoAccessGuarded){
      const original=window.backupWorkspaceOnOpen;const guarded=async function(...args){if(!can(CAPABILITIES.workspaceWrite)){if(typeof log==='function')log('Read-only session: workspace safety backup skipped.');return null}return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.backupWorkspaceOnOpen=guarded
    }
    if(typeof window.requestAutosave==='function'&&!window.requestAutosave.__amoAccessGuarded){
      const original=window.requestAutosave;const guarded=function(...args){if(!can(CAPABILITIES.workspaceWrite))return;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.requestAutosave=guarded
    }
    if(typeof window.flushAutosave==='function'&&!window.flushAutosave.__amoAccessGuarded){
      const original=window.flushAutosave;const guarded=async function(...args){if(!can(CAPABILITIES.workspaceWrite))return false;return original.apply(this,args)};guarded.__amoAccessGuarded=true;window.flushAutosave=guarded
    }
  }
  function installGuards(){guardRepositorySelection();guardGlobalWrites()}

  function ensureAuth(){
    if(window.amoAuth)return Promise.resolve(window.amoAuth);if(authLoadPromise)return authLoadPromise;
    authLoadPromise=new Promise(resolve=>{
      let script=document.querySelector('script[data-amo-auth]');
      if(script){script.addEventListener('load',()=>resolve(window.amoAuth||null),{once:true});script.addEventListener('error',()=>resolve(null),{once:true});return}
      script=document.createElement('script');script.src=typeof amoAsset==='function'?amoAsset('app-auth.js'):'app-auth.js';script.dataset.amoAuth='true';script.async=false;script.onload=()=>resolve(window.amoAuth||null);script.onerror=()=>resolve(null);document.head.appendChild(script)
    });return authLoadPromise
  }
  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  window.amoAccess={CAPABILITIES,can,require:requireCapability,mode:accessMode,currentPrincipal,identityBindings,resolveIdentityBinding,config:accessConfig,refresh:()=>{installGuards();scheduleUiRefresh();notify()},onChange};
  installGuards();
  ensureAuth().then(auth=>{auth?.onChange?.(()=>{installGuards();scheduleUiRefresh();notify()});installGuards();scheduleUiRefresh();notify()});
  window.addEventListener('amo-auth-changed',()=>{installGuards();scheduleUiRefresh();notify()});
  window.addEventListener('amo-workspace-connected',installGuards);
  observeUi()
})();
