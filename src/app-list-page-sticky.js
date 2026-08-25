/* Page-scroll list tables with a floating header once the table reaches the app banner. */
(function initPageScrollListHeaders(){
  const LIST_TABLES=['demandTable','allocationTable','teamTable','ideaTable'];
  let floating=null,currentTable=null,raf=0;

  function topOffset(){
    const topbar=document.querySelector('.topbar');
    const banner=document.querySelector('.workspace-banner');
    return Math.round((topbar?.getBoundingClientRect().height||0)+(banner?.getBoundingClientRect().height||0));
  }

  function prepareWrap(table){
    const wrap=table?.closest('.table-wrap');if(!wrap)return null;
    wrap.classList.add('page-scroll-list-wrap');
    /* Explicitly defeat the old viewport-height list treatment. Keep horizontal scrolling only. */
    wrap.style.maxHeight='none';wrap.style.height='auto';wrap.style.overflowX='auto';wrap.style.overflowY='hidden';
    return wrap
  }

  function destroyFloating(){floating?.remove();floating=null;currentTable=null}
  function sourceElements(table,selector){return [...table.tHead?.querySelectorAll(selector)||[]]}
  function cloneHeader(table,wrap){
    destroyFloating();if(!table?.tHead||window.innerWidth<=760)return;
    const shell=document.createElement('div');shell.className='amo-floating-list-header';
    const inner=document.createElement('div');inner.className='amo-floating-list-header-inner';
    const clone=document.createElement('table');clone.className=table.className;clone.style.width=`${table.scrollWidth}px`;clone.style.minWidth=`${table.scrollWidth}px`;
    const head=table.tHead.cloneNode(true);clone.appendChild(head);inner.appendChild(clone);shell.appendChild(inner);document.body.appendChild(shell);
    floating=shell;currentTable=table;

    const srcCells=[...table.tHead.querySelectorAll('th')],cloneCells=[...head.querySelectorAll('th')];
    cloneCells.forEach((cell,i)=>{const src=srcCells[i];if(src){const w=src.getBoundingClientRect().width;cell.style.width=`${w}px`;cell.style.minWidth=`${w}px`;cell.style.maxWidth=`${w}px`}});

    [...head.querySelectorAll('[id]')].forEach(el=>{el.dataset.sourceId=el.id;el.removeAttribute('id')});
    const srcInputs=sourceElements(table,'input,select,textarea'),copyInputs=[...head.querySelectorAll('input,select,textarea')];
    copyInputs.forEach((copy,i)=>{const src=srcInputs[i];if(!src)return;copy.value=src.value;copy.addEventListener('input',()=>{src.value=copy.value;src.dispatchEvent(new Event('input',{bubbles:true}))});copy.addEventListener('change',()=>{src.value=copy.value;src.dispatchEvent(new Event('change',{bubbles:true}))})});
    const srcButtons=sourceElements(table,'button'),copyButtons=[...head.querySelectorAll('button')];
    copyButtons.forEach((copy,i)=>{const src=srcButtons[i];if(!src)return;copy.disabled=src.disabled;copy.addEventListener('click',e=>{e.preventDefault();src.click()})});
    syncFloating(table,wrap)
  }

  function syncFloating(table,wrap){
    if(!floating||currentTable!==table)return;
    const rect=wrap.getBoundingClientRect(),offset=topOffset(),headH=table.tHead?.getBoundingClientRect().height||0;
    const show=rect.top<=offset&&rect.bottom>offset+headH;
    floating.classList.toggle('visible',show);if(!show)return;
    floating.style.top=`${offset}px`;floating.style.left=`${Math.round(rect.left)}px`;floating.style.width=`${Math.round(rect.width)}px`;
    const clone=floating.querySelector('table');if(clone){clone.style.width=`${table.scrollWidth}px`;clone.style.minWidth=`${table.scrollWidth}px`;clone.style.transform=`translateX(${-wrap.scrollLeft}px)`}
  }

  function activeListTable(){return LIST_TABLES.map(id=>document.getElementById(id)).find(t=>t?.closest('.view')?.classList.contains('active'))||null}
  function refresh(){
    raf=0;const table=activeListTable();if(!table){destroyFloating();return}const wrap=prepareWrap(table);if(!wrap)return;
    if(currentTable!==table||!floating||floating.dataset.headRows!==String(table.tHead?.rows?.length||0)){cloneHeader(table,wrap);if(floating)floating.dataset.headRows=String(table.tHead?.rows?.length||0)}
    syncFloating(table,wrap)
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(refresh)}

  LIST_TABLES.forEach(id=>{const table=document.getElementById(id),wrap=prepareWrap(table);wrap?.addEventListener('scroll',schedule,{passive:true})});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',()=>{destroyFloating();schedule()});
  new MutationObserver(()=>{destroyFloating();schedule()}).observe(document.querySelector('.content')||document.body,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(schedule,0));
  schedule();

  const style=document.createElement('style');style.id='amo-page-scroll-list-styles';style.textContent=`
    .page-scroll-list-wrap{max-height:none!important;height:auto!important;overflow-x:auto!important;overflow-y:hidden!important}
    .amo-floating-list-header{display:none;position:fixed;z-index:19;overflow:hidden;background:var(--panel);border-left:1px solid var(--line);border-right:1px solid var(--line);box-shadow:0 5px 12px rgba(28,40,73,.10)}
    .amo-floating-list-header.visible{display:block}
    .amo-floating-list-header-inner{overflow:hidden;width:100%}
    .amo-floating-list-header table{margin:0;table-layout:fixed;border-collapse:collapse;transform-origin:top left}
    .amo-floating-list-header thead{background:var(--panel)}
    .amo-floating-list-header th{box-sizing:border-box}
    @media(max-width:760px){.amo-floating-list-header{display:none!important}.page-scroll-list-wrap{overflow-x:auto!important;overflow-y:hidden!important}}
  `;document.head.appendChild(style)
})();
