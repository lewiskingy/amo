/* Theme control plus sticky list-grid controls. Legacy manual Save/Export commands remain available
   internally but are no longer exposed as global shell actions. */
(function initCommandMenu(){
  const SOURCE_CLASS='command-source-hidden';
  const LISTS=[
    {table:'demandTable',toolbar:'demandToolbar'},
    {table:'allocationTable',toolbar:'allocationToolbar'},
    {table:'teamTable',toolbar:'teamToolbar'},
    {table:'ideaTable',toolbar:'ideaToolbar'}
  ];

  function hideLegacySources(){
    ['#saveWorkspaceBtn','#exportBtn','#newDemandBtn'].forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.classList.add(SOURCE_CLASS)));
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
      theme.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true));top.appendChild(theme)
    }
    if(theme){
      theme.classList.remove(SOURCE_CLASS);
      const dark=document.documentElement.dataset.theme==='dark';theme.textContent=dark?'☀':'☾';theme.title=dark?'Switch to light mode':'Switch to dark mode';theme.setAttribute('aria-label',theme.title)
    }
    return theme
  }

  function mirrorToolbar(tableId,toolbarId){
    const table=document.getElementById(tableId),toolbar=document.getElementById(toolbarId),thead=table?.tHead;if(!table||!toolbar||!thead)return;
    table.closest('.table-wrap')?.classList.add('list-table-wrap');thead.querySelector('.list-action-row')?.remove();
    const firstRow=thead.rows[0],colspan=Math.max(1,firstRow?.cells?.length||1),row=thead.insertRow(0);row.className='list-action-row';
    const cell=row.insertCell();cell.colSpan=colspan;cell.className='list-action-cell';const actions=document.createElement('div');actions.className='list-sticky-actions';
    [...toolbar.querySelectorAll('button')].forEach(original=>{const clone=document.createElement('button');clone.type='button';clone.className=original.className;clone.disabled=original.disabled;clone.textContent=original.textContent;clone.addEventListener('click',()=>{if(!original.disabled)original.click()});actions.appendChild(clone)});cell.appendChild(actions)
  }
  function decorateLists(){LISTS.forEach(x=>mirrorToolbar(x.table,x.toolbar))}
  function renderShell(){hideLegacySources();ensureConnectionBadge();ensureThemeToggle();document.getElementById('commandMenuShell')?.remove();decorateLists()}

  const wrapRender=name=>{const fn=window[name];if(typeof fn!=='function')return;window[name]=function(...args){const r=fn.apply(this,args);setTimeout(renderShell,0);return r}};
  ['renderGrid','renderAllocations','renderIdeas','renderStatusReporting','renderRoadmap','renderConfig'].forEach(wrapRender);
  const baseSwitch=window.switchView;if(typeof baseSwitch==='function')window.switchView=function(id){const r=baseSwitch(id);setTimeout(renderShell,0);return r};
  const baseBanner=window.updateBanner;if(typeof baseBanner==='function')window.updateBanner=function(){const r=baseBanner();setTimeout(renderShell,0);return r};

  const style=document.createElement('style');style.id='command-menu-styles';style.textContent=`
    .btn{font-size:.76rem;font-weight:750;padding:6px 9px;border-radius:8px;line-height:1.2}.toolbar{gap:6px}.top-actions{gap:7px}.top-actions-stack{display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:0}
    .workspace-connection-badge{max-width:min(560px,48vw);padding:4px 9px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--muted);font-size:.7rem;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;box-shadow:0 1px 3px rgba(28,40,73,.04)}
    .workspace-connection-badge[data-mode="remote"]{color:var(--accent2);border-color:color-mix(in srgb,var(--accent) 28%,var(--line))}.workspace-connection-badge[data-mode="local"]{color:var(--good);border-color:color-mix(in srgb,var(--good) 28%,var(--line))}
    .${SOURCE_CLASS}{display:none!important}#openWorkspaceBtn{display:inline-flex!important;align-items:center;white-space:nowrap}#themeToggle{display:inline-grid!important;place-items:center;width:34px;height:34px;min-width:34px;padding:0;border-radius:50%;font-size:1rem}
    #demandToolbar,#allocationToolbar,#teamToolbar,#ideaToolbar{display:none!important}.list-table-wrap{max-height:calc(100vh - 132px);overflow:auto;position:relative;overscroll-behavior:contain}.list-table-wrap table thead{position:sticky;top:0;z-index:12;box-shadow:0 1px 0 var(--line)}.list-table-wrap table thead th,.list-table-wrap table thead td{background:var(--panel)}.list-table-wrap .filter-row th{background:#f7f9fc}.list-action-cell{padding:7px 9px!important;border-bottom:1px solid var(--line);background:var(--panel)!important}.list-sticky-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:30px}.list-sticky-actions .btn.primary:first-child{background:transparent!important;border-color:transparent!important;color:var(--accent)!important;font-weight:850!important;padding-left:4px!important;box-shadow:none!important}.list-sticky-actions .btn.primary:first-child::before{content:'＋';display:inline-block;margin-right:5px;font-size:.9rem;font-weight:900}
    html[data-theme="dark"] .workspace-connection-badge,html[data-theme="dark"] .list-table-wrap table thead th,html[data-theme="dark"] .list-table-wrap table thead td,html[data-theme="dark"] .list-action-cell{background:var(--panel)!important;color:var(--ink);border-color:var(--line)}html[data-theme="dark"] .list-table-wrap .filter-row th{background:#182237!important}
    @media(max-width:760px){.topbar{align-items:flex-start}.top-actions-stack{align-items:stretch;width:100%}.top-actions{justify-content:flex-end}.workspace-connection-badge{max-width:100%;width:100%}.list-table-wrap{max-height:70vh}}
  `;document.head.appendChild(style);renderShell()
})();
