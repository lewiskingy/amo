/* Google authentication facade for hosted AMO.
   Authentication remains optional while server-side RBAC enforcement is introduced. Other AMO
   modules consume this small amoAuth facade rather than depending directly on Google objects. */
(function initAmoAuth(){
  const CLIENT_ID='440124391886-shmkseqvousplhc89fvb52gckahq4ml1.apps.googleusercontent.com';
  const GIS_SRC='https://accounts.google.com/gsi/client';
  const CREDENTIAL_KEY='amo.googleCredential';
  const listeners=new Set();
  let ready=false;
  let unavailableReason='';
  let gisLoadPromise=null;
  let credential=null;
  let claims=null;

  function decodeJwt(token){
    try{
      const part=String(token||'').split('.')[1];if(!part)return null;
      const base64=part.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-part.length%4)%4);
      const json=decodeURIComponent(atob(base64).split('').map(c=>`%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
      return JSON.parse(json)
    }catch{return null}
  }
  function tokenValid(token){const c=decodeJwt(token);return !!c&&c.aud===CLIENT_ID&&(!c.exp||c.exp*1000>Date.now()+15000)}
  function remember(token){
    credential=tokenValid(token)?token:null;claims=credential?decodeJwt(credential):null;
    try{if(credential)sessionStorage.setItem(CREDENTIAL_KEY,credential);else sessionStorage.removeItem(CREDENTIAL_KEY)}catch{}
    notify()
  }
  function restore(){try{const saved=sessionStorage.getItem(CREDENTIAL_KEY);if(saved&&tokenValid(saved)){credential=saved;claims=decodeJwt(saved)}else sessionStorage.removeItem(CREDENTIAL_KEY)}catch{}}
  function notify(){const identity=currentIdentity();listeners.forEach(fn=>{try{fn(identity)}catch(_e){}});try{window.dispatchEvent(new CustomEvent('amo-auth-changed',{detail:identity}))}catch(_e){}}

  function currentIdentity(){
    if(!credential||!claims||!tokenValid(credential)){if(credential)remember(null);return null}
    return {
      provider:'google',
      subject:claims.sub||'',
      name:claims.name||claims.email||'Google user',
      email:claims.email||'',
      username:claims.email||'',
      picture:claims.picture||'',
      emailVerified:claims.email_verified===true
    }
  }

  function loadGoogleIdentity(){
    if(window.google?.accounts?.id)return Promise.resolve(true);
    if(gisLoadPromise)return gisLoadPromise;
    gisLoadPromise=new Promise(resolve=>{
      let script=document.querySelector('script[data-amo-google-identity]');
      if(script){script.addEventListener('load',()=>resolve(!!window.google?.accounts?.id),{once:true});script.addEventListener('error',()=>resolve(false),{once:true});return}
      script=document.createElement('script');script.src=GIS_SRC;script.async=true;script.dataset.amoGoogleIdentity='true';
      script.onload=()=>resolve(!!window.google?.accounts?.id);script.onerror=()=>resolve(false);document.head.appendChild(script)
    });
    return gisLoadPromise
  }

  async function initialise(){
    if(ready)return true;
    restore();
    if(!await loadGoogleIdentity()){
      unavailableReason='Google authentication library did not load.';return false
    }
    try{
      window.google.accounts.id.initialize({
        client_id:CLIENT_ID,
        callback:response=>{if(response?.credential)remember(response.credential)},
        auto_select:false,
        cancel_on_tap_outside:true
      });
      ready=true;notify();return true
    }catch(e){unavailableReason=e?.message||String(e);console.warn('AMO Google authentication could not initialise.',e);return false}
  }

  async function renderSignInButton(element,options={}){
    if(!element)throw new Error('A sign-in button container is required.');
    if(!await initialise())throw new Error(unavailableReason||'Google authentication is unavailable.');
    element.innerHTML='';
    window.google.accounts.id.renderButton(element,{
      type:'standard',theme:'outline',size:'medium',text:'signin_with',shape:'rectangular',logo_alignment:'left',width:Math.max(180,Math.min(260,options.width||220))
    })
  }

  async function signOut(){
    remember(null);
    try{window.google?.accounts?.id?.disableAutoSelect?.()}catch{}
  }
  async function getApiToken(){
    if(!await initialise())return null;
    if(!credential||!tokenValid(credential)){if(credential)remember(null);return null}
    return credential
  }
  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  window.amoAuth={
    provider:'google',clientId:CLIENT_ID,initialise,renderSignInButton,signOut,getApiToken,currentIdentity,
    isSignedIn:()=>!!currentIdentity(),onChange,unavailableReason:()=>unavailableReason
  };
  initialise()
})();
