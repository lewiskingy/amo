const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function renderSidebar(host,{activeRoute='/demand'}={}){
  host.className='amo-shell-sidebar';
  host.innerHTML=`<a class="amo-shell-brand" href="/"><img src="/assets/amo-icon.png" alt=""><span><strong>Architecture Management Office</strong><small>Target client · dark launch</small></span></a>
    <nav aria-label="AMO navigation">
      <div class="amo-shell-nav-group"><span>Management</span>
        <a class="${activeRoute==='/demand'?'active':''}" href="/demand">Demand <em>Preview</em></a>
        <a href="/?view=allocations">Allocations <small>legacy</small></a>
        <a href="/?view=team">People <small>legacy</small></a>
      </div>
      <div class="amo-shell-nav-group"><span>Reporting</span>
        <a href="/">Dashboard <small>legacy</small></a>
        <a href="/?view=status-report">Status Report <small>legacy</small></a>
      </div>
    </nav>
    <div id="amoShellAccount" class="amo-shell-account"></div>`;
}

export function renderPageHeader(host,{title,subtitle='',actions=[]}={}){
  host.className='amo-shell-page-header';
  host.innerHTML=`<div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="amo-shell-actions">${actions.map(a=>`<button type="button" class="btn ${esc(a.tone||'')}" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>`;
  return Object.fromEntries(actions.map(a=>[a.id,host.querySelector(`[data-action="${CSS.escape(a.id)}"]`)]));
}

export class AccountWidget{
  constructor(host,auth){this.host=host;this.auth=auth;this.unsubscribe=null}
  async render(){
    if(!this.auth){this.host.innerHTML='<span class="muted">Authentication unavailable</span>';return}
    const identity=this.auth.currentIdentity?.();
    if(identity){
      this.host.innerHTML=`<div class="amo-shell-account-row">${identity.picture?`<img src="${esc(identity.picture)}" alt="">`:''}<span><strong>${esc(identity.name)}</strong><small>${esc(identity.email)}</small></span><button type="button" class="btn" data-signout>Sign out</button></div>`;
      this.host.querySelector('[data-signout]')?.addEventListener('click',async()=>{await this.auth.signOut();await this.render()});
    }else{
      this.host.innerHTML='<div class="amo-shell-signin"><span>Sign in to access the Remote Workspace</span><div data-signin></div></div>';
      try{await this.auth.renderSignInButton(this.host.querySelector('[data-signin]'),{width:210})}catch(e){this.host.querySelector('[data-signin]').textContent=e.message}
    }
  }
  async start(){await this.render();this.unsubscribe=this.auth?.onChange?.(()=>this.render())||null}
  stop(){this.unsubscribe?.()}
}

export function renderWorkspaceStatus(host,{state='loading',message='Connecting to workspace…',detail=''}={}){
  host.className=`amo-shell-workspace-status state-${state}`;
  host.innerHTML=`<span class="amo-shell-state-dot" aria-hidden="true"></span><span>${esc(message)}</span>${detail?`<small>${esc(detail)}</small>`:''}`;
}
