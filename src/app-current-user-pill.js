/* Make the effective signed-in AMO identity obvious in the workspace context area.
   The canonical Company / Entra account is primary; Google is authentication detail only. */
(function initCurrentUserPill(){
  function principal(){return window.amoAccess?.currentPrincipal?.()||null}
  function host(){return document.querySelector('.workspace-banner .flex')}
  function render(){
    const h=host();if(!h)return;let pill=document.getElementById('amoCurrentUser');
    if(!pill){pill=document.createElement('span');pill.id='amoCurrentUser';pill.className='pill';const access=document.getElementById('amoAccessMode');if(access?.parentElement===h)h.insertBefore(pill,access);else h.appendChild(pill)}
    const p=principal();
    if(!p?.authenticated){pill.className='pill';pill.textContent='Anonymous';pill.title='Not signed in · read-only access';return}
    const google=String(p.identity?.email||p.identity?.name||'Google account');
    if(p.mapped){
      const work=String(p.companyAccount||p.displayName||p.id||'AMO User');
      pill.className='pill blue';pill.textContent=`User · ${work}`;
      pill.title=`AMO user: ${p.displayName||work}\nCompany / Entra identity: ${work}\nAuthenticated with Google: ${google}`;
    }else{
      pill.className='pill';pill.textContent=`Google · ${google}`;
      pill.title='Signed in with Google but not mapped to an approved AMO User';
    }
  }
  const observer=new MutationObserver(render);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('amo-access-changed',render);window.addEventListener('amo-auth-changed',render);window.addEventListener('amo-workspace-connected',render);
  render();setTimeout(render,100)
})();
