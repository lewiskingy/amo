/* Microsoft Entra authentication facade for hosted AMO.
   Authentication is deliberately optional until the API auth gate is enabled. Other AMO
   modules consume the small amoAuth facade rather than depending directly on MSAL objects. */
(function initAmoAuth(){
  const TENANT_ID='5fbb0478-1d93-4701-ab39-1df8234dbbf5';
  const CLIENT_ID='e78adcd0-b55f-44e8-a968-cd66799f47f8';
  const API_SCOPE='api://0cd6fc39-7f31-49f6-ae75-7f95add7a566/access_as_user';
  const AUTHORITY=`https://login.microsoftonline.com/${TENANT_ID}`;
  const REDIRECT_URI=`${window.location.origin}/`;
  const listeners=new Set();
  let client=null;
  let ready=false;
  let unavailableReason='';

  function notify(){
    const identity=currentIdentity();
    listeners.forEach(fn=>{try{fn(identity)}catch(_e){}});
    try{window.dispatchEvent(new CustomEvent('amo-auth-changed',{detail:identity}))}catch(_e){}
  }

  function account(){
    if(!client)return null;
    const active=client.getActiveAccount?.();
    if(active)return active;
    const accounts=client.getAllAccounts?.()||[];
    if(accounts.length===1){client.setActiveAccount?.(accounts[0]);return accounts[0]}
    return accounts[0]||null
  }

  function currentIdentity(){
    const a=account();
    if(!a)return null;
    const claims=a.idTokenClaims||{};
    return {
      provider:'entra',
      name:a.name||claims.name||a.username||'Microsoft user',
      email:claims.email||claims.preferred_username||a.username||'',
      username:a.username||'',
      tenantId:claims.tid||a.tenantId||TENANT_ID,
      objectId:claims.oid||claims.sub||a.localAccountId||'',
      homeAccountId:a.homeAccountId||''
    }
  }

  async function initialise(){
    if(ready)return true;
    if(!window.msal?.PublicClientApplication){
      unavailableReason='Microsoft authentication library did not load.';
      return false
    }
    try{
      client=new window.msal.PublicClientApplication({
        auth:{clientId:CLIENT_ID,authority:AUTHORITY,redirectUri:REDIRECT_URI,navigateToLoginRequestUrl:false},
        cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}
      });
      const accounts=client.getAllAccounts?.()||[];
      if(accounts.length)client.setActiveAccount?.(accounts[0]);
      ready=true;notify();return true
    }catch(e){
      unavailableReason=e?.message||String(e);
      console.warn('AMO Entra authentication could not initialise.',e);
      return false
    }
  }

  async function signIn(){
    if(!await initialise())throw new Error(unavailableReason||'Microsoft authentication is unavailable.');
    const result=await client.loginPopup({scopes:['openid','profile','email',API_SCOPE],prompt:'select_account'});
    if(result?.account)client.setActiveAccount?.(result.account);
    notify();
    return currentIdentity()
  }

  async function signOut(){
    if(!await initialise())return;
    const a=account();
    if(!a)return;
    await client.logoutPopup({account:a,postLogoutRedirectUri:REDIRECT_URI,mainWindowRedirectUri:REDIRECT_URI});
    notify()
  }

  async function getApiToken(options={}){
    if(!await initialise())return null;
    const a=account();
    if(!a)return null;
    try{
      const result=await client.acquireTokenSilent({account:a,scopes:[API_SCOPE]});
      return result?.accessToken||null
    }catch(e){
      const interactionRequired=e instanceof window.msal.InteractionRequiredAuthError || ['interaction_required','consent_required','login_required'].includes(e?.errorCode);
      if(!options.interactive||!interactionRequired)return null;
      const result=await client.acquireTokenPopup({account:a,scopes:[API_SCOPE]});
      if(result?.account)client.setActiveAccount?.(result.account);
      notify();
      return result?.accessToken||null
    }
  }

  function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}

  window.amoAuth={
    tenantId:TENANT_ID,
    clientId:CLIENT_ID,
    apiScope:API_SCOPE,
    initialise,
    signIn,
    signOut,
    getApiToken,
    currentIdentity,
    isSignedIn:()=>!!account(),
    onChange,
    unavailableReason:()=>unavailableReason
  };
  initialise();
})();
