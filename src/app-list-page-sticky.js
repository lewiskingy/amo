/* Page-scroll list tables with a floating header once the table reaches the app header. */
(function initPageScrollListHeaders(){
  const LIST_TABLES=['demandTable','allocationTable','teamTable','ideaTable'];
  let floating=null,currentTable=null,raf=0;

  function topOffset(){
    /* The topbar itself is sticky. The workspace banner scrolls away with the page, so reserving
       its height left an artificial gap below the app heading. Dock directly to the topbar. */
    const topbar=document.querySelector('.topbar');
    return Math.max(0,Math.round(topbar?.getBoundingClientRect().bottom||topbar?.getBoundingClientRect().height||0));
  }

  function prepareWrap(table){
    const wrap=table?.closest('.table-wrap');if(!wrap)return null;
    wrap.classList.add('page-scroll-list-wrap');
    /* The document owns vertical scrolling. The wrapper retains horizontal scrolling only. */
    wrap.style.maxHeight='none';wrap.style.height='auto';wrap.style.overflowX='auto';wrap.style.overflowY='hidden';
    return wrap
  }

  function installScrollForwarding(wrap){
    if(!wrap||wrap.dataset.pageScrollForwarding==='true')return;
    wrap.dataset.pageScrollForwarding='true';

    /* An overflow-x element can consume trackpad/wheel gestures even though it cannot scroll
       vertically. Forward vertical gestures to the document while leaving horizontal gestures
       available for wide-table navigation. */
    wrap.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.metaKey)return;
      const vertical=Math.abs(event.deltaY)>Math.abs(event.deltaX);
      if(!vertical)return;
      event.preventDefault();
      window.scrollBy({top:event.deltaY,left:0,behavior:'auto'});
    },{passive:false});

    /* Do the same for touch. Decide the gesture axis once movement is clear; vertical drags move
       the page, horizontal drags remain native so the wide table can still be panned sideways. */
    let touch=null;
    wrap.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){touch=null;return}
      const t=event.touches[0];touch={x:t.clientX,y:t.clientY,lastY:t.clientY,axis:null};
    },{passive:true});
    wrap.addEventListener('touchmove',event=>{
      if(!touch||event.touches.length!==1)return;
      const t=event.touches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;
      if(!touch.axis&&Math.max(Math.abs(dx),Math.abs(dy))>6)touch.axis=Math.abs(dy)>=Math.abs(dx)?'y':'x';
      if(touch.axis!=='y')return;
      const delta=touch.lastY-t.clientY;touch.lastY=t.clientY;
      event.preventDefault();
      window.scrollBy({top:delta,left:0,behavior:'auto'});
    },{passive:false});
    const clearTouch=()=>{touch=null};
    wrap.addEventListener('touchend',clearTouch,{passive:true});wrap.addEventListener('touchcancel',clearTouch,{passive:true});
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
    raf=0;const table=activeListTable();if(!table){destroyFloating();return}const wrap=prepareWrap(table);if(!wrap)return;installScrollForwarding(wrap);
    if(currentTable!==table||!floating||floating.dataset.headRows!==String(table.tHead?.rows?.length||0)){cloneHeader(table,wrap);if(floating)floating.dataset.headRows=String(table.tHead?.rows?.length||0)}
    syncFloating(table,wrap)
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(refresh)}

  LIST_TABLES.forEach(id=>{const table=document.getElementById(id),wrap=prepareWrap(table);installScrollForwarding(wrap);wrap?.addEventListener('scroll',schedule,{passive:true})});
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',()=>{destroyFloating();schedule()});
  new MutationObserver(()=>{destroyFloating();schedule()}).observe(document.querySelector('.content')||document.body,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(schedule,0));
  schedule();

  const style=document.createElement('style');style.id='amo-page-scroll-list-styles';style.textContent=`
    .page-scroll-list-wrap{max-height:none!important;height:auto!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-y:auto!important;touch-action:pan-x pan-y}
    .amo-floating-list-header{display:none;position:fixed;z-index:19;overflow:hidden;background:var(--panel);border-left:1px solid var(--line);border-right:1px solid var(--line);box-shadow:0 5px 12px rgba(28,40,73,.10)}
    .amo-floating-list-header.visible{display:block}
    .amo-floating-list-header-inner{overflow:hidden;width:100%}
    .amo-floating-list-header table{margin:0;table-layout:fixed;border-collapse:collapse;transform-origin:top left}
    .amo-floating-list-header thead{background:var(--panel)}
    .amo-floating-list-header th{box-sizing:border-box}
    @media(max-width:760px){.amo-floating-list-header{display:none!important}.page-scroll-list-wrap{overflow-x:auto!important;overflow-y:hidden!important}}
  `;document.head.appendChild(style)
})();
