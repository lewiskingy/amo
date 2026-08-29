/* Make the effective signed-in AMO identity obvious in the workspace context area.
   The canonical Company / Entra account is primary; Google is authentication detail only. */
(function initCurrentUserPill(){
  function principal(){return window.amoAccess?.currentPrincipal?.()||null}
  function host(){return document.querySelector('.workspace-banner .flex')}
  function setIfChanged(el,key,value){if(key==='className'){if(el.className!==value)el.className=value;return}if(key==='textContent'){if(el.textContent!==value)el.textContent=value;return}if(el[key]!==value)el[key]=value}
  function render(){
    const h=host();if(!h)return false;let pill=document.getElementById('amoCurrentUser');
    if(!pill){pill=document.createElement('span');pill.id='amoCurrentUser';pill.className='pill';const access=document.getElementById('amoAccessMode');if(access?.parentElement===h)h.insertBefore(pill,access);else h.appendChild(pill)}
    const p=principal();
    if(!p?.authenticated){setIfChanged(pill,'className','pill');setIfChanged(pill,'textContent','Anonymous');setIfChanged(pill,'title','Not signed in · read-only access');return true}
    const google=String(p.identity?.email||p.identity?.name||'Google account');
    if(p.mapped){
      const work=String(p.companyAccount||p.displayName||p.id||'AMO User');
      setIfChanged(pill,'className','pill blue');setIfChanged(pill,'textContent',`User · ${work}`);
      setIfChanged(pill,'title',`AMO user: ${p.displayName||work}\nCompany / Entra identity: ${work}\nAuthenticated with Google: ${google}`);
    }else{
      setIfChanged(pill,'className','pill');setIfChanged(pill,'textContent',`Google · ${google}`);
      setIfChanged(pill,'title','Signed in with Google but not mapped to an approved AMO User');
    }
    return true
  }

  // Do not observe the whole document continuously: render() mutates the pill and a broad
  // MutationObserver would retrigger itself indefinitely. Only watch startup until the workspace
  // banner exists, then rely on explicit auth/access/workspace lifecycle events.
  if(!render()){
    const startupObserver=new MutationObserver(()=>{if(render())startupObserver.disconnect()});
    startupObserver.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>startupObserver.disconnect(),5000)
  }
  window.addEventListener('amo-access-changed',render);
  window.addEventListener('amo-auth-changed',render);
  window.addEventListener('amo-workspace-connected',render);
  setTimeout(render,100)
})();
