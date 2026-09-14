const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const legacy=(view='dashboard')=>view==='dashboard'?'/':`/?view=${encodeURIComponent(view)}`;

export function renderSidebar(host,{activeRoute='/demand'}={}){
  host.className='amo-shell-sidebar';
  host.innerHTML=`<div class="amo-shell-sidebar-head"><a class="amo-shell-brand" href="/"><img src="/assets/amo-icon.png" alt=""><span><strong>Architecture Management Office</strong><small id="amoShellVersion">Target client · dark launch</small></span></a><button type="button" class="amo-shell-close" data-shell-close aria-label="Close navigation">×</button></div>
    <nav aria-label="AMO navigation">
      <a class="amo-shell-primary-link" href="${legacy('readme')}">README</a>
      <a class="amo-shell-primary-link" data-amo-assistant-target hidden target="_blank" rel="noopener noreferrer">↗ Launch AMO Assistant</a>
      <div class="amo-shell-nav-group"><span>Reporting</span>
        <a href="${legacy('dashboard')}">Dashboard <small>legacy</small></a>
        <a href="${legacy('resource')}">Resource Plan <small>legacy</small></a>
        <a href="${legacy('roadmap')}">Roadmap <small>legacy</small></a>
        <a href="${legacy('status-report')}">Status Report <small>legacy</small></a>
      </div>
      <div class="amo-shell-nav-group"><span>Management</span>
        <a class="${activeRoute==='/demand'?'active':''}" href="/demand">Demand</a>
        <a href="${legacy('demand')}">Demand <small>legacy</small></a>
        <a href="${legacy('allocations')}">Allocations <small>legacy</small></a>
        <a href="${legacy('team')}">People <small>legacy</small></a>
        <a href="${legacy('ideas')}">Ideas <small>legacy</small></a>
      </div>
      <div class="amo-shell-nav-group"><span>Admin</span>
        <a href="${legacy('config')}">Config <small>legacy</small></a>
        <a href="${legacy('actuals')}">Actuals <small>legacy</small></a>
        <a href="${legacy('status-history')}">Status Report History <small>legacy</small></a>
        <a href="${legacy('data')}">Workspace <small>legacy</small></a>
      </div>
      <a class="amo-shell-primary-link" href="${legacy('process-overview')}">Process Overview <small>legacy</small></a>
    </nav>
    <div class="amo-shell-sidebar-lower">
      <section class="amo-shell-workspace-panel" aria-label="Workspace"><span class="amo-shell-sidebar-label">Workspace</span><div id="amoShellWorkspace"></div></section>
      <div id="amoShellAccount" class="amo-shell-account"></div>
    </div>
    <div class="amo-shell-backdrop" data-shell-backdrop></div>`;
  const close=()=>document.body.classList.remove('amo-shell-nav-open');
  host.querySelector('[data-shell-close]')?.addEventListener('click',close);host.querySelector('[data-shell-backdrop]')?.addEventListener('click',close);
  host.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{if(matchMedia('(max-width: 980px)').matches)close()}));
}

export function renderSidebarIdentity(host,{clientVersion='—',schemaVersion='—',backendVersion='',mode=''}={}){
  const target=host?.querySelector?.('#amoShellVersion');if(!target)return;
  const backend=mode==='remote'&&backendVersion?` · Backend ${backendVersion}`:'';
  target.textContent=`Client ${clientVersion}${backend} · Schema ${schemaVersion}`;
}

export function setSidebarAssistant(host,url=''){
  const link=host?.querySelector?.('[data-amo-assistant-target]');if(!link)return;
  const value=String(url||'').trim();link.hidden=!value;if(value)link.href=value;else link.removeAttribute('href');
}

export function moveWorkspaceSwitcherToSidebar(sidebarHost,switcherHost){
  const slot=sidebarHost?.querySelector?.('#amoShellWorkspace');if(slot&&switcherHost&&switcherHost.parentElement!==slot)slot.appendChild(switcherHost);
}

export function renderPageHeader(host,{title,subtitle='',actions=[]}={}){
  host.className='amo-shell-page-header';
  host.innerHTML=`<div class="amo-shell-heading"><button type="button" class="amo-shell-menu-toggle" data-shell-menu aria-label="Open navigation" aria-expanded="false">☰</button><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="amo-shell-actions">${actions.map(a=>`<button type="button" class="btn ${esc(a.tone||'')}" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>`;
  const menu=host.querySelector('[data-shell-menu]');menu?.addEventListener('click',()=>{const open=!document.body.classList.contains('amo-shell-nav-open');document.body.classList.toggle('amo-shell-nav-open',open);menu.setAttribute('aria-expanded',String(open))});
  return Object.fromEntries(actions.map(a=>[a.id,host.querySelector(`[data-action="${CSS.escape(a.id)}"]`)]));
}

export class AccountWidget{
  constructor(host,auth){this.host=host;this.auth=auth;this.unsubscribe=null}
  async render(){
    if(!this.auth){this.host.innerHTML='<span class="muted">Authentication unavailable</span>';return}
    const identity=this.auth.currentIdentity?.();
    if(identity){
      this.host.innerHTML=`<div class="amo-shell-account-row">${identity.picture?`<img src="${esc(identity.picture)}" alt="">`:''}<span><strong>${esc(identity.name||'Signed in')}</strong><small>${esc(identity.email||'')}</small></span><button type="button" class="btn" data-signout>Sign out</button></div>`;
      this.host.querySelector('[data-signout]')?.addEventListener('click',async()=>{await this.auth.signOut();await this.render()});
    }else{
      this.host.innerHTML='<div class="amo-shell-signin" aria-label="Not signed in"><div data-signin></div></div>';
      try{await this.auth.renderSignInButton(this.host.querySelector('[data-signin]'),{type:'icon',shape:'circle',size:'medium'})}catch(e){this.host.querySelector('[data-signin]').textContent=e.message}
    }
  }
  async start(){await this.render();this.unsubscribe=this.auth?.onChange?.(()=>this.render())||null}
  stop(){this.unsubscribe?.()}
}

export function renderWorkspaceStatus(host,{state='loading',message='Connecting to workspace…',detail=''}={}){
  host.className=`amo-shell-workspace-status state-${state}`;
  host.innerHTML=`<span class="amo-shell-state-dot" aria-hidden="true"></span><span>${esc(message)}</span>${detail?`<small>${esc(detail)}</small>`:''}`;
}
