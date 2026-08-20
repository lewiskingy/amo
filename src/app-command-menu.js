/* Compact top command menu. Team View stays visible; page create/edit actions stay with page content. */
(function initCommandMenu(){
  const SOURCE_CLASS='command-source-hidden';

  function source(selector){return document.querySelector(selector)}
  function sourceUsable(el){return !!el&&!el.disabled}
  function invoke(selector){const el=source(selector);if(el&&!el.disabled)el.click()}

  function hideCommandSources(){
    /* Only global commands are represented through the burger menu. Page-level New/Edit controls remain visible. */
    ['#openWorkspaceBtn','#saveWorkspaceBtn','#exportBtn','#newDemandBtn','#themeToggle']
      .forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.classList.add(SOURCE_CLASS)));
  }

  function ensureShell(){
    const top=document.querySelector('.top-actions');if(!top)return null;
    let shell=document.getElementById('commandMenuShell');
    if(!shell){
      shell=document.createElement('div');shell.id='commandMenuShell';shell.className='command-menu-shell';
      shell.innerHTML='<button class="command-menu-toggle" id="commandMenuToggle" type="button" aria-haspopup="true" aria-expanded="false" title="Commands"><span aria-hidden="true">☰</span><span class="command-menu-label">Menu</span></button><div class="command-menu" id="commandMenu" role="menu"></div>';
      top.appendChild(shell);
      shell.querySelector('#commandMenuToggle').addEventListener('click',e=>{e.stopPropagation();const open=shell.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))});
      document.addEventListener('click',e=>{if(!shell.contains(e.target)){shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false')}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'){shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false')}})
    }
    return shell
  }

  function menuItem(label,selector,opts={}){
    const el=source(selector),disabled=!sourceUsable(el);return `<button class="command-menu-item${opts.primary?' primary':''}" type="button" data-command-source="${escHtml(selector)}" ${disabled?'disabled':''}>${opts.icon?`<span class="command-menu-icon">${opts.icon}</span>`:''}<span>${escHtml(label)}</span></button>`
  }

  function renderCommandMenu(){
    hideCommandSources();const shell=ensureShell();if(!shell)return;
    const menu=shell.querySelector('#commandMenu');
    const workspaceLabel=workspaceHandle?'Change Workspace':'Open Workspace';
    let html=menuItem(workspaceLabel,'#openWorkspaceBtn',{icon:'▣'});
    html+=menuItem('Save Workspace','#saveWorkspaceBtn',{icon:'✓'});
    html+=menuItem('Export Snapshot','#exportBtn',{icon:'⇩'});
    html+='<div class="command-menu-separator"></div>';
    const theme=document.getElementById('themeToggle');
    if(theme){const dark=document.documentElement.dataset.theme==='dark';html+=`<button class="command-menu-item" type="button" data-command-theme><span class="command-menu-icon">${dark?'☀':'☾'}</span><span>${dark?'Light Mode':'Dark Mode'}</span></button>`}
    menu.innerHTML=html;
    menu.querySelectorAll('[data-command-source]').forEach(btn=>btn.addEventListener('click',()=>{const selector=btn.dataset.commandSource;shell.classList.remove('open');shell.querySelector('#commandMenuToggle')?.setAttribute('aria-expanded','false');invoke(selector)}));
    menu.querySelector('[data-command-theme]')?.addEventListener('click',()=>{shell.classList.remove('open');document.getElementById('themeToggle')?.click();setTimeout(renderCommandMenu,0)})
  }

  const wrapRender=name=>{const fn=window[name];if(typeof fn!=='function')return;window[name]=function(...args){const r=fn.apply(this,args);setTimeout(renderCommandMenu,0);return r}};
  ['renderGrid','renderAllocations','renderIdeas','renderStatusReporting','renderRoadmap','renderConfig'].forEach(wrapRender);
  const baseSwitch=window.switchView;if(typeof baseSwitch==='function')window.switchView=function(id){const r=baseSwitch(id);setTimeout(renderCommandMenu,0);return r};
  const baseBanner=window.updateBanner;if(typeof baseBanner==='function')window.updateBanner=function(){const r=baseBanner();setTimeout(renderCommandMenu,0);return r};

  const style=document.createElement('style');style.id='command-menu-styles';style.textContent=`
    .btn{font-size:.76rem;font-weight:750;padding:6px 9px;border-radius:8px;line-height:1.2}
    .toolbar{gap:6px}.top-actions{gap:7px}
    .${SOURCE_CLASS}{display:none!important}

    /* New-record actions are deliberately page-level commands beside Edit List / related workflow controls. */
    #demandToolbar [data-grid-new],#allocationToolbar #newAllocation,#teamToolbar [data-grid-new],#ideaToolbar #newIdeaBtn{
      background:transparent!important;border-color:transparent!important;color:var(--accent)!important;font-weight:850!important;padding-left:5px!important;padding-right:7px!important;box-shadow:none!important
    }
    #demandToolbar [data-grid-new]::before,#allocationToolbar #newAllocation::before,#teamToolbar [data-grid-new]::before,#ideaToolbar #newIdeaBtn::before{
      content:'＋';display:inline-block;margin-right:5px;font-size:.9rem;font-weight:900;line-height:1
    }
    #demandToolbar [data-grid-new]:hover:not(:disabled),#allocationToolbar #newAllocation:hover:not(:disabled),#teamToolbar [data-grid-new]:hover:not(:disabled),#ideaToolbar #newIdeaBtn:hover:not(:disabled){background:var(--soft)!important}

    .command-menu-shell{position:relative;margin-left:2px}
    .command-menu-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:9px;padding:7px 10px;font-size:.76rem;font-weight:800;cursor:pointer;line-height:1}
    .command-menu-toggle:hover{background:var(--soft)}
    .command-menu-toggle>span:first-child{font-size:1rem;line-height:1}
    .command-menu{display:none;position:absolute;right:0;top:calc(100% + 7px);min-width:210px;padding:6px;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);z-index:100}
    .command-menu-shell.open .command-menu{display:block}
    .command-menu-item{width:100%;display:flex;align-items:center;gap:9px;border:0;background:transparent;color:var(--ink);padding:8px 9px;border-radius:7px;text-align:left;font-size:.77rem;font-weight:750;cursor:pointer}
    .command-menu-item:hover:not(:disabled){background:var(--soft)}.command-menu-item:disabled{opacity:.4;cursor:not-allowed}
    .command-menu-item.primary{color:var(--accent);font-weight:850}.command-menu-icon{width:18px;text-align:center;font-size:.9rem}
    .command-menu-separator{height:1px;background:var(--line);margin:5px 4px}
    html[data-theme="dark"] .command-menu-toggle,html[data-theme="dark"] .command-menu{background:var(--panel);color:var(--ink);border-color:var(--line)}
    @media(max-width:760px){.command-menu-label{display:none}.command-menu{right:0;min-width:190px}}
  `;document.head.appendChild(style);
  renderCommandMenu();
})();
