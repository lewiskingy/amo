/* Canonical user attribution across AMO.
   AMO User ID is the stable actor key. Company / Entra account is the business identity.
   Google subject/email are retained only as authentication context. */
(function initIdentityAttribution(){
  if(window.__amoIdentityAttributionLoaded)return;window.__amoIdentityAttributionLoaded=true;

  function currentActor(){
    const p=window.amoAccess?.currentPrincipal?.()||null,identity=p?.identity||window.amoAuth?.currentIdentity?.()||null;
    return{
      authenticated:!!p?.authenticated,
      mapped:!!p?.mapped,
      userId:p?.mapped?String(p.id||''):'',
      displayName:String(p?.displayName||identity?.name||identity?.email||'Anonymous'),
      companyAccount:String(p?.companyAccount||''),
      authProvider:String(identity?.provider||''),
      authSubject:String(identity?.subject||identity?.objectId||''),
      authEmail:String(identity?.email||identity?.username||'')
    }
  }
  if(window.amoAccess)window.amoAccess.currentActor=currentActor;
  window.amoCurrentActor=currentActor;

  function workspaceUser(){
    const a=currentActor();if(!a.authenticated)return null;
    return{id:a.userId||a.authSubject||a.authEmail,userId:a.userId||'',displayName:a.displayName,name:a.displayName,email:a.companyAccount||a.authEmail,companyAccount:a.companyAccount,authProvider:a.authProvider,authSubject:a.authSubject,authEmail:a.authEmail}
  }
  try{window.localWorkspaceUser=workspaceUser}catch(_e){}
  try{window.ensureWorkspaceUser=()=>workspaceUser()}catch(_e){}
  try{window.setWorkspaceUser=()=>alert('Editing identity is taken from your authenticated AMO User. Change your sign-in or User mapping instead.')}catch(_e){}

  function actorSnapshot(){const a=currentActor();return{actorUserId:a.userId||null,actorDisplayName:a.displayName||null,actorCompanyAccount:a.companyAccount||null,authenticatedVia:a.authProvider?{provider:a.authProvider,subject:a.authSubject||null,email:a.authEmail||null}:null}}

  function installLocalAudit(){
    const C=window.LocalWorkspaceRepository;if(!C||C.prototype.__amoIdentityAudit)return;const p=C.prototype,original=p.writeJson;if(typeof original!=='function')return;
    p.writeJson=async function(path,value,...rest){
      let next=value;
      if(/^backups\/deltas\//.test(String(path||''))&&value&&typeof value==='object'&&Array.isArray(value.operations))next={...value,...actorSnapshot(),actor:value.actor||currentActor().displayName};
      return original.call(this,path,next,...rest)
    };p.__amoIdentityAudit=true
  }
  function installRemoteAudit(){
    const C=window.RemoteWorkspaceRepository;if(!C||C.prototype.__amoIdentityAudit)return;const p=C.prototype;
    p.actor=function(){const a=currentActor();if(a.userId)return`${a.userId} · ${a.displayName}${a.companyAccount?` · ${a.companyAccount}`:''}`;return a.authEmail||a.displayName||'Remote user'};
    p.__amoIdentityAudit=true
  }

  function enrichStatusRecord(record){
    if(!record||typeof record!=='object')return record;const a=currentActor();if(!a.userId)return record;const next={...record};
    const stamp=(prefix,nameField,timeField)=>{if(next[timeField]&&String(next[nameField]||'')===a.displayName){next[`${prefix}ByUserId`]=a.userId;if(a.companyAccount)next[`${prefix}ByAccount`]=a.companyAccount}};
    stamp('published','publishedBy','publishedAt');stamp('unpublished','unpublishedBy','unpublishedAt');stamp('finalized','finalizedBy','finalizedAt');stamp('created','createdBy','createdAt');stamp('modified','modifiedBy','modifiedAt');return next
  }
  function installStatusAttribution(C){
    if(!C||C.prototype.__amoStatusIdentity||typeof C.prototype.saveStatusReport!=='function')return;const p=C.prototype,original=p.saveStatusReport;
    p.saveStatusReport=function(id,record,...rest){return original.call(this,id,enrichStatusRecord(record),...rest)};p.__amoStatusIdentity=true
  }

  function stampNewIdea(idea){const a=currentActor();if(!idea||!a.userId)return idea;return{...idea,raisedBy:a.displayName,raisedByUserId:a.userId,raisedByAccount:a.companyAccount||undefined}}
  if(typeof window.defaultIdea==='function'&&!window.defaultIdea.__amoIdentity){const base=window.defaultIdea,wrapped=function(){return stampNewIdea(base())};wrapped.__amoIdentity=true;window.defaultIdea=wrapped}

  function lockIdeaIdentity(){
    document.querySelectorAll('[data-idea-modal-field="raisedBy"],[data-idea-field="raisedBy"]').forEach(el=>{el.disabled=true;el.title='Raised By is taken from the authenticated AMO User.'});
    document.querySelectorAll('#changeWorkspaceUser').forEach(b=>b.remove());
    const card=document.getElementById('workspaceIdentityCard');if(card){const h=card.querySelector('h2');if(h)h.textContent='Authenticated editing identity';const labels=[...card.querySelectorAll('.mini-stat span')];for(const label of labels)if(/Browser identity/i.test(label.textContent||''))label.textContent='AMO User'}
  }
  if(typeof window.renderIdeaModal==='function'&&!window.renderIdeaModal.__amoIdentity){const base=window.renderIdeaModal,wrapped=function(){const r=base.apply(this,arguments);lockIdeaIdentity();return r};wrapped.__amoIdentity=true;window.renderIdeaModal=wrapped}
  if(typeof window.renderIdeas==='function'&&!window.renderIdeas.__amoIdentity){const base=window.renderIdeas,wrapped=function(){const r=base.apply(this,arguments);lockIdeaIdentity();return r};wrapped.__amoIdentity=true;window.renderIdeas=wrapped}

  function install(){installLocalAudit();installRemoteAudit();installStatusAttribution(window.LocalWorkspaceRepository);installStatusAttribution(window.RemoteWorkspaceRepository);lockIdeaIdentity()}
  const observer=new MutationObserver(lockIdeaIdentity);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('amo-auth-changed',install);window.addEventListener('amo-access-changed',install);window.addEventListener('amo-workspace-connected',install);install();setTimeout(install,100)
})();
