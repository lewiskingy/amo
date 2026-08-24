/* Compact top command menu plus sticky list-grid controls. */
(function initCommandMenu(){
  const SOURCE_CLASS='command-source-hidden';
  const LISTS=[
    {table:'demandTable',toolbar:'demandToolbar'},
    {table:'allocationTable',toolbar:'allocationToolbar'},
    {table:'teamTable',toolbar:'teamToolbar'},
    {table:'ideaTable',toolbar:'ideaToolbar'}
  ];

  function source(selector){return document.querySelector(selector)}
  function sourceUsable(el){return !!el&&!el.disabled}
  function invoke(selector){const el=source(selector);if(el&&!el.disabled)el.click()}

  function hideCommandSources(){
    /* Workspace remains a visible user gesture. Theme is also deliberately a dedicated top-bar toggle. */
    ['#saveWorkspaceBtn','#exportBtn','#newDemandBtn']
      .forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.classList.add(SOURCE_CLASS)));
    document.getElementById('openWorkspaceBtn')?.classList.remove(SOURCE_CLASS);
    document.getElementById('themeToggle')?.classList.remove(SOURCE_CLASS)
  }

  function ensureConnectionBadge(){
    const top=document.querySelector('.top-actions');if(!top)return null;
    let stack=top.parentElement?.classList.contains('top-actions-stack')?top.parentElement:null;
    if(!stack){stack=document.createElement('div');stack.className='top-actions-stack';top.parentNode?.insertBefore(stack,top);stack.appendChild(top)}
    let badge=document.getElementById('workspaceConnectionBadge');
    if(!badge){badge=document.createElement('div');badge.id='workspaceConnectionBadge';badge.className='workspace-connection-badge';badge.textContent='No workspace open';badge.dataset.mode='none';stack.insertBefore(badge,top)}
    if(typeof renderWorkspaceConnectionBadge==='function')renderWorkspaceConnectionBadge();
    return badge
  }

  function ensureThemeToggle(){
    const top=document.querySelector('.top-actions');if(!top)return null;
    let theme=document.getElementById('themeToggle');
    if(!theme&&typeof applyTheme==='function'){
      theme=document.createElement('button');theme.id='themeToggle';theme.type='button';theme.className='theme-toggle';
      theme.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true));
      top.appendChild(theme)
    }
    if(theme){
      theme.classList.remove(SOURCE_CLASS);
      const dark=document.documentElement.dataset.theme==='dark';theme.textContent=dark?'☀':'☾';theme.title=dark?'Switch to light mode':'Switch to dark mode';theme.setAttribute('aria-label',theme.title)
    }
    return theme
  }

  function ensureShell(){
    const top=document.querySelector('.top-actions');if(!top)return null;
    ensureConnectionBadge();ensureThemeToggle();
    let shell=document.getElementById('commandMenuShell');
    if(!shell){
      shell=document.createElement('div');shell.id='commandMenuShell';shell.className='command-menu-shell';
      shell.innerHTML='<button class="command-menu-toggle" id="commandMenuToggle" type="button" aria-haspopup="true" aria-expanded="false" title="Commands"><span aria-hidden="true">☰</span><span class="command-menu-label">Menu</span></button><div class="command-menu" id="commandMenu" role="menu"></div>';
      top.appendChild(shell);
      shell.querySelector('#commandMenuToggle').addEventListener('click',e=>{e.stopPropagation();const open=shell.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))});
      document.addEventListener('click',e=>{if(!shell.contains(e.target)){shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false')}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'){shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false')}})
    }
    if(themeBeforeMenu(top,shell))top.insertBefore(document.getElementById('themeToggle'),shell);
    return shell
  }
  function themeBeforeMenu(top,shell){const theme=document.getElementById('themeToggle');return !!theme&&theme.parentElement===top&&theme.nextElementSibling!==shell}

  function menuItem(label,selector,opts={}){const el=source(selector),disabled=!sourceUsable(el);return `<button class="command-menu-item${opts.primary?' primary':''}" type="button" data-command-source="${escHtml(selector)}" ${disabled?'disabled':''}>${opts.icon?`<span class="command-menu-icon">${opts.icon}</span>`:''}<span>${escHtml(label)}</span></button>`}

  function mirrorToolbar(tableId,toolbarId){
    const table=document.getElementById(tableId),toolbar=document.getElementById(toolbarId),thead=table?.tHead;if(!table||!toolbar||!thead)return;
    table.closest('.table-wrap')?.classList.add('list-table-wrap');
    thead.querySelector('.list-action-row')?.remove();
    const firstRow=thead.rows[0],colspan=Math.max(1,firstRow?.cells?.length||1),row=thead.insertRow(0);row.className='list-action-row';
    const cell=row.insertCell();cell.colSpan=colspan;cell.className='list-action-cell';
    const actions=document.createElement('div');actions.className='list-sticky-actions';
    [...toolbar.querySelectorAll('button')].forEach(original=>{
      const clone=document.createElement('button');clone.type='button';clone.className=original.className;clone.disabled=original.disabled;clone.textContent=original.textContent;
      clone.addEventListener('click',()=>{if(!original.disabled)original.click()});actions.appendChild(clone)
    });
    cell.appendChild(actions)
  }
  function decorateLists(){LISTS.forEach(x=>mirrorToolbar(x.table,x.toolbar))}

  function renderCommandMenu(){
    hideCommandSources();ensureConnectionBadge();ensureThemeToggle();const shell=ensureShell();if(!shell)return;
    const menu=shell.querySelector('#commandMenu');
    menu.innerHTML=menuItem('Save Workspace','#saveWorkspaceBtn',{icon:'✓'})+menuItem('Export Snapshot','#exportBtn',{icon:'⇩'});
    menu.querySelectorAll('[data-command-source]').forEach(btn=>btn.addEventListener('click',()=>{const selector=btn.dataset.commandSource;shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false');invoke(selector)}));
    decorateLists()
  }

  const wrapRender=name=>{const fn=window[name];if(typeof fn!=='function')return;window[name]=function(...args){const r=fn.apply(this,args);setTimeout(renderCommandMenu,0);return r}};
  ['renderGrid','renderAllocations','renderIdeas','renderStatusReporting','renderRoadmap','renderConfig'].forEach(wrapRender);
  const baseSwitch=window.switchView;if(typeof baseSwitch==='function')window.switchView=function(id){const r=baseSwitch(id);setTimeout(renderCommandMenu,0);return r};
  const baseBanner=window.updateBanner;if(typeof baseBanner==='function')window.updateBanner=function(){const r=baseBanner();setTimeout(renderCommandMenu,0);return r};

  const style=document.createElement('style');style.id='command-menu-styles';style.textContent=`
    .btn{font-size:.76rem;font-weight:750;padding:6px 9px;border-radius:8px;line-height:1.2}
    .toolbar{gap:6px}.top-actions{gap:7px}
    .top-actions-stack{display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:0}
    .workspace-connection-badge{max-width:min(560px,48vw);padding:4px 9px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--muted);font-size:.7rem;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;box-shadow:0 1px 3px rgba(28,40,73,.04)}
    .workspace-connection-badge[data-mode="remote"]{color:var(--accent2);border-color:color-mix(in srgb,var(--accent) 28%,var(--line))}
    .workspace-connection-badge[data-mode="local"]{color:var(--good);border-color:color-mix(in srgb,var(--good) 28%,var(--line))}
    .${SOURCE_CLASS}{display:none!important}
    #openWorkspaceBtn{display:inline-flex!important;align-items:center;white-space:nowrap}
    #themeToggle{display:inline-grid!important;place-items:center;width:34px;height:34px;min-width:34px;padding:0;border-radius:50%;font-size:1rem}

    /* List actions live with the table chrome rather than disappearing with the page hero. */
    #demandToolbar,#allocationToolbar,#teamToolbar,#ideaToolbar{display:none!important}
    .list-table-wrap{max-height:calc(100vh - 132px);overflow:auto;position:relative;overscroll-behavior:contain}
    .list-table-wrap table thead{position:sticky;top:0;z-index:12;box-shadow:0 1px 0 var(--line)}
    .list-table-wrap table thead th,.list-table-wrap table thead td{background:var(--panel)}
    .list-table-wrap .filter-row th{background:#f7f9fc}
    .list-action-cell{padding:7px 9px!important;border-bottom:1px solid var(--line);background:var(--panel)!important}
    .list-sticky-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:30px}
    .list-sticky-actions .btn.primary:first-child{background:transparent!important;border-color:transparent!important;color:var(--accent)!important;font-weight:850!important;padding-left:4px!important;box-shadow:none!important}
    .list-sticky-actions .btn.primary:first-child::before{content:'＋';display:inline-block;margin-right:5px;font-size:.9rem;font-weight:900}

    .command-menu-shell{position:relative;margin-left:2px}
    .command-menu-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:9px;padding:7px 10px;font-size:.76rem;font-weight:800;cursor:pointer;line-height:1}
    .command-menu-toggle:hover{background:var(--soft)}
    .command-menu-toggle>span:first-child{font-size:1rem;line-height:1}
    .command-menu{display:none;position:absolute;right:0;top:calc(100% + 7px);min-width:210px;padding:6px;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);z-index:100}
    .command-menu-shell.open .command-menu{display:block}
    .command-menu-item{width:100%;display:flex;align-items:center;gap:9px;border:0;background:transparent;color:var(--ink);padding:8px 9px;border-radius:7px;text-align:left;font-size:.77rem;font-weight:750;cursor:pointer}
    .command-menu-item:hover:not(:disabled){background:var(--soft)}.command-menu-item:disabled{opacity:.4;cursor:not-allowed}
    .command-menu-item.primary{color:var(--accent);font-weight:850}.command-menu-icon{width:18px;text-align:center;font-size:.9rem}
    html[data-theme="dark"] .command-menu-toggle,html[data-theme="dark"] .command-menu,html[data-theme="dark"] .workspace-connection-badge,html[data-theme="dark"] .list-table-wrap table thead th,html[data-theme="dark"] .list-table-wrap table thead td,html[data-theme="dark"] .list-action-cell{background:var(--panel)!important;color:var(--ink);border-color:var(--line)}
    html[data-theme="dark"] .list-table-wrap .filter-row th{background:#182237!important}
    @media(max-width:760px){.topbar{align-items:flex-start}.top-actions-stack{align-items:stretch;width:100%}.top-actions{justify-content:flex-end}.workspace-connection-badge{max-width:100%;width:100%}.command-menu-label{display:none}.command-menu{right:0;min-width:190px}.list-table-wrap{max-height:70vh}}
  `;document.head.appendChild(style);
  renderCommandMenu();
})();
